// ============================================================================
// Go AI Engine (Hybrid Policy + UCT-MCTS) & Real-Time Coach Analyzer
// ============================================================================

import {
  EMPTY,
  BLACK,
  WHITE,
  opponent,
  coordToLabel,
  estimateInfluence,
  detectMoveFeatures,
} from './engine.js';
import { neuralEngine } from './nn-engine.js';
import { t } from './i18n.js';

export const DIFFICULTY_PRESETS = {
  relaxed: {
    id: 'relaxed',
    label: '15 級 · 輕鬆',
    rank: '15 級',
    simulations9: 140,
    simulations13: 90,
    simulations19: 55,
    nnVisits: 1,
    topK: 14,
    noise: 0.16,
    timeBudgetMs: 260,
  },
  club: {
    id: 'club',
    label: '10 級 · 棋社',
    rank: '10 級',
    simulations9: 420,
    simulations13: 240,
    simulations19: 130,
    nnVisits: 6,
    topK: 18,
    noise: 0.04,
    timeBudgetMs: 480,
  },
  strong: {
    id: 'strong',
    label: '5 級 · 強手',
    rank: '5 級',
    simulations9: 850,
    simulations13: 450,
    simulations19: 240,
    nnVisits: 16,
    topK: 22,
    noise: 0.0,
    timeBudgetMs: 750,
  },
  dan: {
    id: 'dan',
    label: '段位 · 神經網路',
    rank: '段位 NN',
    simulations9: 1200,
    simulations13: 650,
    simulations19: 340,
    nnVisits: 32,
    topK: 24,
    noise: 0.0,
    timeBudgetMs: 1400,
  },
};

// ============================================================================
// Static Board Evaluation (Winrate from Black's perspective in [0, 1])
// ============================================================================

export function evaluateBoardStatic(board, komi = 6.5) {
  const influence = estimateInfluence(board);
  const total = board.size * board.size;
  let blackArea = 0;
  let whiteArea = 0;

  for (let i = 0; i < total; i++) {
    const c = board.grid[i];
    if (c === BLACK) {
      blackArea += 1.0;
    } else if (c === WHITE) {
      whiteArea += 1.0;
    } else {
      const inf = influence[i];
      if (inf > 0.28) blackArea += inf;
      else if (inf < -0.28) whiteArea += -inf;
    }
  }

  // Factor in vulnerable groups in atari
  const groups = board.getAllGroups();
  for (const grp of groups) {
    if (grp.liberties.size === 1) {
      const penalty = grp.stones.length * 1.45;
      if (grp.color === BLACK) blackArea -= penalty;
      else whiteArea -= penalty;
    }
  }

  const scoreLeadBlack = blackArea - (whiteArea + komi);
  // Sigmoid scaled by board size
  const scale = board.size === 9 ? 7.5 : board.size === 13 ? 12.0 : 18.0;
  const blackWinrate = 1 / (1 + Math.exp(-scoreLeadBlack / scale));

  return {
    blackWinrate,
    scoreLeadBlack,
  };
}

// ============================================================================
// Rich Go Policy Prior Scorer (Fast Tactical + Positional Heuristics)
// ============================================================================

function countStonesOnBoard(board) {
  let count = 0;
  const g = board.grid;
  for (let i = 0; i < g.length; i++) {
    if (g[i] !== EMPTY) count++;
  }
  return count;
}

export function getCandidateMoves(board, color, lastMoveIdx = -1, superkoSet = null, maxCandidates = 24) {
  const size = board.size;
  const total = size * size;
  const opp = opponent(color);
  const stoneCount = countStonesOnBoard(board);
  const openingPhase = stoneCount < (size === 9 ? 14 : size === 13 ? 28 : 48);
  const endgamePhase = stoneCount > total * 0.58;

  // Precompute groups in atari / low liberties so we can score tactical urgency in O(1)
  const groups = board.getAllGroups();
  const saveAtariLib = new Map(); // libIdx -> total friendly stones saved
  const captureAtariLib = new Map(); // libIdx -> total opp stones captured
  const oppTwoLibBonus = new Map(); // libIdx -> opp stones with 2 liberties
  const friendlyTwoLibBonus = new Map();

  for (const grp of groups) {
    if (grp.liberties.size === 1) {
      const lib = grp.liberties.values().next().value;
      if (grp.color === color) {
        saveAtariLib.set(lib, (saveAtariLib.get(lib) || 0) + grp.stones.length);
      } else {
        captureAtariLib.set(lib, (captureAtariLib.get(lib) || 0) + grp.stones.length);
      }
    } else if (grp.liberties.size === 2) {
      for (const lib of grp.liberties) {
        if (grp.color === opp) {
          oppTwoLibBonus.set(lib, (oppTwoLibBonus.get(lib) || 0) + grp.stones.length);
        } else {
          friendlyTwoLibBonus.set(lib, (friendlyTwoLibBonus.get(lib) || 0) + grp.stones.length);
        }
      }
    }
  }

  const lastX = lastMoveIdx >= 0 ? lastMoveIdx % size : -1;
  const lastY = lastMoveIdx >= 0 ? Math.floor(lastMoveIdx / size) : -1;

  // Influence map for avoiding playing deep inside dead/settled territory
  const influence = stoneCount > 10 ? estimateInfluence(board) : null;

  const candidates = [];

  for (let idx = 0; idx < total; idx++) {
    if (board.grid[idx] !== EMPTY || idx === board.koPoint) continue;

    // Never fill our own true eye unless it captures opponent stones!
    const capturesHere = captureAtariLib.get(idx) || 0;
    if (capturesHere === 0 && board.isTrueEye(idx, color)) continue;

    // Check legality fast
    if (!board.isLegalIdx(idx, color, superkoSet)) continue;

    const x = idx % size;
    const y = Math.floor(idx / size);
    const dxEdge = Math.min(x, size - 1 - x) + 1;
    const dyEdge = Math.min(y, size - 1 - y) + 1;
    const line = Math.min(dxEdge, dyEdge);

    let score = 10.0;
    const tags = [];

    // 1. Tactical Capture (huge priority)
    if (capturesHere > 0) {
      score += 55 + capturesHere * 22;
      tags.push(t('tagCapture', { n: capturesHere }));
    }

    // 2. Saving a friendly group in Atari
    const savesHere = saveAtariLib.get(idx) || 0;
    if (savesHere > 0) {
      // Simulate briefly to verify it actually escapes atari (gains >= 2 liberties)
      const sim = board.clone();
      const simRes = sim.playIdx(idx, color);
      if (simRes.legal) {
        const libsAfter = sim.countLibertiesUpTo(idx, 3);
        if (libsAfter >= 2) {
          score += 48 + savesHere * 20;
          tags.push(t('tagSaveAtari', { n: savesHere }));
        } else {
          // Extending into a dead ladder / still 1 liberty — penalize!
          score -= 18;
        }
      }
    }

    // 3. Putting opponent 2-liberty group into atari
    const oppTwo = oppTwoLibBonus.get(idx) || 0;
    if (oppTwo > 0) {
      score += 18 + Math.min(20, oppTwo * 5);
      tags.push(t('tagAtari'));
    }

    // 4. Extending a friendly 2-liberty group
    const myTwo = friendlyTwoLibBonus.get(idx) || 0;
    if (myTwo > 0) {
      score += 10 + Math.min(14, myTwo * 3);
    }

    // 5. Local neighbor analysis
    const ortho = board._ortho[idx];
    const diag = board._diag[idx];
    let fOrtho = 0, oOrtho = 0, emptyOrtho = 0;
    let fDiag = 0, oDiag = 0;
    for (let k = 0; k < ortho.length; k++) {
      const c = board.grid[ortho[k]];
      if (c === color) fOrtho++;
      else if (c === opp) oOrtho++;
      else emptyOrtho++;
    }
    for (let k = 0; k < diag.length; k++) {
      const c = board.grid[diag[k]];
      if (c === color) fDiag++;
      else if (c === opp) oDiag++;
    }

    // Self-atari check (very important so AI doesn't throw away stones)
    if (capturesHere === 0 && emptyOrtho <= 1) {
      const sim = board.clone();
      const simRes = sim.playIdx(idx, color);
      if (simRes.legal) {
        const libs = sim.countLibertiesUpTo(idx, 2);
        if (libs === 1) {
          // Allow snapback/throw-in if it puts enemy in atari; otherwise heavy penalty
          let putsOppAtari = false;
          for (const n of ortho) {
            if (sim.grid[n] === opp && sim.countLibertiesUpTo(n, 2) === 1) {
              putsOppAtari = true;
              break;
            }
          }
          if (putsOppAtari) {
            score += 4;
          } else {
            score -= 42;
            tags.push(t('tagSelfAtari'));
          }
        }
      }
    }

    // 6. Shape Heuristics
    // Hane (diagonal to friendly, touching enemy)
    if (oOrtho >= 1 && fDiag >= 1 && fOrtho === 0) {
      score += 11;
      tags.push(t('tagHane'));
    }
    // Diagonal / Tiger's mouth / Kosumi
    if (fDiag >= 1 && fOrtho === 0 && oOrtho === 0) {
      score += 6;
    }
    if (fDiag >= 2 && fOrtho === 0) {
      score += 9;
      tags.push(t('tagTiger'));
    }
    // Cut / Push through between enemy stones
    if (oOrtho >= 2) {
      score += 10;
      tags.push(t('tagCut'));
    }
    // Connect when enemy is adjacent
    if (fOrtho >= 2 && oOrtho >= 1) {
      score += 12;
      tags.push(t('tagConnect'));
    }
    // Empty Triangle penalty (unless capturing or saving)
    if (capturesHere === 0 && savesHere === 0 && fOrtho >= 2 && oOrtho === 0) {
      let formsEmptyTri = false;
      const sqOffsets = [
        [[0, 0], [1, 0], [0, 1], [1, 1]],
        [[-1, 0], [0, 0], [-1, 1], [0, 1]],
        [[0, -1], [1, -1], [0, 0], [1, 0]],
        [[-1, -1], [0, -1], [-1, 0], [0, 0]],
      ];
      for (const sq of sqOffsets) {
        let fc = 0, ec = 0, ok = true;
        for (const [ox, oy] of sq) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) { ok = false; break; }
          if (nx === x && ny === y) { fc++; continue; }
          const v = board.get(nx, ny);
          if (v === color) fc++;
          else if (v === EMPTY) ec++;
        }
        if (ok && fc === 3 && ec === 1) {
          formsEmptyTri = true;
          break;
        }
      }
      if (formsEmptyTri) {
        score -= 14;
      }
    }

    // 7. Opening & Positional Principles (Corners -> Sides -> Center)
    if (openingPhase) {
      // Check if local corner/area is empty
      let nearbyStones = 0;
      const radius = size === 9 ? 2 : 3;
      for (let ry = Math.max(0, y - radius); ry <= Math.min(size - 1, y + radius); ry++) {
        for (let rx = Math.max(0, x - radius); rx <= Math.min(size - 1, x + radius); rx++) {
          if (board.grid[ry * size + rx] !== EMPTY) nearbyStones++;
        }
      }

      if (size === 9) {
        // 9x9 golden opening spots: 3-3, 3-4, 4-4, 4-5, center 5-5
        if (dxEdge >= 3 && dyEdge >= 3 && dxEdge <= 5 && dyEdge <= 5) {
          score += nearbyStones === 0 ? 18 : 8;
          if (dxEdge === 5 && dyEdge === 5 && stoneCount <= 2) score += 6;
          if ((dxEdge === 3 || dxEdge === 4) && (dyEdge === 3 || dyEdge === 4) && nearbyStones === 0) {
            tags.push(t('tagOpeningBig'));
          }
        }
        if (line === 1) score -= 24;
        else if (line === 2 && oOrtho === 0) score -= 12;
      } else {
        // 13x13 & 19x19: Prioritize empty corners (4-4, 3-4, 3-3), then approaches, then 3rd/4th line sides
        const isGoldenCorner = (dxEdge === 4 && dyEdge === 4) ||
          (dxEdge === 3 && dyEdge === 4) ||
          (dxEdge === 4 && dyEdge === 3);
        const isSanSan = dxEdge === 3 && dyEdge === 3;
        if (isGoldenCorner && nearbyStones === 0) {
          score += 28;
          tags.push(t('tagEmptyCorner'));
        } else if (isSanSan && nearbyStones === 0) {
          score += 18;
          tags.push(t('tagCornerTerritory'));
        } else if (isGoldenCorner && nearbyStones === 1) {
          score += 14;
        }
        // Approach (Kakari) or Enclosure (Shimari) near a corner stone
        if ((dxEdge === 3 || dxEdge === 4) && (dyEdge === 5 || dyEdge === 6) && nearbyStones === 1) {
          score += 15;
          tags.push(t('tagCornerApproach'));
        }
        if ((dyEdge === 3 || dyEdge === 4) && (dxEdge === 5 || dxEdge === 6) && nearbyStones === 1) {
          score += 15;
          tags.push(t('tagCornerApproach'));
        }
        // 3rd & 4th line sides
        if (line === 3 || line === 4) {
          score += 7;
        } else if (line === 1) {
          score -= 26;
        } else if (line === 2 && oOrtho === 0 && oDiag === 0) {
          score -= 14;
        }
      }
    } else {
      // Midgame / Endgame line weights
      if (line === 1 && oOrtho === 0 && capturesHere === 0 && !endgamePhase) {
        score -= 14;
      }
      if (line === 3 || line === 4) {
        score += 3;
      }
    }

    // 8. Influence / Territory Boundary (Play on the frontier, not deep inside settled territory!)
    if (influence) {
      const inf = influence[idx];
      const absInf = Math.abs(inf);
      // Border / contested area (|inf| < 0.55) is where points are gained!
      if (absInf < 0.5) {
        score += 8;
      } else if (absInf > 0.86 && capturesHere === 0 && savesHere === 0) {
        // Playing deep inside already-decided territory wastes a turn
        score -= 22;
      }
    }

    // 9. Local urgency near last move
    if (lastMoveIdx >= 0) {
      const dist = Math.abs(x - lastX) + Math.abs(y - lastY);
      if (dist === 1) score += 8;
      else if (dist === 2) score += 7;
      else if (dist === 3) score += 4;
    }

    // 10. Slight spacing bonus (knight's move / one-space jump) when fighting
    if (fOrtho === 0 && fDiag === 0 && oOrtho === 0) {
      // Check one-space jump (distance 2 orthogonally) to friendly stone
      const jumps = [
        [x + 2, y], [x - 2, y], [x, y + 2], [x, y - 2],
      ];
      let hasJump = false;
      for (const [jx, jy] of jumps) {
        if (board.get(jx, jy) === color) { hasJump = true; break; }
      }
      if (hasJump && !openingPhase) score += 4;
    }

    candidates.push({
      idx,
      x,
      y,
      prior: score,
      tags,
    });
  }

  candidates.sort((a, b) => b.prior - a.prior);
  return candidates.slice(0, maxCandidates);
}

// ============================================================================
// Fast Tactical Playout for MCTS
// ============================================================================

function runPlayout(board, nextColor, komi, maxPlies) {
  const sim = board.clone();
  let turn = nextColor;
  const total = sim.size * sim.size;
  let consecutivePasses = 0;

  for (let ply = 0; ply < maxPlies; ply++) {
    // Pick a fast tactical/random non-eye move
    let chosen = -1;
    const startOffset = (Math.random() * total) | 0;

    // Quick scan for an immediate capture or random legal move
    let fallback = -1;
    const opp = opponent(turn);
    for (let step = 0; step < total; step++) {
      const idx = (startOffset + step) % total;
      if (sim.grid[idx] !== EMPTY || idx === sim.koPoint) continue;
      if (sim.isTrueEye(idx, turn)) continue;

      // Check if adjacent to an enemy stone in atari -> immediate tactical capture!
      const ortho = sim._ortho[idx];
      let captures = false;
      for (let k = 0; k < ortho.length; k++) {
        const n = ortho[k];
        if (sim.grid[n] === opp && sim.countLibertiesUpTo(n, 2) === 1) {
          captures = true;
          break;
        }
      }
      if (captures) {
        const res = sim.playIdx(idx, turn);
        if (res.legal) {
          chosen = idx;
          break;
        }
      }

      if (fallback === -1) {
        // Avoid obvious self-atari in playout
        let emptyAround = 0;
        for (let k = 0; k < ortho.length; k++) {
          if (sim.grid[ortho[k]] === EMPTY) emptyAround++;
        }
        if (emptyAround >= 1) {
          fallback = idx;
        }
      }
    }

    if (chosen === -1 && fallback !== -1) {
      const res = sim.playIdx(fallback, turn);
      if (res.legal) chosen = fallback;
    }

    if (chosen === -1) {
      sim.pass();
      consecutivePasses++;
      if (consecutivePasses >= 2) break;
    } else {
      consecutivePasses = 0;
    }
    turn = opponent(turn);
  }

  return evaluateBoardStatic(sim, komi).blackWinrate;
}

// ============================================================================
// MCTS Node & Async Search (Non-blocking UCT with Progressive Bias)
// ============================================================================

class MCTSNode {
  constructor(board, colorToPlay, moveIdx = -1, parent = null, priorScore = 0, tags = []) {
    this.board = board;
    this.colorToPlay = colorToPlay;
    this.moveIdx = moveIdx; // move that led to this node
    this.parent = parent;
    this.priorScore = priorScore;
    this.tags = tags;
    this.visits = 0;
    this.blackWins = 0;
    this.children = null;
  }

  ucbScore(parentVisits, isBlackParent) {
    if (this.visits === 0) {
      return 1e6 + this.priorScore;
    }
    const meanBlack = this.blackWins / this.visits;
    const meanForParent = isBlackParent ? meanBlack : (1 - meanBlack);
    const explore = 1.15 * Math.sqrt(Math.log(parentVisits + 1) / this.visits);
    const progressiveBias = (this.priorScore * 0.015) / (this.visits + 1);
    return meanForParent + explore + progressiveBias;
  }
}

// ============================================================================
// AlphaZero / KataGo PUCT-MCTS Powered by In-Browser ONNX Neural Network
// ============================================================================

class PUCTNode {
  constructor(board, colorToPlay, moveIdx = -1, parent = null, priorProb = 0) {
    this.board = board;
    this.colorToPlay = colorToPlay;
    this.moveIdx = moveIdx;
    this.parent = parent;
    this.priorProb = priorProb;
    this.visits = 0;
    this.blackValueSum = 0;
    this.children = null;
  }

  puctScore(parentVisits, isBlackParent) {
    const qBlack = this.visits > 0 ? this.blackValueSum / this.visits : 0.5;
    const q = isBlackParent ? qBlack : (1 - qBlack);
    const u = 1.45 * this.priorProb * Math.sqrt(parentVisits + 1) / (1 + this.visits);
    return q + u;
  }
}

async function analyzeWithNeuralNetAsync(board, colorToPlay, {
  komi = 6.5,
  rules = 'chinese',
  recentMoves = [],
  superkoSet = null,
  difficulty = 'club',
  customTimeBudgetMs = null,
} = {}) {
  const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.club;
  const maxVisits = preset.nnVisits || 12;
  const timeBudget = customTimeBudgetMs ?? Math.max(900, preset.timeBudgetMs);
  const startTime = performance.now();

  const rootEval = await neuralEngine.evaluate(board, colorToPlay, { komi, rules, recentMoves });
  if (!rootEval) return null;

  const size = board.size;
  const total = size * size;

  // Gather legal moves sorted by neural policy probability
  const legalMoves = [];
  for (let idx = 0; idx < total; idx++) {
    if (board.grid[idx] !== EMPTY || idx === board.koPoint) continue;
    if (!board.isLegalIdx(idx, colorToPlay, superkoSet)) continue;
    legalMoves.push({ idx, prior: rootEval.policyProbs[idx] || 0 });
  }
  legalMoves.sort((a, b) => b.prior - a.prior);

  if (legalMoves.length === 0 || rootEval.passProb > 0.72) {
    return {
      passRecommended: true,
      bestMove: null,
      topMoves: [],
      allEvaluated: [],
      blackWinrate: rootEval.blackWinrate,
      playerWinrate: rootEval.playerWinrate,
      scoreLeadBlack: rootEval.scoreLeadBlack,
      ownershipMap: rootEval.ownershipBlack,
      simulations: 1,
      engineUsed: 'onnx',
    };
  }

  const root = new PUCTNode(board.clone(), colorToPlay, -1, null, 1.0);
  root.visits = 1;
  root.blackValueSum = rootEval.blackWinrate;
  root.children = [];

  const topLegal = legalMoves.slice(0, Math.min(18, legalMoves.length));
  for (const m of topLegal) {
    const nb = board.clone();
    if (nb.playIdx(m.idx, colorToPlay, superkoSet).legal) {
      root.children.push(new PUCTNode(nb, opponent(colorToPlay), m.idx, root, m.prior));
    }
  }

  let evals = 1;
  while (evals < maxVisits && (performance.now() - startTime) < timeBudget && root.children.length > 0) {
    // 1. Selection via PUCT
    let node = root;
    while (node.children && node.children.length > 0) {
      const isBlackTurn = node.colorToPlay === BLACK;
      let best = node.children[0];
      let bestScore = -Infinity;
      for (let i = 0; i < node.children.length; i++) {
        const s = node.children[i].puctScore(node.visits, isBlackTurn);
        if (s > bestScore) {
          bestScore = s;
          best = node.children[i];
        }
      }
      node = best;
    }

    // 2. Neural Evaluation & Expansion
    const ev = await neuralEngine.evaluate(node.board, node.colorToPlay, { komi, rules, recentMoves });
    if (!ev) break;
    evals++;

    if (node.visits >= 1 && evals < maxVisits) {
      const subMoves = [];
      for (let idx = 0; idx < total; idx++) {
        if (node.board.grid[idx] !== EMPTY || idx === node.board.koPoint) continue;
        if (ev.policyProbs[idx] > 0.015 && node.board.isLegalIdx(idx, node.colorToPlay)) {
          subMoves.push({ idx, prior: ev.policyProbs[idx] });
        }
      }
      subMoves.sort((a, b) => b.prior - a.prior);
      if (subMoves.length > 0) {
        node.children = [];
        for (const sm of subMoves.slice(0, 8)) {
          const nb = node.board.clone();
          if (nb.playIdx(sm.idx, node.colorToPlay).legal) {
            node.children.push(new PUCTNode(nb, opponent(node.colorToPlay), sm.idx, node, sm.prior));
          }
        }
      }
    }

    // 3. Backpropagation
    let curr = node;
    while (curr !== null) {
      curr.visits += 1;
      curr.blackValueSum += ev.blackWinrate;
      curr = curr.parent;
    }

    if (evals % 3 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const isBlack = colorToPlay === BLACK;
  const scored = root.children.map((ch) => {
    const blackWr = ch.visits > 0 ? ch.blackValueSum / ch.visits : rootEval.blackWinrate;
    const playerWr = isBlack ? blackWr : (1 - blackWr);
    const x = ch.moveIdx % size;
    const y = Math.floor(ch.moveIdx / size);
    const evalScore = (ch.visits * 0.05) + ch.priorProb * 1.2 + playerWr * 0.4;
    return {
      idx: ch.moveIdx,
      x,
      y,
      coord: coordToLabel(x, y, size),
      visits: ch.visits,
      blackWinrate: blackWr,
      playerWinrate: playerWr,
      priorScore: ch.priorProb * 100,
      evalScore,
      tags: [],
      reason: buildMoveReason(board, ch.moveIdx, colorToPlay, []),
    };
  });

  scored.sort((a, b) => b.evalScore - a.evalScore);

  let selectedMove = scored[0];
  if (preset.noise > 0 && scored.length > 1) {
    const pool = scored.slice(0, Math.min(3, scored.length));
    if (Math.random() < preset.noise * 2.0) {
      selectedMove = pool[Math.floor(Math.random() * pool.length)];
    }
  }

  return {
    passRecommended: false,
    bestMove: selectedMove,
    topMoves: scored.slice(0, 3),
    allEvaluated: scored,
    blackWinrate: scored[0]?.blackWinrate ?? rootEval.blackWinrate,
    playerWinrate: scored[0]?.playerWinrate ?? rootEval.playerWinrate,
    scoreLeadBlack: rootEval.scoreLeadBlack,
    ownershipMap: rootEval.ownershipBlack,
    simulations: evals,
    engineUsed: 'onnx',
  };
}

export async function analyzePositionAsync(board, colorToPlay, {
  komi = 6.5,
  rules = 'chinese',
  recentMoves = [],
  lastMoveIdx = -1,
  superkoSet = null,
  difficulty = 'club',
  customSimulations = null,
  customTimeBudgetMs = null,
} = {}) {
  // Automatically use In-Browser ONNX Neural Network (WebGPU/WASM) when loaded
  if (neuralEngine.isReady()) {
    try {
      const nnRes = await analyzeWithNeuralNetAsync(board, colorToPlay, {
        komi,
        rules,
        recentMoves,
        superkoSet,
        difficulty,
        customTimeBudgetMs,
      });
      if (nnRes) return nnRes;
    } catch (err) {
      console.warn('ONNX neural evaluation failed, falling back to heuristic MCTS:', err);
    }
  }

  const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.club;
  const maxSims = customSimulations ?? (
    board.size === 9 ? preset.simulations9 :
    board.size === 13 ? preset.simulations13 :
    preset.simulations19
  );
  const timeBudget = customTimeBudgetMs ?? preset.timeBudgetMs;
  const playoutPlies = board.size === 9 ? 28 : board.size === 13 ? 14 : 8;

  const rootCandidates = getCandidateMoves(board, colorToPlay, lastMoveIdx, superkoSet, preset.topK);

  // If no worthwhile moves exist, recommend Pass
  const staticEval = evaluateBoardStatic(board, komi);
  if (rootCandidates.length === 0 || (rootCandidates[0].prior < -8 && countStonesOnBoard(board) > board.size * board.size * 0.45)) {
    const winrateForPlayer = colorToPlay === BLACK ? staticEval.blackWinrate : (1 - staticEval.blackWinrate);
    return {
      passRecommended: true,
      bestMove: null,
      topMoves: [],
      blackWinrate: staticEval.blackWinrate,
      playerWinrate: winrateForPlayer,
      scoreLeadBlack: staticEval.scoreLeadBlack,
      simulations: 0,
    };
  }

  const root = new MCTSNode(board.clone(), colorToPlay, lastMoveIdx, null, 0);
  root.children = [];
  for (const c of rootCandidates) {
    const nextB = board.clone();
    const res = nextB.playIdx(c.idx, colorToPlay, superkoSet);
    if (res.legal) {
      root.children.push(new MCTSNode(nextB, opponent(colorToPlay), c.idx, root, c.prior, c.tags));
    }
  }

  if (root.children.length === 0) {
    return {
      passRecommended: true,
      bestMove: null,
      topMoves: [],
      blackWinrate: staticEval.blackWinrate,
      playerWinrate: colorToPlay === BLACK ? staticEval.blackWinrate : 1 - staticEval.blackWinrate,
      scoreLeadBlack: staticEval.scoreLeadBlack,
      simulations: 0,
    };
  }

  const startTime = performance.now();
  let lastYield = startTime;
  let simCount = 0;

  // Give every root child at least 1 quick static + playout eval first
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    const staticWr = evaluateBoardStatic(child.board, komi).blackWinrate;
    const playoutWr = runPlayout(child.board, child.colorToPlay, komi, playoutPlies);
    const blended = staticWr * 0.62 + playoutWr * 0.38;
    child.visits = 1;
    child.blackWins = blended;
    root.visits += 1;
    root.blackWins += blended;
    simCount++;
  }

  while (simCount < maxSims && (performance.now() - startTime) < timeBudget) {
    // 1. Selection
    let node = root;
    while (node.children && node.children.length > 0) {
      const isBlackTurn = node.colorToPlay === BLACK;
      let bestChild = node.children[0];
      let bestUcb = -Infinity;
      for (let i = 0; i < node.children.length; i++) {
        const u = node.children[i].ucbScore(node.visits, isBlackTurn);
        if (u > bestUcb) {
          bestUcb = u;
          bestChild = node.children[i];
        }
      }
      node = bestChild;
    }

    // 2. Expansion (expand deeper once visited a few times)
    if (node.visits >= 4 && node !== root) {
      const subCands = getCandidateMoves(node.board, node.colorToPlay, node.moveIdx, null, 8);
      if (subCands.length > 0) {
        node.children = [];
        for (const c of subCands) {
          const nb = node.board.clone();
          if (nb.playIdx(c.idx, node.colorToPlay).legal) {
            node.children.push(new MCTSNode(nb, opponent(node.colorToPlay), c.idx, node, c.prior, c.tags));
          }
        }
        if (node.children.length > 0) {
          node = node.children[0];
        }
      }
    }

    // 3. Evaluation (Blended static + tactical playout)
    const staticWr = evaluateBoardStatic(node.board, komi).blackWinrate;
    const playoutWr = runPlayout(node.board, node.colorToPlay, komi, playoutPlies);
    const val = staticWr * 0.60 + playoutWr * 0.40;

    // 4. Backpropagation
    let curr = node;
    while (curr !== null) {
      curr.visits += 1;
      curr.blackWins += val;
      curr = curr.parent;
    }

    simCount++;

    // Yield periodically to keep 60fps UI responsive
    if (simCount % 20 === 0 && (performance.now() - lastYield) > 24) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      lastYield = performance.now();
    }
  }

  // Rank root children by a blend of visits, winrate, and prior
  const isBlack = colorToPlay === BLACK;
  const scored = root.children.map((ch) => {
    const blackWr = ch.blackWins / Math.max(1, ch.visits);
    const playerWr = isBlack ? blackWr : (1 - blackWr);
    const x = ch.moveIdx % board.size;
    const y = Math.floor(ch.moveIdx / board.size);
    const evalScore = playerWr + Math.min(0.08, ch.visits / (simCount * 6)) + Math.max(-0.15, Math.min(0.15, ch.priorScore * 0.0018));
    return {
      idx: ch.moveIdx,
      x,
      y,
      coord: coordToLabel(x, y, board.size),
      visits: ch.visits,
      blackWinrate: blackWr,
      playerWinrate: playerWr,
      priorScore: ch.priorScore,
      evalScore,
      tags: ch.tags,
      reason: buildMoveReason(board, ch.moveIdx, colorToPlay, ch.tags),
    };
  });

  scored.sort((a, b) => b.evalScore - a.evalScore);

  // For relaxed difficulty, optionally introduce slight human-like move variety among top 3
  let selectedMove = scored[0];
  if (preset.noise > 0 && scored.length > 1) {
    const pool = scored.slice(0, Math.min(3, scored.length)).filter((m) => m.priorScore > 0);
    if (pool.length > 1 && Math.random() < preset.noise * 2.2) {
      selectedMove = pool[Math.floor(Math.random() * pool.length)];
    }
  }

  const bestBlackWr = scored[0].blackWinrate;
  const bestPlayerWr = scored[0].playerWinrate;

  // Decide if AI should pass in deep endgame
  const shouldPass =
    countStonesOnBoard(board) > board.size * board.size * 0.62 &&
    scored[0].priorScore < 0 &&
    bestPlayerWr > 0.55;

  return {
    passRecommended: shouldPass,
    bestMove: shouldPass ? null : selectedMove,
    topMoves: scored.slice(0, 3),
    allEvaluated: scored,
    blackWinrate: bestBlackWr,
    playerWinrate: bestPlayerWr,
    scoreLeadBlack: staticEval.scoreLeadBlack,
    simulations: simCount,
  };
}

// ============================================================================
// Coach Explanation & Move Grading Engine
// ============================================================================

function buildMoveReason(board, moveIdx, color, tags = []) {
  const sim = board.clone();
  const res = sim.playIdx(moveIdx, color);
  if (!res.legal) return t('reasonSolid');
  const feat = detectMoveFeatures(board, moveIdx, color, sim, res.captured);

  if (feat.capturedCount > 0) {
    return t('reasonCapture', { n: feat.capturedCount });
  }
  if (feat.savedAtariStones > 0) {
    return t('reasonSave', { n: feat.savedAtariStones });
  }
  if (feat.putOppInAtari.length > 0) {
    return t('reasonAtari');
  }
  if (feat.isCut) {
    return t('reasonCut');
  }
  if (feat.isConnect) {
    return t('reasonConnect');
  }
  if (feat.isTigersMouth) {
    return t('reasonTiger');
  }
  if (feat.isHane) {
    return t('reasonHane');
  }
  if (tags.includes(t('tagEmptyCorner'))) {
    return t('reasonEmptyCorner');
  }
  if (tags.includes(t('tagCornerApproach'))) {
    return t('reasonCornerApproach');
  }
  if (feat.isCornerPoint && countStonesOnBoard(board) < 16) {
    return t('reasonCornerBalanced', { coord: feat.coord });
  }
  if (feat.line === 3) {
    return t('reasonLine3');
  }
  if (feat.line === 4) {
    return t('reasonLine4');
  }
  return t('reasonExpand');
}

export async function evaluateUserMoveAsync(boardBefore, moveIdx, color, boardAfter, captured, {
  komi = 6.5,
  prevLastMoveIdx = -1,
  superkoSet = null,
} = {}) {
  // Run a crisp analysis on boardBefore to know what the best moves were
  const preAnalysis = await analyzePositionAsync(boardBefore, color, {
    komi,
    lastMoveIdx: prevLastMoveIdx,
    superkoSet,
    difficulty: 'club',
    customSimulations: boardBefore.size === 9 ? 260 : boardBefore.size === 13 ? 160 : 95,
    customTimeBudgetMs: 280,
  });

  // Handle Pass evaluation
  if (moveIdx < 0) {
    const postEval = evaluateBoardStatic(boardAfter, komi);
    return {
      grade: preAnalysis.passRecommended ? 'great' : 'inaccuracy',
      gradeLabel: preAnalysis.passRecommended ? t('gradeGoodPass') : t('gradeEarlyPass'),
      winrateDelta: 0,
      blackWinrateAfter: postEval.blackWinrate,
      scoreLeadBlack: postEval.scoreLeadBlack,
      headline: preAnalysis.passRecommended
        ? t('evalPassGoodHead')
        : t('evalPassEarlyHead'),
      explanation: preAnalysis.passRecommended
        ? t('evalPassGoodExp')
        : t('evalPassEarlyExp', { coord: preAnalysis.topMoves[0]?.coord || t('evalPassEarlyFallback') }),
      bestMoves: preAnalysis.topMoves,
      features: null,
    };
  }

  const features = detectMoveFeatures(boardBefore, moveIdx, color, boardAfter, captured);
  const postStatic = evaluateBoardStatic(boardAfter, komi);
  const userBlackWr = postStatic.blackWinrate;
  const userPlayerWr = color === BLACK ? userBlackWr : (1 - userBlackWr);

  // See if user's move was in evaluated candidates
  const matchedCand = preAnalysis.allEvaluated?.find((m) => m.idx === moveIdx);
  const bestCand = preAnalysis.topMoves[0];
  const bestPlayerWr = bestCand ? bestCand.playerWinrate : userPlayerWr;
  const effectiveUserWr = matchedCand ? matchedCand.playerWinrate : userPlayerWr;

  // Calculate quality drop (positive = worse than best)
  let wrDrop = Math.max(0, bestPlayerWr - effectiveUserWr);
  const priorDiff = bestCand && matchedCand ? Math.max(0, bestCand.priorScore - matchedCand.priorScore) : 25;

  // Detect specific tactical misses (did user miss an urgent capture or atari save?)
  const savePrefix = t('tagSaveAtari', { n: '' }).slice(0, 2);
  const capPrefix = t('tagCapture', { n: '' }).slice(0, 2);
  const missedUrgent = bestCand && bestCand.idx !== moveIdx && (
    bestCand.tags.some((tg) => tg.startsWith(savePrefix) || tg.startsWith(capPrefix))
  );

  // Adjust drop for glaring tactical mistakes / shape blunders
  if (features.filledOwnEye) wrDrop = Math.max(wrDrop, 0.25);
  if (features.selfAtari && !features.isSnapbackSetup) wrDrop = Math.max(wrDrop, 0.22);
  if (missedUrgent && features.capturedCount === 0 && features.savedAtariStones === 0) {
    wrDrop = Math.max(wrDrop, 0.16);
  }
  if (features.isEmptyTriangle && features.capturedCount === 0 && features.savedAtariStones === 0 && bestCand && bestCand.idx !== moveIdx) {
    wrDrop = Math.max(wrDrop, 0.08);
  }
  if (bestCand && bestCand.idx === moveIdx) {
    wrDrop = 0;
  } else if (priorDiff < 6 && wrDrop < 0.04) {
    wrDrop = Math.min(wrDrop, 0.02);
  }

  // Assign Grade
  let grade = 'good';
  let gradeLabel = t('gradeGood');
  const isSharpTactical = features.capturedCount > 0 || features.savedAtariStones > 0 || features.putOppInAtari.length > 0 || features.isCut;

  if (wrDrop <= 0.015 && bestCand && (bestCand.idx === moveIdx || isSharpTactical)) {
    grade = isSharpTactical ? 'brilliant' : 'great';
    gradeLabel = isSharpTactical ? t('gradeBrilliant') : t('gradeBest');
  } else if (wrDrop <= 0.035) {
    grade = 'great';
    gradeLabel = t('gradeGreat');
  } else if (wrDrop <= 0.075) {
    grade = 'good';
    gradeLabel = t('gradeGood');
  } else if (wrDrop <= 0.13) {
    grade = 'inaccuracy';
    gradeLabel = t('gradeInaccuracy');
  } else if (wrDrop <= 0.20) {
    grade = 'mistake';
    gradeLabel = t('gradeMistake');
  } else {
    grade = 'blunder';
    gradeLabel = t('gradeBlunder');
  }

  // Craft Specific, Authentic Go Coaching Feedback
  let headline = '';
  let explanation = '';
  const bestLabel = bestCand ? bestCand.coord : '';
  const bestReason = bestCand ? bestCand.reason : '';

  if (features.filledOwnEye) {
    headline = t('evalFillEyeHead', { coord: features.coord });
    const rec = bestLabel ? t('evalRecTry', { coord: bestLabel, reason: bestReason }) : '';
    explanation = t('evalFillEyeExp', { rec });
  } else if (features.selfAtari && !features.isSnapbackSetup) {
    headline = t('evalSelfAtariHead', { coord: features.coord });
    const stones = features.selfAtariSize > 1
      ? t('evalStonesMany', { n: features.selfAtariSize })
      : t('evalStonesOne');
    const rec = bestLabel ? t('evalRecAlt', { coord: bestLabel, reason: bestReason }) : '';
    explanation = t('evalSelfAtariExp', { stones, rec });
  } else if (missedUrgent && bestCand) {
    headline = t('evalMissedUrgentHead', { coord: bestLabel });
    explanation = t('evalMissedUrgentExp', { coord: bestLabel, tag: bestCand.tags[0] });
  } else if (features.isEmptyTriangle && grade !== 'great' && grade !== 'brilliant') {
    headline = t('evalEmptyTriHead', { coord: features.coord });
    const rec = bestLabel ? t('evalRecPrefer', { coord: bestLabel, reason: bestReason }) : '';
    explanation = t('evalEmptyTriExp', { rec });
  } else if (grade === 'brilliant' || grade === 'great') {
    if (features.capturedCount > 0) {
      headline = t('evalCapHead', { coord: features.coord });
      explanation = t('evalCapExp', { n: features.capturedCount });
    } else if (features.savedAtariStones > 0) {
      headline = t('evalSaveHead', { coord: features.coord });
      explanation = t('evalSaveExp', { n: features.savedAtariStones });
    } else if (features.isTigersMouth) {
      headline = t('evalTigerHead', { coord: features.coord });
      explanation = t('evalTigerExp');
    } else if (features.isHane) {
      headline = t('evalHaneHead', { coord: features.coord });
      explanation = t('evalHaneExp');
    } else if (features.isCut) {
      headline = t('evalCutHead', { coord: features.coord });
      explanation = t('evalCutExp');
    } else if (features.putOppInAtari.length > 0) {
      headline = t('evalAtariHead', { coord: features.coord });
      explanation = t('evalAtariExp');
    } else {
      headline = t('evalDirHead', { coord: features.coord });
      explanation = t('evalDirExp');
    }
  } else if (grade === 'good') {
    headline = t('evalGoodHead', { coord: features.coord });
    explanation = bestCand && bestCand.idx !== moveIdx
      ? t('evalGoodExpAlt', { coord: bestLabel, reason: bestReason, drop: (wrDrop * 100).toFixed(1) })
      : t('evalGoodExpSame');
  } else {
    // Inaccuracy / Mistake / Blunder with positional reason
    const stoneCount = countStonesOnBoard(boardBefore);
    if (features.line === 1 && stoneCount < boardBefore.size * boardBefore.size * 0.45) {
      headline = t('evalLine1Head', { coord: features.coord });
      explanation = t('evalLine1Exp', { coord: bestLabel, reason: bestReason });
    } else if (features.line === 2 && stoneCount < 16) {
      headline = t('evalLine2Head', { coord: features.coord });
      explanation = t('evalLine2Exp', { coord: bestLabel });
    } else {
      headline = bestLabel
        ? t('evalBiggerHead', { coord: bestLabel })
        : t('evalSlowHead', { coord: features.coord });
      explanation = bestCand
        ? t('evalSlowExp', { drop: (wrDrop * 100).toFixed(1), coord: bestLabel, reason: bestReason })
        : t('evalSlowFallback');
    }
  }

  return {
    grade,
    gradeLabel,
    winrateDelta: -wrDrop,
    blackWinrateAfter: matchedCand ? matchedCand.blackWinrate : userBlackWr,
    scoreLeadBlack: postStatic.scoreLeadBlack,
    headline,
    explanation,
    bestMoves: preAnalysis.topMoves,
    features,
  };
}
