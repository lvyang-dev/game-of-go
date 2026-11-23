// ============================================================================
// Go Engine — Complete Rules, Tactical/Shape Analysis, Scoring & SGF Export
// ============================================================================

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export function opponent(color) {
  return color === BLACK ? WHITE : BLACK;
}

export const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST'; // 'I' is traditionally skipped in Go

export function coordToLabel(x, y, size) {
  if (x < 0 || y < 0 || x >= size || y >= size) return '虛手';
  return `${COL_LETTERS[x]}${size - y}`;
}

export function labelToCoord(label, size) {
  if (!label || label.toLowerCase() === 'pass') return null;
  const col = COL_LETTERS.indexOf(label[0].toUpperCase());
  const rowNum = parseInt(label.slice(1), 10);
  if (col < 0 || Number.isNaN(rowNum)) return null;
  const y = size - rowNum;
  if (y < 0 || y >= size) return null;
  return { x: col, y };
}

export function getHoshiPoints(size) {
  if (size === 9) {
    return [
      [2, 2], [6, 2],
      [4, 4],
      [2, 6], [6, 6],
    ];
  }
  if (size === 13) {
    return [
      [3, 3], [9, 3],
      [6, 6],
      [3, 9], [9, 9],
      [6, 3], [3, 6], [9, 6], [6, 9],
    ];
  }
  if (size === 19) {
    return [
      [3, 3], [9, 3], [15, 3],
      [3, 9], [9, 9], [15, 9],
      [3, 15], [9, 15], [15, 15],
    ];
  }
  return [];
}

export function getHandicapStones(size, count) {
  if (count < 2) return [];
  const d = size === 9 ? 2 : 3;
  const mid = Math.floor(size / 2);
  const far = size - 1 - d;

  const corners = [
    [far, d],   // Top-Right
    [d, far],   // Bottom-Left
    [far, far], // Bottom-Right
    [d, d],     // Top-Left
  ];
  const center = [mid, mid];
  const sides = [
    [d, mid],   // Left
    [far, mid], // Right
    [mid, d],   // Top
    [mid, far], // Bottom
  ];

  const order = {
    2: [corners[0], corners[1]],
    3: [corners[0], corners[1], corners[2]],
    4: [corners[0], corners[1], corners[2], corners[3]],
    5: [corners[0], corners[1], corners[2], corners[3], center],
    6: [corners[0], corners[1], corners[2], corners[3], sides[0], sides[1]],
    7: [corners[0], corners[1], corners[2], corners[3], sides[0], sides[1], center],
    8: [corners[0], corners[1], corners[2], corners[3], sides[0], sides[1], sides[2], sides[3]],
    9: [corners[0], corners[1], corners[2], corners[3], sides[0], sides[1], sides[2], sides[3], center],
  };

  return order[Math.min(9, Math.max(2, count))] || [];
}

// Deterministic Zobrist hashing for fast position identity / Ko / Superko
const ZOBRIST_CACHE = new Map();

function getZobristTable(size) {
  if (ZOBRIST_CACHE.has(size)) return ZOBRIST_CACHE.get(size);
  let seed = 0x9e3779b9 ^ (size * 2654435761);
  const nextRand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
  const len = size * size;
  const table = {
    hi: [new Uint32Array(len), new Uint32Array(len), new Uint32Array(len)],
    lo: [new Uint32Array(len), new Uint32Array(len), new Uint32Array(len)],
  };
  for (let c = 1; c <= 2; c++) {
    for (let i = 0; i < len; i++) {
      table.hi[c][i] = nextRand();
      table.lo[c][i] = nextRand();
    }
  }
  ZOBRIST_CACHE.set(size, table);
  return table;
}

// Precomputed orthogonal neighbor lookup table per board size
const NEIGHBOR_CACHE = new Map();

export function getNeighborTable(size) {
  if (NEIGHBOR_CACHE.has(size)) return NEIGHBOR_CACHE.get(size);
  const total = size * size;
  const ortho = new Array(total);
  const diag = new Array(total);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const o = [];
      if (y > 0) o.push(idx - size);
      if (y < size - 1) o.push(idx + size);
      if (x > 0) o.push(idx - 1);
      if (x < size - 1) o.push(idx + 1);
      ortho[idx] = o;

      const d = [];
      if (y > 0 && x > 0) d.push(idx - size - 1);
      if (y > 0 && x < size - 1) d.push(idx - size + 1);
      if (y < size - 1 && x > 0) d.push(idx + size - 1);
      if (y < size - 1 && x < size - 1) d.push(idx + size + 1);
      diag[idx] = d;
    }
  }
  const tables = { ortho, diag };
  NEIGHBOR_CACHE.set(size, tables);
  return tables;
}

export class GoBoard {
  constructor(size = 9) {
    this.size = size;
    this.grid = new Uint8Array(size * size);
    this.koPoint = -1;
    this.captures = { [BLACK]: 0, [WHITE]: 0 };
    this.hashHi = 0;
    this.hashLo = 0;
    this._zobrist = getZobristTable(size);
    const tables = getNeighborTable(size);
    this._ortho = tables.ortho;
    this._diag = tables.diag;
  }

  clone() {
    const b = new GoBoard(this.size);
    b.grid.set(this.grid);
    b.koPoint = this.koPoint;
    b.captures[BLACK] = this.captures[BLACK];
    b.captures[WHITE] = this.captures[WHITE];
    b.hashHi = this.hashHi;
    b.hashLo = this.hashLo;
    return b;
  }

  idx(x, y) {
    return y * this.size + x;
  }

  xy(index) {
    return { x: index % this.size, y: Math.floor(index / this.size) };
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return -1;
    return this.grid[y * this.size + x];
  }

  setRaw(x, y, color) {
    const i = y * this.size + x;
    const prev = this.grid[i];
    if (prev === color) return;
    if (prev !== EMPTY) {
      this.hashHi = (this.hashHi ^ this._zobrist.hi[prev][i]) >>> 0;
      this.hashLo = (this.hashLo ^ this._zobrist.lo[prev][i]) >>> 0;
    }
    this.grid[i] = color;
    if (color !== EMPTY) {
      this.hashHi = (this.hashHi ^ this._zobrist.hi[color][i]) >>> 0;
      this.hashLo = (this.hashLo ^ this._zobrist.lo[color][i]) >>> 0;
    }
  }

  hashKey() {
    return `${this.hashHi}:${this.hashLo}`;
  }

  getGroup(startIdx) {
    const color = this.grid[startIdx];
    if (color === EMPTY) return { color: EMPTY, stones: [], liberties: new Set() };
    const stones = [];
    const liberties = new Set();
    const visited = new Uint8Array(this.size * this.size);
    const stack = [startIdx];
    visited[startIdx] = 1;

    while (stack.length > 0) {
      const curr = stack.pop();
      stones.push(curr);
      const neighbors = this._ortho[curr];
      for (let k = 0; k < neighbors.length; k++) {
        const n = neighbors[k];
        const nc = this.grid[n];
        if (nc === EMPTY) {
          liberties.add(n);
        } else if (nc === color && !visited[n]) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    return { color, stones, liberties };
  }

  // Fast liberty count capped at maxCount for hot loops
  countLibertiesUpTo(startIdx, maxCount = 3) {
    const color = this.grid[startIdx];
    if (color === EMPTY) return 0;
    const total = this.size * this.size;
    const visited = new Uint8Array(total);
    const libSeen = new Uint8Array(total);
    let libCount = 0;
    const stack = [startIdx];
    visited[startIdx] = 1;

    while (stack.length > 0) {
      const curr = stack.pop();
      const neighbors = this._ortho[curr];
      for (let k = 0; k < neighbors.length; k++) {
        const n = neighbors[k];
        const nc = this.grid[n];
        if (nc === EMPTY) {
          if (!libSeen[n]) {
            libSeen[n] = 1;
            libCount++;
            if (libCount >= maxCount) return libCount;
          }
        } else if (nc === color && !visited[n]) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    return libCount;
  }

  getAllGroups() {
    const total = this.size * this.size;
    const visited = new Uint8Array(total);
    const groups = [];
    for (let i = 0; i < total; i++) {
      const color = this.grid[i];
      if (color === EMPTY || visited[i]) continue;
      const stones = [];
      const liberties = new Set();
      const stack = [i];
      visited[i] = 1;
      while (stack.length > 0) {
        const curr = stack.pop();
        stones.push(curr);
        const neighbors = this._ortho[curr];
        for (let k = 0; k < neighbors.length; k++) {
          const n = neighbors[k];
          const nc = this.grid[n];
          if (nc === EMPTY) {
            liberties.add(n);
          } else if (nc === color && !visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        }
      }
      groups.push({ color, stones, liberties });
    }
    return groups;
  }

  playIdx(moveIdx, color, superkoSet = null) {
    if (moveIdx < 0 || moveIdx >= this.size * this.size) {
      return { legal: false, reason: '超出棋盤範圍' };
    }
    if (this.grid[moveIdx] !== EMPTY) {
      return { legal: false, reason: '此交叉點已有棋子' };
    }
    if (moveIdx === this.koPoint) {
      return { legal: false, reason: '打劫不可立即提回——請先在別處尋劫' };
    }

    const opp = opponent(color);
    const prevHashHi = this.hashHi;
    const prevHashLo = this.hashLo;
    const prevKo = this.koPoint;

    // Tentatively place stone
    this.grid[moveIdx] = color;
    this.hashHi = (this.hashHi ^ this._zobrist.hi[color][moveIdx]) >>> 0;
    this.hashLo = (this.hashLo ^ this._zobrist.lo[color][moveIdx]) >>> 0;

    // Check adjacent opponent groups for capture
    const captured = [];
    const neighbors = this._ortho[moveIdx];
    const checkedOpp = new Set();

    for (let k = 0; k < neighbors.length; k++) {
      const n = neighbors[k];
      if (this.grid[n] === opp && !checkedOpp.has(n)) {
        const grp = this.getGroup(n);
        for (let j = 0; j < grp.stones.length; j++) checkedOpp.add(grp.stones[j]);
        if (grp.liberties.size === 0) {
          for (let j = 0; j < grp.stones.length; j++) {
            const s = grp.stones[j];
            this.grid[s] = EMPTY;
            this.hashHi = (this.hashHi ^ this._zobrist.hi[opp][s]) >>> 0;
            this.hashLo = (this.hashLo ^ this._zobrist.lo[opp][s]) >>> 0;
            captured.push(s);
          }
        }
      }
    }

    // Suicide check
    const myGroup = this.getGroup(moveIdx);
    if (myGroup.liberties.size === 0) {
      // Revert
      this.grid[moveIdx] = EMPTY;
      for (let j = 0; j < captured.length; j++) {
        this.grid[captured[j]] = opp;
      }
      this.hashHi = prevHashHi;
      this.hashLo = prevHashLo;
      this.koPoint = prevKo;
      return { legal: false, reason: '禁著點（落子無氣，不可自殺）' };
    }

    // Positional Superko check (optional)
    if (superkoSet && superkoSet.has(this.hashKey())) {
      this.grid[moveIdx] = EMPTY;
      for (let j = 0; j < captured.length; j++) {
        this.grid[captured[j]] = opp;
      }
      this.hashHi = prevHashHi;
      this.hashLo = prevHashLo;
      this.koPoint = prevKo;
      return { legal: false, reason: '違反同形再現規則（全局同形禁著）' };
    }

    // Determine simple Ko point
    if (captured.length === 1 && myGroup.stones.length === 1 && myGroup.liberties.size === 1) {
      this.koPoint = captured[0];
    } else {
      this.koPoint = -1;
    }

    this.captures[color] += captured.length;

    return {
      legal: true,
      captured,
      koPoint: this.koPoint,
      myGroup,
    };
  }

  play(x, y, color, superkoSet = null) {
    return this.playIdx(y * this.size + x, color, superkoSet);
  }

  pass() {
    this.koPoint = -1;
  }

  isLegalIdx(moveIdx, color, superkoSet = null) {
    if (moveIdx < 0 || moveIdx >= this.size * this.size) return false;
    if (this.grid[moveIdx] !== EMPTY) return false;
    if (moveIdx === this.koPoint) return false;

    const neighbors = this._ortho[moveIdx];
    const opp = opponent(color);

    // Quick accept: if any orthogonal neighbor is empty and no superko needed
    if (!superkoSet) {
      for (let k = 0; k < neighbors.length; k++) {
        if (this.grid[neighbors[k]] === EMPTY) return true;
      }
    }

    // Full check on clone (rare path when surrounded or checking superko)
    const copy = this.clone();
    return copy.playIdx(moveIdx, color, superkoSet).legal;
  }

  isTrueEye(idx, color) {
    if (this.grid[idx] !== EMPTY) return false;
    const ortho = this._ortho[idx];
    for (let k = 0; k < ortho.length; k++) {
      if (this.grid[ortho[k]] !== color) return false;
    }
    const diag = this._diag[idx];
    const opp = opponent(color);
    let oppDiag = 0;
    for (let k = 0; k < diag.length; k++) {
      if (this.grid[diag[k]] === opp) oppDiag++;
    }
    // On edge or corner (fewer than 4 diagonals), 0 enemy diagonals allowed; in center, at most 1
    if (diag.length < 4) return oppDiag === 0;
    return oppDiag <= 1;
  }

  // Distance from nearest edge: 1 = 1st line, 2 = 2nd line, etc.
  lineOf(idx) {
    const x = idx % this.size;
    const y = Math.floor(idx / this.size);
    return Math.min(x, y, this.size - 1 - x, this.size - 1 - y) + 1;
  }
}

// ============================================================================
// Influence & Territory Estimation + Scoring
// ============================================================================

export function estimateInfluence(board, deadStonesSet = null) {
  const size = board.size;
  const total = size * size;
  let field = new Float32Array(total);
  const ortho = board._ortho;

  for (let i = 0; i < total; i++) {
    const c = board.grid[i];
    if (c === EMPTY) continue;
    const isDead = deadStonesSet && deadStonesSet.has(i);
    if (c === BLACK) field[i] = isDead ? -0.8 : 1.0;
    else if (c === WHITE) field[i] = isDead ? 0.8 : -1.0;
  }

  // Iterative diffusion + slight dampening (smooth realistic Go influence)
  const iterations = size === 9 ? 6 : size === 13 ? 8 : 10;
  let next = new Float32Array(total);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < total; i++) {
      const c = board.grid[i];
      const isDead = deadStonesSet && deadStonesSet.has(i);
      if (c !== EMPTY && !isDead) {
        next[i] = c === BLACK ? 1.0 : -1.0;
        continue;
      }
      const neighbors = ortho[i];
      let sum = field[i] * 0.45;
      const weight = 0.55 / neighbors.length;
      for (let k = 0; k < neighbors.length; k++) {
        sum += field[neighbors[k]] * weight;
      }
      next[i] = Math.max(-1, Math.min(1, sum));
    }
    const tmp = field;
    field = next;
    next = tmp;
  }

  // Reinforce strictly enclosed empty regions (exact territory flood-fill)
  const visited = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const c = board.grid[i];
    const treatEmpty = c === EMPTY || (deadStonesSet && deadStonesSet.has(i));
    if (!treatEmpty || visited[i]) continue;

    const region = [];
    let touchesBlack = false;
    let touchesWhite = false;
    const stack = [i];
    visited[i] = 1;

    while (stack.length > 0) {
      const curr = stack.pop();
      region.push(curr);
      const neighbors = ortho[curr];
      for (let k = 0; k < neighbors.length; k++) {
        const n = neighbors[k];
        const nc = board.grid[n];
        const nDead = deadStonesSet && deadStonesSet.has(n);
        if (nc === EMPTY || nDead) {
          if (!visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        } else if (nc === BLACK) {
          touchesBlack = true;
        } else if (nc === WHITE) {
          touchesWhite = true;
        }
      }
    }

    if (touchesBlack && !touchesWhite) {
      for (let k = 0; k < region.length; k++) field[region[k]] = 0.96;
    } else if (touchesWhite && !touchesBlack) {
      for (let k = 0; k < region.length; k++) field[region[k]] = -0.96;
    }
  }

  return field;
}

export function calculateScore(board, komi = 6.5, deadStonesSet = new Set(), rules = 'chinese') {
  const size = board.size;
  const total = size * size;
  const ortho = board._ortho;

  const territoryMap = new Int8Array(total); // 1 = Black, -1 = White, 0 = Neutral/Dame
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let blackStones = 0;
  let whiteStones = 0;
  let deadBlack = 0;
  let deadWhite = 0;

  for (let i = 0; i < total; i++) {
    const c = board.grid[i];
    const isDead = deadStonesSet.has(i);
    if (c === BLACK) {
      if (isDead) deadBlack++;
      else {
        blackStones++;
        territoryMap[i] = 1;
      }
    } else if (c === WHITE) {
      if (isDead) deadWhite++;
      else {
        whiteStones++;
        territoryMap[i] = -1;
      }
    }
  }

  const visited = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const c = board.grid[i];
    const isDead = deadStonesSet.has(i);
    if ((c !== EMPTY && !isDead) || visited[i]) continue;

    const region = [];
    let touchesBlack = false;
    let touchesWhite = false;
    const stack = [i];
    visited[i] = 1;

    while (stack.length > 0) {
      const curr = stack.pop();
      region.push(curr);
      const neighbors = ortho[curr];
      for (let k = 0; k < neighbors.length; k++) {
        const n = neighbors[k];
        const nc = board.grid[n];
        const nDead = deadStonesSet.has(n);
        if (nc === EMPTY || nDead) {
          if (!visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        } else if (nc === BLACK) {
          touchesBlack = true;
        } else if (nc === WHITE) {
          touchesWhite = true;
        }
      }
    }

    if (touchesBlack && !touchesWhite) {
      for (let k = 0; k < region.length; k++) {
        territoryMap[region[k]] = 1;
        blackTerritory++;
      }
    } else if (touchesWhite && !touchesBlack) {
      for (let k = 0; k < region.length; k++) {
        territoryMap[region[k]] = -1;
        whiteTerritory++;
      }
    }
  }

  let blackTotal, whiteTotal;
  if (rules === 'japanese') {
    blackTotal = blackTerritory + board.captures[BLACK] + deadWhite;
    whiteTotal = whiteTerritory + board.captures[WHITE] + deadBlack + komi;
  } else {
    // Chinese (Area) scoring — simplest & standard for AI evaluation
    blackTotal = blackTerritory + blackStones;
    whiteTotal = whiteTerritory + whiteStones + komi;
  }

  const diff = blackTotal - whiteTotal;
  return {
    rules,
    blackTerritory,
    whiteTerritory,
    blackStones,
    whiteStones,
    blackCaptures: board.captures[BLACK],
    whiteCaptures: board.captures[WHITE],
    deadBlack,
    deadWhite,
    komi,
    blackTotal,
    whiteTotal,
    winner: diff > 0 ? BLACK : WHITE,
    margin: Math.abs(diff),
    territoryMap,
  };
}

// Estimate alive/dead status heuristically for automatic scoring suggestion
export function suggestDeadStones(board) {
  const dead = new Set();
  const influence = estimateInfluence(board);
  const groups = board.getAllGroups();
  for (const grp of groups) {
    if (grp.liberties.size >= 4) continue;
    // Check average surrounding influence
    let oppPressure = 0;
    let count = 0;
    for (const s of grp.stones) {
      for (const n of board._ortho[s]) {
        if (board.grid[n] !== grp.color) {
          oppPressure += grp.color === BLACK ? -influence[n] : influence[n];
          count++;
        }
      }
    }
    const avg = count > 0 ? oppPressure / count : 0;
    if (grp.stones.length <= 4 && grp.liberties.size <= 2 && avg > 0.55) {
      for (const s of grp.stones) dead.add(s);
    }
  }
  return dead;
}

// ============================================================================
// Tactical & Shape Feature Detector (Powers AI Heuristics & Live Coach)
// ============================================================================

export function detectMoveFeatures(prevBoard, moveIdx, color, nextBoard, captured) {
  const size = prevBoard.size;
  const x = moveIdx % size;
  const y = Math.floor(moveIdx / size);
  const opp = opponent(color);
  const ortho = prevBoard._ortho[moveIdx];
  const diag = prevBoard._diag[moveIdx];

  const features = {
    coord: coordToLabel(x, y, size),
    line: prevBoard.lineOf(moveIdx),
    capturedCount: captured.length,
    savedAtariStones: 0,
    putOppInAtari: [],
    selfAtari: false,
    selfAtariSize: 0,
    filledOwnEye: prevBoard.isTrueEye(moveIdx, color) && captured.length === 0,
    isEmptyTriangle: false,
    isTigersMouth: false,
    isBambooJoint: false,
    isHane: false,
    isCut: false,
    isConnect: false,
    isCornerPoint: false,
    isApproach: false,
    isEnclosure: false,
    isSnapbackSetup: false,
  };

  // 1. Check if this move saved a friendly group in Atari
  const friendlyGroupsBefore = new Set();
  const seenFriendly = new Set();
  for (const n of ortho) {
    if (prevBoard.grid[n] === color && !seenFriendly.has(n)) {
      const grp = prevBoard.getGroup(n);
      for (const s of grp.stones) seenFriendly.add(s);
      friendlyGroupsBefore.add(grp);
    }
  }
  const newGroup = nextBoard.getGroup(moveIdx);
  if (friendlyGroupsBefore.size >= 2) {
    features.isConnect = true;
  }
  for (const grp of friendlyGroupsBefore) {
    if (grp.liberties.size === 1 && newGroup.liberties.size >= 2) {
      features.savedAtariStones += grp.stones.length;
    }
  }

  // 2. Self-atari check
  if (newGroup.liberties.size === 1 && captured.length === 0) {
    // Check if it might be a throw-in / snapback (adjacent enemy group has 2 liberties and we reduced it to 1)
    let reducesOppToAtari = false;
    for (const n of ortho) {
      if (nextBoard.grid[n] === opp && nextBoard.countLibertiesUpTo(n, 2) === 1) {
        reducesOppToAtari = true;
      }
    }
    if (reducesOppToAtari && newGroup.stones.length === 1) {
      features.isSnapbackSetup = true;
    } else {
      features.selfAtari = true;
      features.selfAtariSize = newGroup.stones.length;
    }
  }

  // 3. Put opponent groups into Atari
  const seenOpp = new Set();
  for (const n of ortho) {
    if (nextBoard.grid[n] === opp && !seenOpp.has(n)) {
      const grp = nextBoard.getGroup(n);
      for (const s of grp.stones) seenOpp.add(s);
      if (grp.liberties.size === 1) {
        features.putOppInAtari.push({
          size: grp.stones.length,
          liberty: [...grp.liberties][0],
        });
      }
    }
  }

  // 4. Empty Triangle check (2x2 square with 3 friendly stones and 1 empty, no capture)
  if (captured.length === 0) {
    const offsets = [
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      [[-1, 0], [0, 0], [-1, 1], [0, 1]],
      [[0, -1], [1, -1], [0, 0], [1, 0]],
      [[-1, -1], [0, -1], [-1, 0], [0, 0]],
    ];
    for (const sq of offsets) {
      let fCount = 0;
      let eCount = 0;
      let valid = true;
      for (const [dx, dy] of sq) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
          valid = false;
          break;
        }
        const v = nextBoard.get(nx, ny);
        if (v === color) fCount++;
        else if (v === EMPTY) eCount++;
      }
      if (valid && fCount === 3 && eCount === 1) {
        features.isEmptyTriangle = true;
        break;
      }
    }
  }

  // 5. Tiger's Mouth (Kake-tsugi): diagonal friendly + orthogonal empty mouth surrounded by friendly
  let friendlyDiag = 0;
  let oppOrtho = 0;
  let friendlyOrtho = 0;
  for (const n of ortho) {
    if (prevBoard.grid[n] === opp) oppOrtho++;
    if (prevBoard.grid[n] === color) friendlyOrtho++;
  }
  for (const d of diag) {
    if (prevBoard.grid[d] === color) friendlyDiag++;
  }
  if (friendlyDiag >= 2 && friendlyOrtho === 0) {
    // Check if an adjacent empty intersection now has 3 friendly neighbors (classic tiger's mouth)
    for (const n of ortho) {
      if (nextBoard.grid[n] === EMPTY) {
        let fAround = 0;
        for (const nn of nextBoard._ortho[n]) {
          if (nextBoard.grid[nn] === color) fAround++;
        }
        if (fAround >= 3) {
          features.isTigersMouth = true;
          break;
        }
      }
    }
  }

  // 6. Hane: diagonal to friendly stone AND orthogonally touching an enemy stone that touches that friendly stone
  if (oppOrtho >= 1 && friendlyDiag >= 1 && friendlyOrtho === 0) {
    for (const d of diag) {
      if (prevBoard.grid[d] !== color) continue;
      for (const n of ortho) {
        if (prevBoard.grid[n] === opp && prevBoard._ortho[d].includes(n)) {
          features.isHane = true;
          break;
        }
      }
      if (features.isHane) break;
    }
  }

  // 7. Cut: orthogonally adjacent to 2 separate enemy groups (or 2 enemy stones on perpendicular sides)
  const oppGroupsAdj = new Set();
  const seenOppCut = new Set();
  for (const n of ortho) {
    if (prevBoard.grid[n] === opp && !seenOppCut.has(n)) {
      const grp = prevBoard.getGroup(n);
      for (const s of grp.stones) seenOppCut.add(s);
      oppGroupsAdj.add(grp);
    }
  }
  if (oppGroupsAdj.size >= 2) {
    features.isCut = true;
  }

  // 8. Corner opening points (3-3, 3-4, 4-4)
  const dxEdge = Math.min(x, size - 1 - x) + 1;
  const dyEdge = Math.min(y, size - 1 - y) + 1;
  if ((dxEdge === 3 || dxEdge === 4) && (dyEdge === 3 || dyEdge === 4)) {
    features.isCornerPoint = true;
  }

  return features;
}

// ============================================================================
// GoGame — Full Game Controller with History, Undo, Branch Review & SGF
// ============================================================================

export class GoGame {
  constructor({ size = 9, komi = 6.5, handicap = 0, rules = 'chinese' } = {}) {
    this.size = size;
    this.komi = handicap >= 2 ? 0.5 : komi;
    this.handicap = handicap;
    this.rules = rules;
    this.reset();
  }

  reset() {
    this.board = new GoBoard(this.size);
    this.handicapCoords = [];
    if (this.handicap >= 2) {
      const stones = getHandicapStones(this.size, this.handicap);
      for (const [x, y] of stones) {
        this.board.setRaw(x, y, BLACK);
        this.handicapCoords.push({ x, y });
      }
      this.turn = WHITE;
    } else {
      this.turn = BLACK;
    }

    this.moves = []; // { moveNum, color, x, y, pass, captured, boardBefore, boardAfter, analysis? }
    this.positionHashes = new Set([this.board.hashKey()]);
    this.consecutivePasses = 0;
    this.gameOver = false;
    this.resignedBy = null;
    this.phase = 'playing'; // 'playing' | 'scoring' | 'finished'
    this.deadStones = new Set();
    this.finalScore = null;
  }

  playMove(x, y) {
    if (this.phase !== 'playing') {
      return { legal: false, reason: '目前非對弈階段' };
    }
    const boardBefore = this.board.clone();
    const color = this.turn;
    const res = this.board.play(x, y, color, this.positionHashes);
    if (!res.legal) return res;

    this.consecutivePasses = 0;
    this.positionHashes.add(this.board.hashKey());
    const moveRecord = {
      moveNum: this.moves.length + 1,
      color,
      x,
      y,
      idx: y * this.size + x,
      pass: false,
      captured: res.captured,
      boardBefore,
      boardAfter: this.board.clone(),
      analysis: null,
    };
    this.moves.push(moveRecord);
    this.turn = opponent(color);
    return { legal: true, move: moveRecord };
  }

  playPass() {
    if (this.phase !== 'playing') return { legal: false };
    const boardBefore = this.board.clone();
    const color = this.turn;
    this.board.pass();
    this.consecutivePasses++;

    const moveRecord = {
      moveNum: this.moves.length + 1,
      color,
      x: -1,
      y: -1,
      idx: -1,
      pass: true,
      captured: [],
      boardBefore,
      boardAfter: this.board.clone(),
      analysis: null,
    };
    this.moves.push(moveRecord);
    this.turn = opponent(color);

    if (this.consecutivePasses >= 2) {
      this.enterScoringPhase();
    }
    return { legal: true, move: moveRecord, enteredScoring: this.phase === 'scoring' };
  }

  enterScoringPhase() {
    this.phase = 'scoring';
    this.deadStones = suggestDeadStones(this.board);
  }

  resumePlaying() {
    if (this.phase === 'scoring') {
      this.phase = 'playing';
      this.consecutivePasses = 0;
      this.deadStones = new Set();
    }
  }

  toggleDeadGroup(x, y) {
    if (this.phase !== 'scoring') return;
    const idx = y * this.size + x;
    if (this.board.grid[idx] === EMPTY) return;
    const grp = this.board.getGroup(idx);
    const shouldMarkDead = !this.deadStones.has(idx);
    for (const s of grp.stones) {
      if (shouldMarkDead) this.deadStones.add(s);
      else this.deadStones.delete(s);
    }
  }

  finalizeScore() {
    this.finalScore = calculateScore(this.board, this.komi, this.deadStones, this.rules);
    this.phase = 'finished';
    this.gameOver = true;
    return this.finalScore;
  }

  resign(color) {
    this.resignedBy = color;
    this.phase = 'finished';
    this.gameOver = true;
    this.finalScore = {
      resigned: true,
      resignedBy: color,
      winner: opponent(color),
    };
    return this.finalScore;
  }

  undo(steps = 1) {
    if (this.moves.length === 0) return false;
    const actualSteps = Math.min(steps, this.moves.length);
    for (let i = 0; i < actualSteps; i++) {
      this.moves.pop();
    }
    // Rebuild position hashes and board from last remaining move
    this.positionHashes = new Set();
    const fresh = new GoBoard(this.size);
    for (const { x, y } of this.handicapCoords) {
      fresh.setRaw(x, y, BLACK);
    }
    this.positionHashes.add(fresh.hashKey());

    if (this.moves.length === 0) {
      this.board = fresh;
      this.turn = this.handicap >= 2 ? WHITE : BLACK;
      this.consecutivePasses = 0;
    } else {
      for (const m of this.moves) {
        this.positionHashes.add(m.boardAfter.hashKey());
      }
      const last = this.moves[this.moves.length - 1];
      this.board = last.boardAfter.clone();
      this.turn = opponent(last.color);
      this.consecutivePasses = last.pass ? 1 : 0;
    }

    this.phase = 'playing';
    this.gameOver = false;
    this.resignedBy = null;
    this.deadStones = new Set();
    this.finalScore = null;
    return true;
  }

  getBoardAtMove(moveIndex) {
    // moveIndex: 0 = initial board, k = after move k
    if (moveIndex <= 0 || this.moves.length === 0) {
      const fresh = new GoBoard(this.size);
      for (const { x, y } of this.handicapCoords) fresh.setRaw(x, y, BLACK);
      return fresh;
    }
    const clamped = Math.min(moveIndex, this.moves.length);
    return this.moves[clamped - 1].boardAfter;
  }

  exportSGF(playerColor = BLACK, aiLabel = '師範 AI') {
    const sgfCoord = (x, y) => {
      if (x < 0 || y < 0) return '';
      return String.fromCharCode(97 + x) + String.fromCharCode(97 + y);
    };
    const pb = playerColor === BLACK ? '玩家' : aiLabel;
    const pw = playerColor === WHITE ? '玩家' : aiLabel;
    let resStr = '';
    if (this.finalScore) {
      if (this.finalScore.resigned) {
        resStr = `${this.finalScore.winner === BLACK ? 'B' : 'W'}+R`;
      } else {
        resStr = `${this.finalScore.winner === BLACK ? 'B' : 'W'}+${this.finalScore.margin.toFixed(1)}`;
      }
    }
    let sgf = `(;GM[1]FF[4]CA[UTF-8]AP[KayaSenseiGo:1.0]SZ[${this.size}]KM[${this.komi}]PB[${pb}]PW[${pw}]`;
    if (this.handicap >= 2) {
      sgf += `HA[${this.handicap}]AB`;
      for (const { x, y } of this.handicapCoords) {
        sgf += `[${sgfCoord(x, y)}]`;
      }
    }
    if (resStr) sgf += `RE[${resStr}]`;
    for (const m of this.moves) {
      const tag = m.color === BLACK ? 'B' : 'W';
      sgf += `;${tag}[${m.pass ? '' : sgfCoord(m.x, m.y)}]`;
    }
    sgf += ')';
    return sgf;
  }
}
