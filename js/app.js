// ============================================================================
// Kaya Sensei — Main Application Controller
// Connects GoEngine, GoAI & Coach, Practice Dojo, Audio, and GobanRenderer
// ============================================================================

import {
  EMPTY,
  BLACK,
  WHITE,
  opponent,
  coordToLabel,
  labelToCoord,
  GoBoard,
  GoGame,
  estimateInfluence,
  calculateScore,
} from './engine.js';

import {
  DIFFICULTY_PRESETS,
  evaluateBoardStatic,
  analyzePositionAsync,
  evaluateUserMoveAsync,
} from './ai.js';

import { PUZZLE_CATEGORIES, PUZZLES } from './puzzles.js';
import { GobanRenderer } from './board-renderer.js';
import { sound } from './audio.js';
import { neuralEngine, NN_MODEL_PRESETS } from './nn-engine.js';

const STORAGE_SOLVED_KEY = 'kaya_sensei_solved_v1';
const STORAGE_SETTINGS_KEY = 'kaya_sensei_settings_v1';

// ============================================================================
// Application State
// ============================================================================

const state = {
  mode: 'play', // 'play' | 'dojo'

  // Game settings
  settings: {
    size: 9,
    difficulty: 'club',
    playerColor: BLACK,
    handicap: 0,
    coachEnabled: true,
    rules: 'chinese',
  },

  // Play mode runtime
  game: null,
  reviewIndex: null, // null = live latest move; number = viewing move index 0..moves.length
  aiThinking: false,
  aiRunId: 0, // cancellation token for async AI calls
  hover: null,
  activeHints: [], // [{ x, y, coord, playerWinrate, reason }]
  showTerritory: false,
  showAtari: true,
  showNumbers: false,
  latestOwnershipMap: null,
  winrateHistory: [], // [{ moveNum, blackWinrate, scoreLeadBlack, grade?, color? }]
  lastUserMoveNum: null,

  // Dojo mode runtime
  dojoCategory: 'all',
  dojoPuzzleIndex: 0,
  dojoBoard: null,
  dojoNode: null,
  dojoStep: 0,
  dojoStatus: 'playing', // 'playing' | 'animating' | 'wrong' | 'solved'
  dojoLastMove: null,
  dojoHintLevel: 0,
  dojoSolvedSet: new Set(),
};

// Load saved Dojo progress & last game settings
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_SOLVED_KEY) || '[]');
  if (Array.isArray(saved)) {
    saved.forEach((id) => state.dojoSolvedSet.add(id));
  }
} catch {
  // Ignore storage errors
}

try {
  const savedSettings = JSON.parse(localStorage.getItem(STORAGE_SETTINGS_KEY) || 'null');
  if (savedSettings && typeof savedSettings === 'object') {
    if ([9, 13, 19].includes(savedSettings.size)) state.settings.size = savedSettings.size;
    if (savedSettings.difficulty && DIFFICULTY_PRESETS[savedSettings.difficulty]) {
      state.settings.difficulty = savedSettings.difficulty;
    }
    if (savedSettings.playerColor === BLACK || savedSettings.playerColor === WHITE) {
      state.settings.playerColor = savedSettings.playerColor;
    }
    if (typeof savedSettings.handicap === 'number' && savedSettings.handicap >= 0 && savedSettings.handicap <= 9) {
      state.settings.handicap = savedSettings.handicap;
    }
    if (typeof savedSettings.coachEnabled === 'boolean') {
      state.settings.coachEnabled = savedSettings.coachEnabled;
    }
    if (savedSettings.rules === 'chinese' || savedSettings.rules === 'japanese') {
      state.settings.rules = savedSettings.rules;
    }
  }
} catch {
  // Ignore storage errors
}

function persistSolved() {
  try {
    localStorage.setItem(STORAGE_SOLVED_KEY, JSON.stringify([...state.dojoSolvedSet]));
  } catch {
    // Ignore
  }
}

function persistSettings() {
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(state.settings));
  } catch {
    // Ignore
  }
}

// ============================================================================
// DOM References
// ============================================================================

const el = {
  canvas: document.getElementById('goban-canvas'),
  gobanFrame: document.getElementById('goban-frame'),
  boardToast: document.getElementById('board-toast'),

  // Tabs & Header
  tabPlay: document.getElementById('tab-play'),
  tabDojo: document.getElementById('tab-dojo'),
  dojoBadgeCount: document.getElementById('dojo-badge-count'),
  btnNewGame: document.getElementById('btn-new-game'),
  btnSound: document.getElementById('btn-sound'),
  iconSoundOn: document.getElementById('icon-sound-on'),
  iconSoundOff: document.getElementById('icon-sound-off'),

  // Strips & Toolbars
  playStrip: document.getElementById('play-strip'),
  dojoStrip: document.getElementById('dojo-strip'),
  playToolbar: document.getElementById('play-toolbar'),
  dojoToolbar: document.getElementById('dojo-toolbar'),
  sidebarPlay: document.getElementById('sidebar-play'),
  sidebarDojo: document.getElementById('sidebar-dojo'),

  // Play Strip elements
  playerBlackCard: document.getElementById('player-black-card'),
  playerWhiteCard: document.getElementById('player-white-card'),
  blackName: document.getElementById('black-name'),
  whiteName: document.getElementById('white-name'),
  blackCaptures: document.getElementById('black-captures'),
  whiteCaptures: document.getElementById('white-captures'),
  turnStatus: document.getElementById('turn-status'),
  gameMetaPill: document.getElementById('game-meta-pill'),

  // Play Toolbar buttons
  btnUndo: document.getElementById('btn-undo'),
  btnPass: document.getElementById('btn-pass'),
  btnResign: document.getElementById('btn-resign'),
  btnNavStart: document.getElementById('btn-nav-start'),
  btnNavPrev: document.getElementById('btn-nav-prev'),
  btnNavNext: document.getElementById('btn-nav-next'),
  btnNavEnd: document.getElementById('btn-nav-end'),
  moveCounter: document.getElementById('move-counter'),
  btnToggleTerritory: document.getElementById('btn-toggle-territory'),
  btnToggleAtari: document.getElementById('btn-toggle-atari'),
  btnToggleNumbers: document.getElementById('btn-toggle-numbers'),
  btnExportSgf: document.getElementById('btn-export-sgf'),

  // Coach Card
  toggleCoach: document.getElementById('toggle-coach'),
  coachBody: document.getElementById('coach-body'),
  coachPausedMsg: document.getElementById('coach-paused-msg'),
  coachGradeRow: document.getElementById('coach-grade-row'),
  coachGradeBadge: document.getElementById('coach-grade-badge'),
  coachDelta: document.getElementById('coach-delta'),
  coachHeadline: document.getElementById('coach-headline'),
  coachExplanation: document.getElementById('coach-explanation'),
  btnAskHint: document.getElementById('btn-ask-hint'),
  btnRetryMove: document.getElementById('btn-retry-move'),
  coachCandidates: document.getElementById('coach-candidates'),

  // Winrate Card
  scoreLeadBadge: document.getElementById('score-lead-badge'),
  wrBlackPct: document.getElementById('wr-black-pct'),
  wrWhitePct: document.getElementById('wr-white-pct'),
  wrBlackFill: document.getElementById('wr-black-fill'),
  winrateGraph: document.getElementById('winrate-graph'),

  // Scoring & Post-Game Card
  scoringCard: document.getElementById('scoring-card'),
  scoringTitle: document.getElementById('scoring-title'),
  scoringInstructions: document.getElementById('scoring-instructions'),
  scoreBreakdown: document.getElementById('score-breakdown'),
  scoringActions: document.getElementById('scoring-actions'),
  btnAcceptScore: document.getElementById('btn-accept-score'),
  btnResumePlay: document.getElementById('btn-resume-play'),
  ruleChinese: document.getElementById('rule-chinese'),
  ruleJapanese: document.getElementById('rule-japanese'),
  postgameReview: document.getElementById('postgame-review'),
  keyMomentsList: document.getElementById('key-moments-list'),

  // Dojo Elements
  dojoCatTag: document.getElementById('dojo-cat-tag'),
  dojoBoardTitle: document.getElementById('dojo-board-title'),
  dojoRankPill: document.getElementById('dojo-rank-pill'),
  dojoSolvedPill: document.getElementById('dojo-solved-pill'),
  dojoStepIndicator: document.getElementById('dojo-step-indicator'),
  dojoGoal: document.getElementById('dojo-goal'),
  dojoBriefing: document.getElementById('dojo-briefing'),
  dojoFeedback: document.getElementById('dojo-feedback'),
  dojoFeedbackTitle: document.getElementById('dojo-feedback-title'),
  dojoFeedbackBody: document.getElementById('dojo-feedback-body'),
  dojoFeedbackActions: document.getElementById('dojo-feedback-actions'),
  btnDojoTryAgain: document.getElementById('btn-dojo-try-again'),
  dojoHintBox: document.getElementById('dojo-hint-box'),
  dojoHintText: document.getElementById('dojo-hint-text'),
  dojoTakeawayBox: document.getElementById('dojo-takeaway-box'),
  dojoTakeawayText: document.getElementById('dojo-takeaway-text'),
  dojoMasteryText: document.getElementById('dojo-mastery-text'),
  dojoMasteryFill: document.getElementById('dojo-mastery-fill'),
  dojoCategoryPills: document.getElementById('dojo-category-pills'),
  dojoPuzzleList: document.getElementById('dojo-puzzle-list'),
  btnDojoReset: document.getElementById('btn-dojo-reset'),
  btnDojoHint: document.getElementById('btn-dojo-hint'),
  dojoHintLabel: document.getElementById('dojo-hint-label'),
  btnDojoPrev: document.getElementById('btn-dojo-prev'),
  btnDojoNext: document.getElementById('btn-dojo-next'),

  // Modal New Game
  modalNewGame: document.getElementById('modal-new-game'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnCancelModal: document.getElementById('btn-cancel-modal'),
  btnStartGame: document.getElementById('btn-start-game'),
  selectHandicap: document.getElementById('select-handicap'),
  modalCoachToggle: document.getElementById('modal-coach-toggle'),

  // Neural Network Engine Card
  nnStatusBadge: document.getElementById('nn-status-badge'),
  nnPresetSelect: document.getElementById('nn-preset-select'),
  nnCustomUrl: document.getElementById('nn-custom-url'),
  nnProgressWrap: document.getElementById('nn-progress-wrap'),
  nnProgressText: document.getElementById('nn-progress-text'),
  nnProgressPct: document.getElementById('nn-progress-pct'),
  nnProgressFill: document.getElementById('nn-progress-fill'),
  nnErrorMsg: document.getElementById('nn-error-msg'),
  btnNnLoad: document.getElementById('btn-nn-load'),
  btnNnFile: document.getElementById('btn-nn-file'),
  btnNnUnload: document.getElementById('btn-nn-unload'),
  inputNnFile: document.getElementById('input-nn-file'),
  nnActiveInfo: document.getElementById('nn-active-info'),
};

const renderer = new GobanRenderer(el.canvas);

// ============================================================================
// Toast Helper
// ============================================================================

let toastTimer = null;
function showToast(msg, duration = 2200) {
  el.boardToast.textContent = msg;
  el.boardToast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.boardToast.classList.add('hidden');
  }, duration);
}

// ============================================================================
// Responsive Board Sizing
// ============================================================================

function computeBoardSize() {
  const stage = el.gobanFrame.parentElement;
  const availW = stage ? stage.clientWidth - 22 : 560;
  // Leave room for header (58) + strip (62) + toolbar (52) + padding (64)
  const availH = window.innerHeight - 245;
  const maxAllowed = Math.min(640, availW, Math.max(360, availH));
  renderer.resize(Math.max(300, maxAllowed));
}

window.addEventListener('resize', () => {
  computeBoardSize();
  renderCurrentBoard();
});

// ============================================================================
// Board Rendering Dispatch
// ============================================================================

function getDisplayedPlayState() {
  const game = state.game;
  const totalMoves = game.moves.length;
  const isLive = state.reviewIndex === null || state.reviewIndex >= totalMoves;
  const idx = isLive ? totalMoves : state.reviewIndex;
  const board = game.getBoardAtMove(idx);
  const lastMove = idx > 0 ? game.moves[idx - 1] : null;

  // Build move number map for stones still on the board
  let moveNumberMap = null;
  if (state.showNumbers) {
    moveNumberMap = new Map();
    for (let i = 0; i < idx; i++) {
      const m = game.moves[i];
      if (!m.pass && board.grid[m.idx] === m.color) {
        moveNumberMap.set(m.idx, m.moveNum);
      }
    }
  }

  return { board, lastMove, isLive, moveIndex: idx, moveNumberMap };
}

function renderCurrentBoard() {
  if (state.mode === 'play') {
    const { board, lastMove, isLive, moveNumberMap } = getDisplayedPlayState();
    const scoringMode = isLive && (state.game.phase === 'scoring' || state.game.phase === 'finished');

    let influenceMap = null;
    let territoryMap = null;
    if (scoringMode && !state.game.resignedBy) {
      const sc = calculateScore(board, state.game.komi, state.game.deadStones, state.settings.rules);
      territoryMap = sc.territoryMap;
    } else if (state.showTerritory) {
      influenceMap = (isLive && state.latestOwnershipMap && state.latestOwnershipMap.length === board.size * board.size)
        ? state.latestOwnershipMap
        : estimateInfluence(board);
    }

    const canHover = isLive && state.game.phase === 'playing' && !state.aiThinking && state.game.turn === state.settings.playerColor;

    renderer.render({
      board,
      viewport: null,
      hover: canHover ? state.hover : null,
      hoverColor: state.game.turn,
      lastMove,
      showCoords: true,
      showMoveNumbers: state.showNumbers,
      moveNumberMap,
      hints: isLive ? state.activeHints : [],
      influenceMap,
      territoryMap,
      deadStones: scoringMode ? state.game.deadStones : null,
      showAtariDanger: state.showAtari && !scoringMode,
      scoringMode,
    });
  } else {
    // Dojo Mode
    const puzzle = PUZZLES[state.dojoPuzzleIndex];
    let dojoHintRegion = null;
    let dojoHintExact = null;

    if (state.dojoHintLevel >= 2 && state.dojoStatus === 'playing') {
      const h2 = puzzle.hints[1];
      if (h2 && h2.region) {
        const pt = labelToCoord(h2.region.coord, puzzle.size);
        if (pt) dojoHintRegion = { x: pt.x, y: pt.y, radius: h2.region.radius || 1 };
      }
    }
    if (state.dojoHintLevel >= 3 && state.dojoStatus === 'playing') {
      // Highlight the next expected move in currentNode if available, else puzzle hint 3
      const nextKeys = state.dojoNode ? Object.keys(state.dojoNode) : [];
      const targetCoord = nextKeys[0] || puzzle.hints[2]?.coord;
      if (targetCoord) {
        const pt = labelToCoord(targetCoord, puzzle.size);
        if (pt) dojoHintExact = pt;
      }
    }

    renderer.render({
      board: state.dojoBoard,
      viewport: puzzle.viewport || null,
      hover: state.dojoStatus === 'playing' ? state.hover : null,
      hoverColor: puzzle.playerColor,
      lastMove: state.dojoLastMove,
      showCoords: true,
      showMoveNumbers: false,
      showAtariDanger: true,
      dojoHintRegion,
      dojoHintExact,
    });
  }
}

// ============================================================================
// Mode Switching
// ============================================================================

function switchMode(newMode) {
  if (state.mode === newMode) return;
  state.mode = newMode;
  state.hover = null;
  state.aiRunId++;
  state.aiThinking = false;

  const isPlay = newMode === 'play';
  el.tabPlay.classList.toggle('active', isPlay);
  el.tabPlay.setAttribute('aria-selected', String(isPlay));
  el.tabDojo.classList.toggle('active', !isPlay);
  el.tabDojo.setAttribute('aria-selected', String(!isPlay));

  el.playStrip.classList.toggle('hidden', !isPlay);
  el.playToolbar.classList.toggle('hidden', !isPlay);
  el.sidebarPlay.classList.toggle('hidden', !isPlay);

  el.dojoStrip.classList.toggle('hidden', isPlay);
  el.dojoToolbar.classList.toggle('hidden', isPlay);
  el.sidebarDojo.classList.toggle('hidden', isPlay);

  if (!isPlay) {
    loadDojoPuzzle(state.dojoPuzzleIndex);
  } else {
    updatePlayUI();
  }
  computeBoardSize();
  renderCurrentBoard();
}

// ============================================================================
// Play & Coach Mode Logic
// ============================================================================

function startNewGame(customSettings = null) {
  if (customSettings) {
    Object.assign(state.settings, customSettings);
    persistSettings();
  }
  state.aiRunId++;
  state.aiThinking = false;
  state.reviewIndex = null;
  state.activeHints = [];
  state.latestOwnershipMap = null;
  state.lastUserMoveNum = null;

  state.game = new GoGame({
    size: state.settings.size,
    komi: state.settings.handicap >= 2 ? 0.5 : 6.5,
    handicap: state.settings.handicap,
    rules: state.settings.rules,
  });

  const initEval = evaluateBoardStatic(state.game.board, state.game.komi);
  state.winrateHistory = [{
    moveNum: 0,
    blackWinrate: initEval.blackWinrate,
    scoreLeadBlack: initEval.scoreLeadBlack,
  }];

  // Reset coach panel
  el.toggleCoach.checked = state.settings.coachEnabled;
  syncCoachVisibility();
  resetCoachMessage();

  if (state.mode !== 'play') {
    switchMode('play');
  } else {
    updatePlayUI();
    renderCurrentBoard();
  }

  // If AI plays first (user chose White or handicap game where White plays first and AI is White)
  if (state.game.turn !== state.settings.playerColor) {
    triggerAiMove();
  }
}

function resetCoachMessage() {
  el.coachGradeRow.classList.add('hidden');
  el.btnRetryMove.classList.add('hidden');
  el.coachCandidates.classList.add('hidden');
  el.coachCandidates.innerHTML = '';

  const isUserTurn = state.game && state.game.turn === state.settings.playerColor;
  el.coachHeadline.textContent = isUserTurn
    ? '準備就緒，請下出您的下一手！'
    : '師範 AI 正在佈局開局…';
  el.coachExplanation.textContent =
    '我會即時評析您的每一手——包含局部急所、棋形效率與佈局方向，遇到問題手時可一鍵重試。';
}

function syncCoachVisibility() {
  const on = state.settings.coachEnabled;
  el.coachBody.classList.toggle('hidden', !on);
  el.coachPausedMsg.classList.toggle('hidden', on);
  if (!on) {
    state.activeHints = [];
    renderCurrentBoard();
  }
}

function updatePlayUI() {
  const g = state.game;
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty] || DIFFICULTY_PRESETS.club;
  const { board, isLive, moveIndex } = getDisplayedPlayState();

  const userIsBlack = state.settings.playerColor === BLACK;
  el.blackName.textContent = userIsBlack ? '您（黑棋）' : '師範 AI（黑棋）';
  el.whiteName.textContent = userIsBlack ? '師範 AI（白棋）' : '您（白棋）';

  el.blackCaptures.textContent = board.captures[BLACK];
  el.whiteCaptures.textContent = board.captures[WHITE];

  el.gameMetaPill.textContent = `${g.size}路 · 貼 ${g.komi} 目 · ${preset.rank} AI`;

  const blackActive = g.phase === 'playing' && g.turn === BLACK && isLive;
  const whiteActive = g.phase === 'playing' && g.turn === WHITE && isLive;
  el.playerBlackCard.classList.toggle('active-turn', blackActive);
  el.playerWhiteCard.classList.toggle('active-turn', whiteActive);

  if (!isLive) {
    el.turnStatus.textContent = `檢視第 ${moveIndex} 手`;
  } else if (g.phase === 'scoring') {
    el.turnStatus.textContent = '請點選死子確認勝負';
  } else if (g.phase === 'finished') {
    if (g.finalScore?.resigned) {
      el.turnStatus.textContent = `${g.finalScore.winner === BLACK ? '黑棋' : '白棋'}中盤勝`;
    } else if (g.finalScore) {
      el.turnStatus.textContent = `${g.finalScore.winner === BLACK ? '黑勝' : '白勝'} ${g.finalScore.margin.toFixed(1)} 目`;
    }
  } else if (state.aiThinking) {
    el.turnStatus.textContent = '師範 AI 思考中…';
  } else {
    el.turnStatus.textContent = g.turn === BLACK ? '黑棋落子' : '白棋落子';
  }

  // Review navigation buttons
  const total = g.moves.length;
  el.moveCounter.textContent = total === 0 ? '開局' : `第 ${moveIndex}/${total} 手`;
  el.btnNavStart.disabled = moveIndex <= 0;
  el.btnNavPrev.disabled = moveIndex <= 0;
  el.btnNavNext.disabled = moveIndex >= total;
  el.btnNavEnd.disabled = moveIndex >= total;

  // Action buttons
  const canAct = isLive && g.phase === 'playing' && !state.aiThinking;
  el.btnUndo.disabled = total === 0 || state.aiThinking;
  el.btnPass.disabled = !canAct || g.turn !== state.settings.playerColor;
  el.btnResign.disabled = g.phase === 'finished';
  el.btnAskHint.disabled = !canAct || g.turn !== state.settings.playerColor;

  // Toggle buttons
  el.btnToggleTerritory.classList.toggle('active', state.showTerritory);
  el.btnToggleAtari.classList.toggle('active', state.showAtari);
  el.btnToggleNumbers.classList.toggle('active', state.showNumbers);

  // Scoring / Finished card
  updateScoringCard();

  // Winrate bar & graph
  updateWinrateDisplay(moveIndex);
}

function updateScoringCard() {
  const g = state.game;
  if (g.phase !== 'scoring' && g.phase !== 'finished') {
    el.scoringCard.classList.add('hidden');
    return;
  }

  el.scoringCard.classList.remove('hidden');
  el.ruleChinese.classList.toggle('active', state.settings.rules === 'chinese');
  el.ruleJapanese.classList.toggle('active', state.settings.rules === 'japanese');

  if (g.phase === 'scoring') {
    el.scoringTitle.textContent = '點目與死子確認';
    el.scoringInstructions.textContent =
      '雙方皆已虛手。請點擊棋盤上的死子棋串切換狀態，確認無誤後點選「確認勝負」。';
    el.scoringActions.classList.remove('hidden');
    el.postgameReview.classList.add('hidden');

    const sc = calculateScore(g.board, g.komi, g.deadStones, state.settings.rules);
    renderScoreBreakdown(sc);
  } else {
    el.scoringTitle.textContent = '終局結果';
    el.scoringActions.classList.add('hidden');

    if (g.finalScore?.resigned) {
      const winnerLabel = g.finalScore.winner === BLACK ? '黑棋' : '白棋';
      el.scoringInstructions.textContent = `${g.finalScore.resignedBy === BLACK ? '黑棋' : '白棋'}認輸——${winnerLabel}中盤勝！可點擊下方關鍵手數重練檢討，或新開一局。`;
      el.scoreBreakdown.innerHTML = '';
    } else {
      const sc = calculateScore(g.board, g.komi, g.deadStones, state.settings.rules);
      const winnerLabel = sc.winner === BLACK ? '黑棋' : '白棋';
      el.scoringInstructions.textContent = `${winnerLabel}勝 ${sc.margin.toFixed(1)} 目（採用${sc.rules === 'chinese' ? '數子法' : '數目法'}規則）。`;
      renderScoreBreakdown(sc);
    }

    renderKeyMoments();
  }
}

function renderScoreBreakdown(sc) {
  const bSub = sc.rules === 'chinese'
    ? `空 ${sc.blackTerritory} ＋ 子 ${sc.blackStones}`
    : `空 ${sc.blackTerritory} ＋ 提子 ${sc.blackCaptures + sc.deadWhite}`;
  const wSub = sc.rules === 'chinese'
    ? `空 ${sc.whiteTerritory} ＋ 子 ${sc.whiteStones} ＋ 貼 ${sc.komi}`
    : `空 ${sc.whiteTerritory} ＋ 提子 ${sc.whiteCaptures + sc.deadBlack} ＋ 貼 ${sc.komi}`;

  el.scoreBreakdown.innerHTML = `
    <div class="score-box ${sc.winner === BLACK ? 'winner' : ''}">
      <div class="score-box-label">黑棋總計</div>
      <div class="score-box-val">${sc.blackTotal.toFixed(1)}</div>
      <div class="score-box-sub">${bSub}</div>
    </div>
    <div class="score-box ${sc.winner === WHITE ? 'winner' : ''}">
      <div class="score-box-label">白棋總計</div>
      <div class="score-box-val">${sc.whiteTotal.toFixed(1)}</div>
      <div class="score-box-sub">${wSub}</div>
    </div>
  `;
}

function renderKeyMoments() {
  const userMoves = state.game.moves.filter(
    (m) => m.color === state.settings.playerColor && m.analysis && m.analysis.winrateDelta < -0.05
  );
  userMoves.sort((a, b) => a.analysis.winrateDelta - b.analysis.winrateDelta);
  const top3 = userMoves.slice(0, 3);

  el.postgameReview.classList.remove('hidden');
  if (top3.length === 0) {
    el.keyMomentsList.innerHTML = `<div class="muted-text">精彩的一局！本局沒有被師範標記的重大失誤。</div>`;
    return;
  }

  el.keyMomentsList.innerHTML = '';
  for (const m of top3) {
    const row = document.createElement('div');
    row.className = 'moment-row';
    const bestCoord = m.analysis.bestMoves?.[0]?.coord || '';
    const dropPct = Math.abs(m.analysis.winrateDelta * 100).toFixed(0);
    row.innerHTML = `
      <div class="moment-info">
        <strong>第 ${m.moveNum} 手（${coordToLabel(m.x, m.y, state.game.size)}）· −${dropPct}%</strong>
        <span>${m.analysis.gradeLabel}${bestCoord ? ` · 師範推薦 ${bestCoord}` : ''}</span>
      </div>
      <button class="btn btn-accent" style="padding:5px 9px;font-size:11.5px">從此手重練</button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      practiceFromMove(m.moveNum);
    });
    el.keyMomentsList.appendChild(row);
  }
}

function practiceFromMove(moveNum) {
  // Undo back to just before moveNum so user can replay that decision live against AI
  const stepsToUndo = state.game.moves.length - (moveNum - 1);
  if (stepsToUndo <= 0) return;
  state.aiRunId++;
  state.aiThinking = false;
  state.game.undo(stepsToUndo);
  state.winrateHistory = state.winrateHistory.slice(0, state.game.moves.length + 1);
  state.reviewIndex = null;
  state.activeHints = [];
  el.coachGradeRow.classList.add('hidden');
  el.btnRetryMove.classList.add('hidden');
  el.coachHeadline.textContent = `重練第 ${moveNum} 手——找出更強的下法！`;
  el.coachExplanation.textContent = '請直接在棋盤上下出您的新構想，或點擊「顯示推薦選點」參考師範建議。';
  updatePlayUI();
  renderCurrentBoard();
  showToast(`已倒回至第 ${moveNum} 手，試試更強的一手！`);
}

function updateWinrateDisplay(atMoveIndex) {
  const entry =
    state.winrateHistory[Math.min(atMoveIndex, state.winrateHistory.length - 1)] ||
    { blackWinrate: 0.5, scoreLeadBlack: 0 };

  const bPct = Math.round(entry.blackWinrate * 100);
  const wPct = 100 - bPct;
  el.wrBlackPct.textContent = `${bPct}%`;
  el.wrWhitePct.textContent = `${wPct}%`;
  el.wrBlackFill.style.width = `${bPct}%`;

  const lead = entry.scoreLeadBlack;
  if (Math.abs(lead) < 1.2) {
    el.scoreLeadBadge.textContent = '勢均力敵';
  } else if (lead > 0) {
    el.scoreLeadBadge.textContent = `黑領先 ${lead.toFixed(1)} 目`;
  } else {
    el.scoreLeadBadge.textContent = `白領先 ${Math.abs(lead).toFixed(1)} 目`;
  }

  renderWinrateGraph(atMoveIndex);
}

function renderWinrateGraph(activeIdx) {
  const svg = el.winrateGraph;
  const W = 340;
  const H = 88;
  const padX = 6;
  const padY = 8;
  const hist = state.winrateHistory;

  const n = Math.max(2, hist.length);
  const xFor = (i) => padX + (i / (n - 1)) * (W - padX * 2);
  const yFor = (wr) => padY + (1 - Math.max(0.02, Math.min(0.98, wr))) * (H - padY * 2);

  let pts = '';
  let areaPts = `${padX},${H - padY} `;
  for (let i = 0; i < hist.length; i++) {
    const x = xFor(i).toFixed(1);
    const y = yFor(hist[i].blackWinrate).toFixed(1);
    pts += `${x},${y} `;
    areaPts += `${x},${y} `;
  }
  const lastX = xFor(hist.length - 1).toFixed(1);
  areaPts += `${lastX},${H - padY}`;

  // Mistake markers on curve
  let dots = '';
  for (let i = 1; i < hist.length; i++) {
    const h = hist[i];
    if (h.grade === 'mistake' || h.grade === 'blunder') {
      dots += `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(h.blackWinrate).toFixed(1)}" r="3.4" fill="#ef5350" stroke="#191b20" stroke-width="1" />`;
    } else if (h.grade === 'brilliant') {
      dots += `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(h.blackWinrate).toFixed(1)}" r="3.2" fill="#10b981" stroke="#191b20" stroke-width="1" />`;
    }
  }

  const clampedActive = Math.min(activeIdx, hist.length - 1);
  const ax = xFor(clampedActive).toFixed(1);
  const ay = yFor(hist[clampedActive]?.blackWinrate ?? 0.5).toFixed(1);

  svg.innerHTML = `
    <line x1="${padX}" y1="${H / 2}" x2="${W - padX}" y2="${H / 2}" stroke="rgba(255,255,255,0.12)" stroke-dasharray="3 3" stroke-width="1" />
    ${hist.length > 1 ? `
      <polygon points="${areaPts}" fill="rgba(220,166,85,0.12)" />
      <polyline points="${pts}" fill="none" stroke="#dca655" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    ` : ''}
    ${dots}
    <line x1="${ax}" y1="${padY}" x2="${ax}" y2="${H - padY}" stroke="rgba(255,255,255,0.28)" stroke-width="1" />
    <circle cx="${ax}" cy="${ay}" r="4.2" fill="#f2efe9" stroke="#dca655" stroke-width="2" />
  `;
}

// Handle clicking the winrate graph to jump to any move
el.winrateGraph.addEventListener('click', (ev) => {
  if (state.winrateHistory.length <= 1) return;
  const rect = el.winrateGraph.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
  const target = Math.round(frac * (state.winrateHistory.length - 1));
  setReviewIndex(target);
});

function setReviewIndex(targetIdx) {
  const total = state.game.moves.length;
  const clamped = Math.max(0, Math.min(total, targetIdx));
  state.reviewIndex = clamped >= total ? null : clamped;
  state.activeHints = [];

  // Show that move's stored coach feedback if inspecting a user move
  if (clamped > 0) {
    const m = state.game.moves[clamped - 1];
    if (m.analysis) {
      displayCoachEvaluation(m.analysis, false);
    }
  }
  updatePlayUI();
  renderCurrentBoard();
}

async function handlePlayerMove(x, y) {
  const g = state.game;
  if (state.reviewIndex !== null && state.reviewIndex < g.moves.length) {
    showToast('目前正在檢視歷史手數——點擊 ›| 返回最新局面');
    return;
  }

  if (g.phase === 'scoring') {
    g.toggleDeadGroup(x, y);
    sound.playStone(false);
    updatePlayUI();
    renderCurrentBoard();
    return;
  }

  if (g.phase !== 'playing' || state.aiThinking || g.turn !== state.settings.playerColor) {
    return;
  }

  const prevLastIdx = g.moves.length > 0 && !g.moves[g.moves.length - 1].pass
    ? g.moves[g.moves.length - 1].idx
    : -1;

  const res = g.playMove(x, y);
  if (!res.legal) {
    sound.playSoftError();
    showToast(res.reason || '無效落子');
    return;
  }

  const moveRecord = res.move;
  state.activeHints = [];
  state.lastUserMoveNum = moveRecord.moveNum;
  sound.playStone(moveRecord.captured.length > 0);

  // Push immediate static evaluation to history so graph updates right away
  const staticEval = evaluateBoardStatic(moveRecord.boardAfter, g.komi);
  state.winrateHistory.push({
    moveNum: moveRecord.moveNum,
    blackWinrate: staticEval.blackWinrate,
    scoreLeadBlack: staticEval.scoreLeadBlack,
    color: moveRecord.color,
  });

  updatePlayUI();
  renderCurrentBoard();

  const runId = ++state.aiRunId;

  // Run Live Coach Evaluation if enabled
  if (state.settings.coachEnabled) {
    el.coachHeadline.textContent = '師範正在評析您的這手棋…';
    el.coachExplanation.textContent = '正在檢視局部急所、棋形效率與更佳選點。';
    el.coachGradeRow.classList.add('hidden');
    el.btnRetryMove.classList.add('hidden');
    el.coachCandidates.classList.add('hidden');

    const evaluation = await evaluateUserMoveAsync(
      moveRecord.boardBefore,
      moveRecord.idx,
      moveRecord.color,
      moveRecord.boardAfter,
      moveRecord.captured,
      {
        komi: g.komi,
        prevLastMoveIdx: prevLastIdx,
        superkoSet: null,
      }
    );

    if (runId !== state.aiRunId) return; // cancelled by undo/new game
    moveRecord.analysis = evaluation;
    const histEntry = state.winrateHistory[moveRecord.moveNum];
    if (histEntry) {
      histEntry.blackWinrate = evaluation.blackWinrateAfter;
      histEntry.scoreLeadBlack = evaluation.scoreLeadBlack;
      histEntry.grade = evaluation.grade;
    }
    displayCoachEvaluation(evaluation, true);
    updateWinrateDisplay(g.moves.length);
  }

  if (runId !== state.aiRunId) return;
  if (g.phase === 'playing' && g.turn !== state.settings.playerColor) {
    await triggerAiMove(runId);
  }
}

function displayCoachEvaluation(ev, allowRetry = true) {
  el.coachGradeRow.classList.remove('hidden');
  el.coachGradeBadge.textContent = ev.gradeLabel;
  el.coachGradeBadge.className = `grade-badge grade-${ev.grade}`;

  if (ev.winrateDelta < -0.02) {
    el.coachDelta.textContent = `勝率 ${(ev.winrateDelta * 100).toFixed(1)}%`;
  } else {
    el.coachDelta.textContent = '符合推薦';
  }

  el.coachHeadline.textContent = ev.headline;
  el.coachExplanation.textContent = ev.explanation;

  const isWeak = ev.grade === 'inaccuracy' || ev.grade === 'mistake' || ev.grade === 'blunder';
  el.btnRetryMove.classList.toggle('hidden', !(allowRetry && isWeak));
  el.coachCandidates.classList.add('hidden');
}

async function triggerAiMove(existingRunId = null) {
  const g = state.game;
  if (g.phase !== 'playing') return;

  const runId = existingRunId ?? (++state.aiRunId);
  state.aiThinking = true;
  updatePlayUI();

  // Brief natural pause so the user sees their stone land cleanly
  await new Promise((r) => setTimeout(r, 140));
  if (runId !== state.aiRunId) return;

  const lastMoveIdx = g.moves.length > 0 && !g.moves[g.moves.length - 1].pass
    ? g.moves[g.moves.length - 1].idx
    : -1;

  const analysis = await analyzePositionAsync(g.board, g.turn, {
    komi: g.komi,
    rules: state.settings.rules,
    recentMoves: g.moves.slice(-5),
    lastMoveIdx,
    superkoSet: g.positionHashes,
    difficulty: state.settings.difficulty,
  });

  if (runId !== state.aiRunId) return;
  state.aiThinking = false;
  if (analysis.ownershipMap) {
    state.latestOwnershipMap = analysis.ownershipMap;
  }

  if (analysis.passRecommended || !analysis.bestMove) {
    const passRes = g.playPass();
    state.winrateHistory.push({
      moveNum: passRes.move.moveNum,
      blackWinrate: analysis.blackWinrate,
      scoreLeadBlack: analysis.scoreLeadBlack,
      color: passRes.move.color,
    });
    showToast(passRes.enteredScoring ? '雙方皆已虛手——請點選死子確認勝負' : '師範 AI 選擇虛手');
  } else {
    const bm = analysis.bestMove;
    const res = g.playMove(bm.x, bm.y);
    if (res.legal) {
      sound.playStone(res.move.captured.length > 0);
      state.winrateHistory.push({
        moveNum: res.move.moveNum,
        blackWinrate: analysis.blackWinrate,
        scoreLeadBlack: analysis.scoreLeadBlack,
        color: res.move.color,
      });
    } else {
      const passRes = g.playPass();
      state.winrateHistory.push({
        moveNum: passRes.move.moveNum,
        blackWinrate: analysis.blackWinrate,
        scoreLeadBlack: analysis.scoreLeadBlack,
        color: passRes.move.color,
      });
    }
  }

  updatePlayUI();
  renderCurrentBoard();
}

async function handleAskSenseiHint() {
  const g = state.game;
  if (g.phase !== 'playing' || state.aiThinking || g.turn !== state.settings.playerColor) return;

  el.btnAskHint.disabled = true;
  el.btnAskHint.textContent = '分析中…';

  const lastMoveIdx = g.moves.length > 0 && !g.moves[g.moves.length - 1].pass
    ? g.moves[g.moves.length - 1].idx
    : -1;

  const analysis = await analyzePositionAsync(g.board, g.turn, {
    komi: g.komi,
    rules: state.settings.rules,
    recentMoves: g.moves.slice(-5),
    lastMoveIdx,
    superkoSet: g.positionHashes,
    difficulty: 'club',
    customSimulations: g.size === 9 ? 360 : g.size === 13 ? 220 : 120,
    customTimeBudgetMs: 420,
  });
  if (analysis.ownershipMap) {
    state.latestOwnershipMap = analysis.ownershipMap;
  }

  el.btnAskHint.disabled = false;
  el.btnAskHint.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    顯示推薦選點（前三手）
  `;

  if (analysis.passRecommended || analysis.topMoves.length === 0) {
    state.activeHints = [];
    el.coachHeadline.textContent = '師範建議：虛手';
    el.coachExplanation.textContent = '盤面已經定型，現在虛手即可進入點目計分階段。';
    el.coachCandidates.classList.add('hidden');
    renderCurrentBoard();
    return;
  }

  state.activeHints = analysis.topMoves;
  renderCandidateList(analysis.topMoves);
  renderCurrentBoard();
}

function renderCandidateList(moves) {
  const letters = ['A', 'B', 'C'];
  el.coachCandidates.innerHTML = '';
  el.coachCandidates.classList.remove('hidden');

  moves.slice(0, 3).forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'cand-item';
    item.title = `點擊直接下在 ${m.coord}`;
    item.innerHTML = `
      <span class="cand-letter c${i}">${letters[i]}</span>
      <div class="cand-details">
        <div class="cand-top">
          <span class="cand-coord">${m.coord}</span>
          <span class="cand-wr">勝率 ${Math.round(m.playerWinrate * 100)}%</span>
        </div>
        <div class="cand-reason">${m.reason}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      handlePlayerMove(m.x, m.y);
    });
    el.coachCandidates.appendChild(item);
  });
}

function handleUndo(retryMode = false) {
  const g = state.game;
  if (g.moves.length === 0) return;

  state.aiRunId++;
  state.aiThinking = false;
  state.activeHints = [];
  state.reviewIndex = null;

  // Undo back to the player's turn (usually 2 moves if AI already replied, or 1 move if it's AI's turn)
  let steps = 1;
  if (g.turn === state.settings.playerColor && g.moves.length >= 2) {
    steps = 2;
  }
  g.undo(steps);
  state.winrateHistory = state.winrateHistory.slice(0, g.moves.length + 1);

  if (retryMode) {
    el.btnRetryMove.classList.add('hidden');
    el.coachGradeRow.classList.add('hidden');
    el.coachHeadline.textContent = '再試一次——能看出更強的下法嗎？';
    el.coachExplanation.textContent = '重新檢視局部棋形與急所，或點擊「顯示推薦選點」在棋盤上查看 A/B/C 標記。';
    showToast('已退回上一手——試試更強的變化！');
  } else {
    resetCoachMessage();
  }

  updatePlayUI();
  renderCurrentBoard();
}

function handlePass() {
  const g = state.game;
  if (g.phase !== 'playing' || state.aiThinking || g.turn !== state.settings.playerColor) return;

  state.activeHints = [];
  const res = g.playPass();
  const staticEval = evaluateBoardStatic(g.board, g.komi);
  state.winrateHistory.push({
    moveNum: res.move.moveNum,
    blackWinrate: staticEval.blackWinrate,
    scoreLeadBlack: staticEval.scoreLeadBlack,
    color: res.move.color,
  });

  if (res.enteredScoring) {
    showToast('雙方皆已虛手——請點選死子確認勝負');
    updatePlayUI();
    renderCurrentBoard();
  } else {
    showToast('您已選擇虛手');
    updatePlayUI();
    renderCurrentBoard();
    triggerAiMove();
  }
}

function handleResign() {
  const g = state.game;
  if (g.phase === 'finished') return;
  state.aiRunId++;
  state.aiThinking = false;
  g.resign(state.settings.playerColor);
  showToast('您已投子認輸');
  updatePlayUI();
  renderCurrentBoard();
}

function handleExportSgf() {
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty] || DIFFICULTY_PRESETS.club;
  const sgf = state.game.exportSGF(state.settings.playerColor, `師範 AI（${preset.rank}）`);
  const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  a.href = url;
  a.download = `kaya-sensei-${state.game.size}x${state.game.size}-${dateStr}.sgf`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('已匯出 SGF 棋譜檔案');
}

// ============================================================================
// Practice Dojo Logic
// ============================================================================

function updateDojoMasteryBadges() {
  const solvedCount = PUZZLES.filter((p) => state.dojoSolvedSet.has(p.id)).length;
  const total = PUZZLES.length;
  el.dojoBadgeCount.textContent = `${solvedCount}/${total}`;
  el.dojoMasteryText.textContent = `已精通 ${solvedCount} / ${total} 題`;
  el.dojoMasteryFill.style.width = `${Math.round((solvedCount / total) * 100)}%`;
}

function renderDojoCurriculum() {
  updateDojoMasteryBadges();

  // Category filter pills
  el.dojoCategoryPills.innerHTML = '';
  const allCats = [{ id: 'all', name: '全部' }, ...PUZZLE_CATEGORIES];
  for (const cat of allCats) {
    const btn = document.createElement('button');
    btn.className = `cat-pill ${state.dojoCategory === cat.id ? 'active' : ''}`;
    btn.textContent = cat.name;
    btn.addEventListener('click', () => {
      state.dojoCategory = cat.id;
      renderDojoCurriculum();
    });
    el.dojoCategoryPills.appendChild(btn);
  }

  // Puzzle list
  el.dojoPuzzleList.innerHTML = '';
  const filtered = PUZZLES.map((p, idx) => ({ p, idx })).filter(
    ({ p }) => state.dojoCategory === 'all' || p.category === state.dojoCategory
  );

  for (const { p, idx } of filtered) {
    const isSolved = state.dojoSolvedSet.has(p.id);
    const isActive = idx === state.dojoPuzzleIndex;
    const row = document.createElement('button');
    row.className = `puzzle-row ${isSolved ? 'solved' : ''} ${isActive ? 'active' : ''}`;
    row.innerHTML = `
      <div class="puzzle-row-left">
        <span class="puzzle-check">✓</span>
        <span class="puzzle-row-title">${p.title}</span>
      </div>
      <span class="puzzle-row-rank">${p.rank}</span>
    `;
    row.addEventListener('click', () => {
      loadDojoPuzzle(idx);
    });
    el.dojoPuzzleList.appendChild(row);
  }
}

function loadDojoPuzzle(index) {
  const clamped = (index + PUZZLES.length) % PUZZLES.length;
  state.dojoPuzzleIndex = clamped;
  const puzzle = PUZZLES[clamped];

  const b = new GoBoard(puzzle.size);
  for (const coord of puzzle.setup.black) {
    const pt = labelToCoord(coord, puzzle.size);
    if (pt) b.setRaw(pt.x, pt.y, BLACK);
  }
  for (const coord of puzzle.setup.white) {
    const pt = labelToCoord(coord, puzzle.size);
    if (pt) b.setRaw(pt.x, pt.y, WHITE);
  }

  state.dojoBoard = b;
  state.dojoNode = puzzle.tree;
  state.dojoStep = 0;
  state.dojoStatus = 'playing';
  state.dojoLastMove = null;
  state.dojoHintLevel = 0;

  // Populate UI
  const cat = PUZZLE_CATEGORIES.find((c) => c.id === puzzle.category);
  el.dojoCatTag.textContent = cat ? cat.name : puzzle.category;
  el.dojoBoardTitle.textContent = puzzle.title;
  el.dojoRankPill.textContent = puzzle.rank;
  el.dojoSolvedPill.classList.toggle('hidden', !state.dojoSolvedSet.has(puzzle.id));
  el.dojoStepIndicator.textContent = puzzle.playerColor === BLACK ? '黑先' : '白先';

  el.dojoGoal.textContent = puzzle.goal;
  el.dojoBriefing.textContent = puzzle.briefing;

  setDojoFeedback('neutral', '輪到您落子', '請先在腦中仔細計算變化，再於棋盤上落子。', false);

  el.dojoHintBox.classList.add('hidden');
  el.dojoHintLabel.textContent = '提示（1/3）';
  el.btnDojoHint.disabled = false;

  const alreadySolved = state.dojoSolvedSet.has(puzzle.id);
  el.dojoTakeawayBox.classList.toggle('hidden', !alreadySolved);
  el.dojoTakeawayText.textContent = puzzle.takeaway;

  renderDojoCurriculum();
  renderCurrentBoard();
}

function setDojoFeedback(kind, title, body, showRetry = false) {
  el.dojoFeedback.className = `dojo-feedback ${kind}`;
  el.dojoFeedbackTitle.textContent = title;
  el.dojoFeedbackBody.textContent = body;
  el.dojoFeedbackActions.classList.toggle('hidden', !showRetry);
}

function handleDojoMove(x, y) {
  if (state.dojoStatus !== 'playing') {
    if (state.dojoStatus === 'wrong') {
      loadDojoPuzzle(state.dojoPuzzleIndex);
    }
    return;
  }

  const puzzle = PUZZLES[state.dojoPuzzleIndex];
  const coord = coordToLabel(x, y, puzzle.size);
  const res = state.dojoBoard.play(x, y, puzzle.playerColor);

  if (!res.legal) {
    sound.playSoftError();
    showToast(res.reason || '無效落子');
    return;
  }

  state.dojoLastMove = { x, y, color: puzzle.playerColor };
  sound.playStone(res.captured.length > 0);
  renderCurrentBoard();

  // Check if move is in current solution tree
  const branch = state.dojoNode ? state.dojoNode[coord] : null;
  if (branch) {
    // Clear exact hint markers once user advances
    if (state.dojoHintLevel >= 2) {
      state.dojoHintLevel = 0;
      el.dojoHintLabel.textContent = '提示（1/3）';
    }

    if (branch.status === 'solved') {
      state.dojoStatus = 'solved';
      state.dojoSolvedSet.add(puzzle.id);
      persistSolved();
      sound.playSolved();
      el.dojoSolvedPill.classList.remove('hidden');
      el.dojoTakeawayBox.classList.remove('hidden');
      el.dojoTakeawayText.textContent = puzzle.takeaway;
      setDojoFeedback('solved', '✓ 挑戰成功！', branch.message, false);
      renderDojoCurriculum();
      renderCurrentBoard();
      return;
    }

    // Multi-move continuation: opponent plays strongest resistance
    state.dojoStatus = 'animating';
    setDojoFeedback('continue', '好手——請繼續下完後續變化！', branch.message, false);

    setTimeout(() => {
      if (state.mode !== 'dojo' || PUZZLES[state.dojoPuzzleIndex].id !== puzzle.id) return;
      if (branch.reply) {
        const rep = labelToCoord(branch.reply, puzzle.size);
        if (rep) {
          const repRes = state.dojoBoard.play(rep.x, rep.y, opponent(puzzle.playerColor));
          state.dojoLastMove = { x: rep.x, y: rep.y, color: opponent(puzzle.playerColor) };
          sound.playStone(repRes.captured?.length > 0);
        }
      }
      state.dojoNode = branch.next || {};
      state.dojoStep++;
      state.dojoStatus = 'playing';
      renderCurrentBoard();
    }, 360);
    return;
  }

  // Check if it's a known instructional trap at step 0
  const trap = state.dojoStep === 0 && puzzle.traps ? puzzle.traps[coord] : null;
  state.dojoStatus = 'animating';

  if (trap) {
    setTimeout(() => {
      if (state.mode !== 'dojo' || PUZZLES[state.dojoPuzzleIndex].id !== puzzle.id) return;
      if (trap.reply) {
        const rep = labelToCoord(trap.reply, puzzle.size);
        if (rep) {
          const repRes = state.dojoBoard.play(rep.x, rep.y, opponent(puzzle.playerColor));
          state.dojoLastMove = { x: rep.x, y: rep.y, color: opponent(puzzle.playerColor) };
          sound.playStone(repRes.captured?.length > 0);
        }
      }
      state.dojoStatus = 'wrong';
      sound.playSoftError();
      setDojoFeedback('wrong', `遭到反擊（${coord}）`, trap.message, true);
      renderCurrentBoard();
    }, 320);
  } else {
    state.dojoStatus = 'wrong';
    sound.playSoftError();
    setDojoFeedback(
      'wrong',
      `未能擊中急所（${coord}）`,
      '這手棋偏離了此題的核心思路。點選「再試一次」重新計算，或按「提示」請師範點撥！',
      true
    );
  }
}

function handleDojoHint() {
  if (state.dojoStatus !== 'playing') {
    loadDojoPuzzle(state.dojoPuzzleIndex);
  }
  const puzzle = PUZZLES[state.dojoPuzzleIndex];
  state.dojoHintLevel = Math.min(3, state.dojoHintLevel + 1);

  const hintEntry = puzzle.hints[state.dojoHintLevel - 1];
  const hintText = typeof hintEntry === 'string' ? hintEntry : hintEntry?.text || '';

  el.dojoHintBox.classList.remove('hidden');
  el.dojoHintText.textContent = hintText;

  if (state.dojoHintLevel >= 3) {
    el.dojoHintLabel.textContent = '已標示正解急所';
    el.btnDojoHint.disabled = true;
  } else {
    el.dojoHintLabel.textContent = `提示（${state.dojoHintLevel + 1}/3）`;
  }

  renderCurrentBoard();
}

// ============================================================================
// Canvas Pointer Interaction
// ============================================================================

el.canvas.addEventListener('mousemove', (ev) => {
  const pt = renderer.pixelToBoard(ev.clientX, ev.clientY);
  const changed =
    (!pt && state.hover) ||
    (pt && !state.hover) ||
    (pt && state.hover && (pt.x !== state.hover.x || pt.y !== state.hover.y));
  if (changed) {
    state.hover = pt;
    renderCurrentBoard();
  }
});

el.canvas.addEventListener('mouseleave', () => {
  if (state.hover) {
    state.hover = null;
    renderCurrentBoard();
  }
});

el.canvas.addEventListener('click', (ev) => {
  const pt = renderer.pixelToBoard(ev.clientX, ev.clientY);
  if (!pt) return;
  if (state.mode === 'play') {
    handlePlayerMove(pt.x, pt.y);
  } else {
    handleDojoMove(pt.x, pt.y);
  }
});

// ============================================================================
// Modal Setup & Controls Wiring
// ============================================================================

const modalDraft = { ...state.settings };

function openNewGameModal() {
  Object.assign(modalDraft, state.settings);
  syncModalUI();
  el.modalNewGame.classList.remove('hidden');
}

function closeNewGameModal() {
  el.modalNewGame.classList.add('hidden');
}

function syncModalUI() {
  document.querySelectorAll('.segmented-grid[data-setting]').forEach((grid) => {
    const key = grid.dataset.setting;
    const currentVal = String(
      key === 'color' ? modalDraft.playerColor : modalDraft[key]
    );
    grid.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === currentVal);
    });
  });
  el.selectHandicap.value = String(modalDraft.handicap);
  el.modalCoachToggle.checked = modalDraft.coachEnabled;
}

document.querySelectorAll('.segmented-grid[data-setting]').forEach((grid) => {
  const key = grid.dataset.setting;
  grid.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      if (key === 'size') modalDraft.size = parseInt(val, 10);
      else if (key === 'color') modalDraft.playerColor = parseInt(val, 10);
      else modalDraft[key] = val;
      syncModalUI();
    });
  });
});

el.selectHandicap.addEventListener('change', () => {
  modalDraft.handicap = parseInt(el.selectHandicap.value, 10);
});

el.modalCoachToggle.addEventListener('change', () => {
  modalDraft.coachEnabled = el.modalCoachToggle.checked;
});

el.btnNewGame.addEventListener('click', openNewGameModal);
el.btnCloseModal.addEventListener('click', closeNewGameModal);
el.btnCancelModal.addEventListener('click', closeNewGameModal);
el.modalNewGame.addEventListener('click', (ev) => {
  if (ev.target === el.modalNewGame) closeNewGameModal();
});
el.btnStartGame.addEventListener('click', () => {
  closeNewGameModal();
  startNewGame({ ...modalDraft });
});

// Top tabs & sound
el.tabPlay.addEventListener('click', () => switchMode('play'));
el.tabDojo.addEventListener('click', () => switchMode('dojo'));

let soundOn = true;
el.btnSound.addEventListener('click', () => {
  soundOn = !soundOn;
  sound.setEnabled(soundOn);
  el.iconSoundOn.classList.toggle('hidden', !soundOn);
  el.iconSoundOff.classList.toggle('hidden', soundOn);
});

// Play toolbar
el.btnUndo.addEventListener('click', () => handleUndo(false));
el.btnPass.addEventListener('click', handlePass);
el.btnResign.addEventListener('click', handleResign);
el.btnExportSgf.addEventListener('click', handleExportSgf);

el.btnNavStart.addEventListener('click', () => setReviewIndex(0));
el.btnNavPrev.addEventListener('click', () => {
  const cur = state.reviewIndex ?? state.game.moves.length;
  setReviewIndex(cur - 1);
});
el.btnNavNext.addEventListener('click', () => {
  const cur = state.reviewIndex ?? state.game.moves.length;
  setReviewIndex(cur + 1);
});
el.btnNavEnd.addEventListener('click', () => setReviewIndex(state.game.moves.length));

el.btnToggleTerritory.addEventListener('click', () => {
  state.showTerritory = !state.showTerritory;
  updatePlayUI();
  renderCurrentBoard();
});
el.btnToggleAtari.addEventListener('click', () => {
  state.showAtari = !state.showAtari;
  updatePlayUI();
  renderCurrentBoard();
});
el.btnToggleNumbers.addEventListener('click', () => {
  state.showNumbers = !state.showNumbers;
  updatePlayUI();
  renderCurrentBoard();
});

// Coach actions
el.toggleCoach.addEventListener('change', () => {
  state.settings.coachEnabled = el.toggleCoach.checked;
  persistSettings();
  syncCoachVisibility();
});
el.btnAskHint.addEventListener('click', handleAskSenseiHint);
el.btnRetryMove.addEventListener('click', () => handleUndo(true));

// Scoring controls
el.ruleChinese.addEventListener('click', () => {
  state.settings.rules = 'chinese';
  state.game.rules = 'chinese';
  persistSettings();
  updatePlayUI();
  renderCurrentBoard();
});
el.ruleJapanese.addEventListener('click', () => {
  state.settings.rules = 'japanese';
  state.game.rules = 'japanese';
  persistSettings();
  updatePlayUI();
  renderCurrentBoard();
});
el.btnAcceptScore.addEventListener('click', () => {
  state.game.finalizeScore();
  sound.playSolved();
  updatePlayUI();
  renderCurrentBoard();
});
el.btnResumePlay.addEventListener('click', () => {
  state.game.resumePlaying();
  updatePlayUI();
  renderCurrentBoard();
  showToast('已恢復對弈');
});

// Dojo toolbar
el.btnDojoReset.addEventListener('click', () => loadDojoPuzzle(state.dojoPuzzleIndex));
el.btnDojoTryAgain.addEventListener('click', () => loadDojoPuzzle(state.dojoPuzzleIndex));
el.btnDojoHint.addEventListener('click', handleDojoHint);
el.btnDojoPrev.addEventListener('click', () => loadDojoPuzzle(state.dojoPuzzleIndex - 1));
el.btnDojoNext.addEventListener('click', () => loadDojoPuzzle(state.dojoPuzzleIndex + 1));

// Keyboard shortcuts
window.addEventListener('keydown', (ev) => {
  if (!el.modalNewGame.classList.contains('hidden')) {
    if (ev.key === 'Escape') closeNewGameModal();
    return;
  }
  if (state.mode === 'play') {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      handleUndo(false);
    } else if (ev.key === 'ArrowLeft') {
      const cur = state.reviewIndex ?? state.game.moves.length;
      if (cur > 0) setReviewIndex(cur - 1);
    } else if (ev.key === 'ArrowRight') {
      const cur = state.reviewIndex ?? state.game.moves.length;
      if (cur < state.game.moves.length) setReviewIndex(cur + 1);
    }
  } else {
    if (ev.key.toLowerCase() === 'r') {
      loadDojoPuzzle(state.dojoPuzzleIndex);
    } else if (ev.key.toLowerCase() === 'h') {
      handleDojoHint();
    }
  }
});

// ============================================================================
// Neural Network Engine Card Controls (ONNX WebGPU / WASM)
// ============================================================================

function updateNeuralUI(snap) {
  const { status, backend, modelName, lastError, progress } = snap;

  el.nnStatusBadge.className = `nn-badge ${status}`;
  if (status === 'idle') {
    el.nnStatusBadge.textContent = '內建引擎';
    el.nnProgressWrap.classList.add('hidden');
    el.nnErrorMsg.classList.add('hidden');
    el.btnNnLoad.classList.remove('hidden');
    el.btnNnLoad.disabled = false;
    el.btnNnFile.disabled = false;
    el.btnNnUnload.classList.add('hidden');
    el.nnActiveInfo.textContent = '初次載入後自動快取於瀏覽器，支援 GitHub Pages 零伺服器部署。';
  } else if (status === 'loading') {
    el.nnStatusBadge.textContent = '載入中…';
    el.nnProgressWrap.classList.remove('hidden');
    el.nnErrorMsg.classList.add('hidden');
    el.btnNnLoad.disabled = true;
    el.btnNnFile.disabled = true;
    el.btnNnUnload.classList.add('hidden');

    if (progress) {
      if (progress.phase === 'cache') {
        el.nnProgressText.textContent = '從瀏覽器快取讀取模型…';
        el.nnProgressPct.textContent = '100%';
        el.nnProgressFill.style.width = '100%';
      } else if (progress.phase === 'compile') {
        el.nnProgressText.textContent = '正在編譯 WebGPU / WASM 運算圖…';
        el.nnProgressPct.textContent = '100%';
        el.nnProgressFill.style.width = '100%';
      } else {
        const mbStr = progress.loadedMB > 0
          ? `（${progress.loadedMB.toFixed(1)}${progress.totalMB > 0 ? ` / ${progress.totalMB.toFixed(1)}` : ''} MB）`
          : '';
        el.nnProgressText.textContent = `下載並快取模型中${mbStr}…`;
        const pct = progress.pct >= 0 ? progress.pct : 55;
        el.nnProgressPct.textContent = progress.pct >= 0 ? `${pct}%` : '下載中';
        el.nnProgressFill.style.width = `${pct}%`;
      }
    }
  } else if (status === 'ready') {
    const backendLabel = backend === 'webgpu' ? 'WebGPU GPU 加速' : 'WASM CPU 運行';
    el.nnStatusBadge.textContent = backendLabel;
    el.nnProgressWrap.classList.add('hidden');
    el.nnErrorMsg.classList.add('hidden');
    el.btnNnLoad.classList.add('hidden');
    el.btnNnFile.disabled = false;
    el.btnNnUnload.classList.remove('hidden');
    el.nnActiveInfo.textContent = `已啟用：${modelName}（${backendLabel}）。AI 對手、教練選點與形勢圖均由神經網路驅動！`;
    showToast(`已啟用神經網路 AI（${backendLabel}）`);
  } else if (status === 'error') {
    el.nnStatusBadge.textContent = '載入失敗';
    el.nnProgressWrap.classList.add('hidden');
    el.nnErrorMsg.classList.remove('hidden');
    el.nnErrorMsg.textContent = `無法載入模型：${lastError || '未知錯誤'}。已自動維持使用內建引擎。`;
    el.btnNnLoad.classList.remove('hidden');
    el.btnNnLoad.disabled = false;
    el.btnNnFile.disabled = false;
    el.btnNnUnload.classList.add('hidden');
  }
}

neuralEngine.subscribe(updateNeuralUI);

el.nnPresetSelect.addEventListener('change', () => {
  const isCustom = el.nnPresetSelect.value === 'custom';
  el.nnCustomUrl.classList.toggle('hidden', !isCustom);
  el.nnErrorMsg.classList.add('hidden');
});

el.btnNnLoad.addEventListener('click', async () => {
  const val = el.nnPresetSelect.value;
  let url = '';
  let name = '';
  if (val === 'custom') {
    url = el.nnCustomUrl.value.trim();
    if (!url) {
      el.nnErrorMsg.classList.remove('hidden');
      el.nnErrorMsg.textContent = '請先輸入有效的 .onnx 模型網址。';
      return;
    }
    name = url.split('/').pop() || '自訂 ONNX 模型';
  } else {
    const preset = NN_MODEL_PRESETS.find((p) => p.id === val);
    if (!preset) return;
    url = preset.url;
    name = preset.name;
  }
  try {
    await neuralEngine.loadFromUrl(url, name);
  } catch {
    // Error already displayed via subscribe handler
  }
});

el.btnNnFile.addEventListener('click', () => {
  el.inputNnFile.value = '';
  el.inputNnFile.click();
});

el.inputNnFile.addEventListener('change', async () => {
  const file = el.inputNnFile.files?.[0];
  if (!file) return;
  try {
    await neuralEngine.loadFromFile(file);
  } catch {
    // Error already displayed via subscribe handler
  }
});

el.btnNnUnload.addEventListener('click', () => {
  neuralEngine.unload();
  state.latestOwnershipMap = null;
  renderCurrentBoard();
  showToast('已切換回內建輕量引擎');
});

// ============================================================================
// Initialize App
// ============================================================================

computeBoardSize();
updateDojoMasteryBadges();
startNewGame();
