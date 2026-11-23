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
import {
  SUPPORTED_LANGS,
  DEFAULT_LANG,
  setLang,
  t,
  localizeRank,
  getLocalizedCategory,
  getLocalizedPuzzle,
  getLocalizedBranchMessage,
  getLocalizedTrapMessage,
  applyDomTranslations,
} from './i18n.js';

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
    language: DEFAULT_LANG,
    nnPreset: 'hf-kaya-uint8',
    nnCustomUrl: '',
    nnAutoLoad: false,
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

  // Problem Review & Retry Compare Runtime
  retrySession: null, // { moveNum, originalMove: { x, y, idx, color, analysis }, savedOriginalGame: GoGame, savedWinrateHistory: [] }
  problemReviewList: [], // [{ moveNum, m, analysis }]
  problemReviewIndex: -1,

  // Dojo mode runtime
  dojoCategory: 'all',
  dojoPuzzleIndex: 0,
  dojoBoard: null,
  dojoNode: null,
  dojoStep: 0,
  dojoPathCoords: [],
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
    if (SUPPORTED_LANGS.includes(savedSettings.language)) {
      state.settings.language = savedSettings.language;
    }
    const validPresets = [...NN_MODEL_PRESETS.map((p) => p.id), 'custom'];
    if (validPresets.includes(savedSettings.nnPreset)) {
      state.settings.nnPreset = savedSettings.nnPreset;
    }
    if (typeof savedSettings.nnCustomUrl === 'string') {
      state.settings.nnCustomUrl = savedSettings.nnCustomUrl;
    }
    if (typeof savedSettings.nnAutoLoad === 'boolean') {
      state.settings.nnAutoLoad = savedSettings.nnAutoLoad;
    }
  }
} catch {
  // Ignore storage errors
}

// Initialize language module from persisted settings
setLang(state.settings.language);

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
  langSelect: document.getElementById('lang-select'),
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

  // Retry Comparison & Problem Review Elements
  retryCompareBanner: document.getElementById('retry-compare-banner'),
  retryBannerText: document.getElementById('retry-banner-text'),
  btnShowHintsRetry: document.getElementById('btn-show-hints-retry'),
  btnRestoreOriginalMove: document.getElementById('btn-restore-original-move'),
  problemReviewCard: document.getElementById('problem-review-card'),
  problemReviewTitle: document.getElementById('problem-review-title'),
  problemReviewSubtitle: document.getElementById('problem-review-subtitle'),
  problemReviewInfo: document.getElementById('problem-review-info'),
  btnPrevProblem: document.getElementById('btn-prev-problem'),
  btnPracticeCurrentProblem: document.getElementById('btn-practice-current-problem'),
  btnNextProblem: document.getElementById('btn-next-problem'),
  btnExitProblemReview: document.getElementById('btn-exit-problem-review'),

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

    // Original Move Marker during Retry Session or Problem Review
    let originalMoveMarker = null;
    if (state.retrySession && state.retrySession.originalMove && !state.retrySession.originalMove.pass) {
      originalMoveMarker = {
        x: state.retrySession.originalMove.x,
        y: state.retrySession.originalMove.y,
        moveNum: state.retrySession.moveNum,
        label: t('origMoveTag', { moveNum: state.retrySession.moveNum }),
      };
    } else if (state.problemReviewIndex >= 0 && state.problemReviewList[state.problemReviewIndex]) {
      const prob = state.problemReviewList[state.problemReviewIndex];
      if (prob && prob.m && !prob.m.pass) {
        originalMoveMarker = {
          x: prob.m.x,
          y: prob.m.y,
          moveNum: prob.moveNum,
          label: t('origMoveTag', { moveNum: prob.moveNum }),
        };
      }
    }

    renderer.render({
      board,
      viewport: null,
      hover: canHover ? state.hover : null,
      hoverColor: state.game.turn,
      lastMove,
      showCoords: true,
      showMoveNumbers: state.showNumbers,
      moveNumberMap,
      hints: (isLive || state.problemReviewIndex >= 0) ? state.activeHints : [],
      influenceMap,
      territoryMap,
      deadStones: scoringMode ? state.game.deadStones : null,
      showAtariDanger: state.showAtari && !scoringMode,
      scoringMode,
      originalMoveMarker,
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
  state.retrySession = null;
  state.problemReviewList = [];
  state.problemReviewIndex = -1;
  if (el.retryCompareBanner) el.retryCompareBanner.classList.add('hidden');
  if (el.problemReviewCard) el.problemReviewCard.classList.add('hidden');

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
    ? t('coachReadyUser')
    : t('coachReadyAi');
  el.coachExplanation.textContent = t('coachDefaultExp');
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
  el.blackName.textContent = userIsBlack ? t('youBlack') : t('aiBlack');
  el.whiteName.textContent = userIsBlack ? t('aiWhite') : t('youWhite');

  el.blackCaptures.textContent = board.captures[BLACK];
  el.whiteCaptures.textContent = board.captures[WHITE];

  el.gameMetaPill.textContent = t('gameMetaPill', {
    size: g.size,
    komi: g.komi,
    rank: localizeRank(preset.rank),
  });

  const blackActive = g.phase === 'playing' && g.turn === BLACK && isLive;
  const whiteActive = g.phase === 'playing' && g.turn === WHITE && isLive;
  el.playerBlackCard.classList.toggle('active-turn', blackActive);
  el.playerWhiteCard.classList.toggle('active-turn', whiteActive);

  if (!isLive) {
    el.turnStatus.textContent = t('turnViewing', { move: moveIndex });
  } else if (g.phase === 'scoring') {
    el.turnStatus.textContent = t('turnScoring');
  } else if (g.phase === 'finished') {
    if (g.finalScore?.resigned) {
      el.turnStatus.textContent = t('turnResignWin', {
        winner: g.finalScore.winner === BLACK ? t('blackShort') : t('whiteShort'),
      });
    } else if (g.finalScore) {
      el.turnStatus.textContent = t('turnMarginWin', {
        winnerShort: g.finalScore.winner === BLACK ? t('blackWinShort') : t('whiteWinShort'),
        margin: g.finalScore.margin.toFixed(1),
      });
    }
  } else if (state.aiThinking) {
    el.turnStatus.textContent = t('turnAiThinking');
  } else {
    el.turnStatus.textContent = g.turn === BLACK ? t('turnBlackPlay') : t('turnWhitePlay');
  }

  // Review navigation buttons
  const total = g.moves.length;
  el.moveCounter.textContent = total === 0
    ? t('moveOpening')
    : t('moveCounterFmt', { cur: moveIndex, total });
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
    el.scoringTitle.textContent = t('scoringTitle');
    el.scoringInstructions.textContent = t('scoringInstrPlaying');
    el.scoringActions.classList.remove('hidden');
    el.postgameReview.classList.add('hidden');

    const sc = calculateScore(g.board, g.komi, g.deadStones, state.settings.rules);
    renderScoreBreakdown(sc);
  } else {
    el.scoringTitle.textContent = t('scoringTitleDone');
    el.scoringActions.classList.add('hidden');

    if (g.finalScore?.resigned) {
      const winnerLabel = g.finalScore.winner === BLACK ? t('blackShort') : t('whiteShort');
      const loserLabel = g.finalScore.resignedBy === BLACK ? t('blackShort') : t('whiteShort');
      el.scoringInstructions.textContent = t('scoringInstrResign', { loser: loserLabel, winner: winnerLabel });
      el.scoreBreakdown.innerHTML = '';
    } else {
      const sc = calculateScore(g.board, g.komi, g.deadStones, state.settings.rules);
      const winnerLabel = sc.winner === BLACK ? t('blackShort') : t('whiteShort');
      el.scoringInstructions.textContent = t('scoringInstrMargin', {
        winner: winnerLabel,
        margin: sc.margin.toFixed(1),
        rules: sc.rules === 'chinese' ? t('ruleChinese') : t('ruleJapanese'),
      });
      renderScoreBreakdown(sc);
    }

    renderKeyMoments();
  }
}

function renderScoreBreakdown(sc) {
  const bSub = sc.rules === 'chinese'
    ? t('scoreSubBlackChinese', { terr: sc.blackTerritory, stones: sc.blackStones })
    : t('scoreSubBlackJapanese', { terr: sc.blackTerritory, caps: sc.blackCaptures + sc.deadWhite });
  const wSub = sc.rules === 'chinese'
    ? t('scoreSubWhiteChinese', { terr: sc.whiteTerritory, stones: sc.whiteStones, komi: sc.komi })
    : t('scoreSubWhiteJapanese', { terr: sc.whiteTerritory, caps: sc.whiteCaptures + sc.deadBlack, komi: sc.komi });

  el.scoreBreakdown.innerHTML = `
    <div class="score-box ${sc.winner === BLACK ? 'winner' : ''}">
      <div class="score-box-label">${t('scoreBlackTotal')}</div>
      <div class="score-box-val">${sc.blackTotal.toFixed(1)}</div>
      <div class="score-box-sub">${bSub}</div>
    </div>
    <div class="score-box ${sc.winner === WHITE ? 'winner' : ''}">
      <div class="score-box-label">${t('scoreWhiteTotal')}</div>
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
  const topProblems = userMoves.slice(0, 5); // Up to top 5 problem moves

  state.problemReviewList = topProblems.map((m) => ({
    moveNum: m.moveNum,
    m,
    analysis: m.analysis,
  }));

  el.postgameReview.classList.remove('hidden');
  if (topProblems.length === 0) {
    el.keyMomentsList.innerHTML = `<div class="muted-text">${t('noMistakesMsg')}</div>`;
    return;
  }

  el.keyMomentsList.innerHTML = '';
  topProblems.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'moment-row';
    const bestCoord = m.analysis.bestMoves?.[0]?.coord || '';
    const dropPct = Math.abs(m.analysis.winrateDelta * 100).toFixed(0);
    const origCoord = coordToLabel(m.x, m.y, state.game.size);
    row.innerHTML = `
      <div class="moment-info" title="${t('momentTitle', { moveNum: m.moveNum })}">
        <strong>${t('momentStrong', { moveNum: m.moveNum, coord: origCoord, dropPct })}</strong>
        <span>${m.analysis.gradeLabel}${bestCoord ? t('momentSenseiRec', { coord: bestCoord }) : ''}</span>
      </div>
      <div class="moment-actions">
        <button class="btn btn-subtle btn-inspect" style="padding:4px 8px;font-size:11.5px">${t('btnInspect')}</button>
        <button class="btn btn-accent btn-retry" style="padding:4px 8px;font-size:11.5px">${t('btnRetryShort')}</button>
      </div>
    `;
    row.querySelector('.moment-info').addEventListener('click', () => {
      startProblemReview(idx);
    });
    row.querySelector('.btn-inspect').addEventListener('click', () => {
      startProblemReview(idx);
    });
    row.querySelector('.btn-retry').addEventListener('click', () => {
      practiceFromMove(m.moveNum);
    });
    el.keyMomentsList.appendChild(row);
  });
}

function startProblemReview(probIdx) {
  if (state.problemReviewList.length === 0) return;
  const clamped = Math.max(0, Math.min(state.problemReviewList.length - 1, probIdx));
  state.problemReviewIndex = clamped;
  const prob = state.problemReviewList[clamped];

  // Jump to the state right before this move was played (moveNum - 1)
  setReviewIndex(prob.moveNum - 1);

  // Show candidate hints on board for this problem move
  if (prob.analysis?.bestMoves) {
    state.activeHints = prob.analysis.bestMoves;
  }

  // Update Problem Review Card UI
  el.problemReviewCard.classList.remove('hidden');
  el.problemReviewSubtitle.textContent = t('problemReviewSubtitle', {
    cur: clamped + 1,
    total: state.problemReviewList.length,
  });
  const origCoord = coordToLabel(prob.m.x, prob.m.y, state.game.size);
  const bestCoord = prob.analysis.bestMoves?.[0]?.coord || '';
  const dropPct = Math.abs(prob.analysis.winrateDelta * 100).toFixed(1);
  const recDetail = bestCoord
    ? t('problemReviewRecTop', { coord: bestCoord, reason: prob.analysis.bestMoves[0]?.reason || '' })
    : t('problemReviewRecBoard');

  el.problemReviewInfo.innerHTML = `
    <div style="margin-bottom:4px;">
      <strong style="color:var(--text-primary)">${t('problemReviewMoveLabel', { moveNum: prob.moveNum, coord: origCoord })}</strong>
      <span class="grade-badge grade-${prob.analysis.grade}" style="margin-left:6px">${prob.analysis.gradeLabel}</span>
      <span style="color:var(--text-muted);font-size:12px;margin-left:4px">${t('problemReviewDrop', { dropPct })}</span>
    </div>
    <div style="font-weight:600;color:var(--accent-gold);margin-bottom:3px">${prob.analysis.headline}</div>
    <div style="font-size:12px;color:var(--text-secondary);line-height:1.45">${prob.analysis.explanation}</div>
    <div style="margin-top:6px;font-size:11.5px;color:var(--emerald)">
      ${t('problemReviewRec', { detail: recDetail })}
    </div>
  `;

  el.btnPrevProblem.disabled = clamped <= 0;
  el.btnNextProblem.disabled = clamped >= state.problemReviewList.length - 1;

  // Highlight corresponding moment row
  const rows = el.keyMomentsList.querySelectorAll('.moment-row');
  rows.forEach((r, i) => r.classList.toggle('active', i === clamped));

  renderCurrentBoard();
}

function exitProblemReview() {
  state.problemReviewIndex = -1;
  state.activeHints = [];
  el.problemReviewCard.classList.add('hidden');
  const rows = el.keyMomentsList.querySelectorAll('.moment-row');
  rows.forEach((r) => r.classList.remove('active'));
  renderCurrentBoard();
}

function cloneGame(srcGame) {
  const cloned = new GoGame({
    size: srcGame.size,
    komi: srcGame.komi,
    handicap: srcGame.handicap,
    rules: srcGame.rules,
  });
  // Replay moves
  for (const m of srcGame.moves) {
    if (m.pass) {
      cloned.playPass();
    } else {
      cloned.playMove(m.x, m.y);
    }
  }
  return cloned;
}

function practiceFromMove(moveNum) {
  // Check if target move exists in game
  const targetMove = state.game.moves.find((m) => m.moveNum === moveNum);
  if (!targetMove) return;

  // If we don't have a saved backup of the original game yet, save it now!
  if (!state.retrySession) {
    state.retrySession = {
      moveNum,
      originalMove: {
        x: targetMove.x,
        y: targetMove.y,
        idx: targetMove.idx,
        color: targetMove.color,
        pass: targetMove.pass,
        analysis: targetMove.analysis,
      },
      savedOriginalGame: cloneGame(state.game),
      savedWinrateHistory: [...state.winrateHistory],
    };
  } else {
    // Updating existing retry session's target
    state.retrySession.moveNum = moveNum;
    state.retrySession.originalMove = {
      x: targetMove.x,
      y: targetMove.y,
      idx: targetMove.idx,
      color: targetMove.color,
      pass: targetMove.pass,
      analysis: targetMove.analysis,
    };
  }

  // Undo back to just before moveNum so user can replay that decision live against AI
  const stepsToUndo = state.game.moves.length - (moveNum - 1);
  if (stepsToUndo > 0) {
    state.aiRunId++;
    state.aiThinking = false;
    state.game.undo(stepsToUndo);
    state.winrateHistory = state.winrateHistory.slice(0, state.game.moves.length + 1);
  }

  state.reviewIndex = null;
  state.activeHints = [];
  el.coachGradeRow.classList.add('hidden');
  el.btnRetryMove.classList.add('hidden');

  const origCoord = coordToLabel(state.retrySession.originalMove.x, state.retrySession.originalMove.y, state.game.size);
  el.coachHeadline.textContent = t('coachRetryHead', { moveNum, coord: origCoord });
  el.coachExplanation.textContent = t('coachRetryExp', { coord: origCoord });

  // Update retry banner on the board
  if (el.retryCompareBanner) {
    el.retryCompareBanner.classList.remove('hidden');
    el.retryBannerText.textContent = t('retryBannerText', { moveNum, coord: origCoord });
  }

  updatePlayUI();
  renderCurrentBoard();
  showToast(t('toastRetryRewound', { moveNum, coord: origCoord }));
}

function restoreOriginalGame() {
  if (!state.retrySession || !state.retrySession.savedOriginalGame) return;
  state.aiRunId++;
  state.aiThinking = false;

  state.game = state.retrySession.savedOriginalGame;
  state.winrateHistory = state.retrySession.savedWinrateHistory || [];
  state.retrySession = null;
  state.activeHints = [];
  state.reviewIndex = null;

  if (el.retryCompareBanner) {
    el.retryCompareBanner.classList.add('hidden');
  }

  resetCoachMessage();
  updatePlayUI();
  renderCurrentBoard();
  showToast(t('toastRestoredOriginal'));
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
    el.scoreLeadBadge.textContent = t('leadEven');
  } else if (lead > 0) {
    el.scoreLeadBadge.textContent = t('leadBlack', { lead: lead.toFixed(1) });
  } else {
    el.scoreLeadBadge.textContent = t('leadWhite', { lead: Math.abs(lead).toFixed(1) });
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
    showToast(t('toastViewingHistory'));
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
    showToast(res.reason || t('toastIllegalMove'));
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
    el.coachHeadline.textContent = t('coachEvaluatingHead');
    el.coachExplanation.textContent = t('coachEvaluatingExp');
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

    // If this move was made during a retry session, compare with original move!
    if (state.retrySession && state.retrySession.originalMove) {
      const orig = state.retrySession.originalMove;
      const origCoord = coordToLabel(orig.x, orig.y, g.size);
      const newCoord = coordToLabel(moveRecord.x, moveRecord.y, g.size);
      const origWrDrop = orig.analysis?.winrateDelta || -0.15;
      const newWrDelta = evaluation.winrateDelta || 0;
      const wrDiffPct = ((newWrDelta - origWrDrop) * 100).toFixed(1);

      if (newWrDelta > origWrDrop + 0.03) {
        evaluation.headline = t('coachRetryBetterHead', { newCoord, origCoord });
        evaluation.explanation = t('coachRetryBetterExp', { diff: wrDiffPct, origExp: evaluation.explanation });
      } else if (newWrDelta < origWrDrop - 0.03) {
        evaluation.headline = t('coachRetryWorseHead', { newCoord, origCoord });
        evaluation.explanation = t('coachRetryWorseExp', { diff: wrDiffPct, origExp: evaluation.explanation });
      } else {
        evaluation.headline = t('coachRetrySimilarHead', { newCoord, origCoord });
      }
    }

    displayCoachEvaluation(evaluation, true);
    updateWinrateDisplay(g.moves.length);
  }

  // Clear retry session banner on board once live play resumes beyond that move
  if (state.retrySession && g.moves.length > state.retrySession.moveNum) {
    state.retrySession = null;
    if (el.retryCompareBanner) el.retryCompareBanner.classList.add('hidden');
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
    el.coachDelta.textContent = t('coachDeltaWr', { delta: (ev.winrateDelta * 100).toFixed(1) });
  } else {
    el.coachDelta.textContent = t('coachDeltaMatch');
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
    showToast(passRes.enteredScoring ? t('toastBothPassed') : t('toastAiPassed'));
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
  el.btnAskHint.textContent = t('btnAskHintAnalyzing');

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
    <span id="btn-ask-hint-label" data-i18n="btnAskHint">${t('btnAskHint')}</span>
  `;

  if (analysis.passRecommended || analysis.topMoves.length === 0) {
    state.activeHints = [];
    el.coachHeadline.textContent = t('coachPassHead');
    el.coachExplanation.textContent = t('coachPassExp');
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
    item.title = t('candClickTitle', { coord: m.coord });
    item.innerHTML = `
      <span class="cand-letter c${i}">${letters[i]}</span>
      <div class="cand-details">
        <div class="cand-top">
          <span class="cand-coord">${m.coord}</span>
          <span class="cand-wr">${t('candWr', { pct: Math.round(m.playerWinrate * 100) })}</span>
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

  // If in retry session, clear banner when undoing further or manual undo
  if (!retryMode && state.retrySession) {
    state.retrySession = null;
    if (el.retryCompareBanner) el.retryCompareBanner.classList.add('hidden');
  }

  // Find the player's last move to record as originalMove for retry mode
  let playerMoveToRetry = null;
  for (let i = g.moves.length - 1; i >= 0; i--) {
    if (g.moves[i].color === state.settings.playerColor) {
      playerMoveToRetry = g.moves[i];
      break;
    }
  }

  if (retryMode && playerMoveToRetry) {
    if (!state.retrySession) {
      state.retrySession = {
        moveNum: playerMoveToRetry.moveNum,
        originalMove: {
          x: playerMoveToRetry.x,
          y: playerMoveToRetry.y,
          idx: playerMoveToRetry.idx,
          color: playerMoveToRetry.color,
          pass: playerMoveToRetry.pass,
          analysis: playerMoveToRetry.analysis,
        },
        savedOriginalGame: cloneGame(g),
        savedWinrateHistory: [...state.winrateHistory],
      };
    } else {
      state.retrySession.moveNum = playerMoveToRetry.moveNum;
      state.retrySession.originalMove = {
        x: playerMoveToRetry.x,
        y: playerMoveToRetry.y,
        idx: playerMoveToRetry.idx,
        color: playerMoveToRetry.color,
        pass: playerMoveToRetry.pass,
        analysis: playerMoveToRetry.analysis,
      };
    }
  }

  // Undo back to the player's turn (usually 2 moves if AI already replied, or 1 move if it's AI's turn)
  let steps = 1;
  if (g.turn === state.settings.playerColor && g.moves.length >= 2) {
    steps = 2;
  }
  g.undo(steps);
  state.winrateHistory = state.winrateHistory.slice(0, g.moves.length + 1);

  if (retryMode && state.retrySession?.originalMove) {
    el.btnRetryMove.classList.add('hidden');
    el.coachGradeRow.classList.add('hidden');
    const origCoord = coordToLabel(state.retrySession.originalMove.x, state.retrySession.originalMove.y, state.game.size);
    el.coachHeadline.textContent = t('coachRetryHead', { moveNum: state.retrySession.moveNum, coord: origCoord });
    el.coachExplanation.textContent = t('coachRetryExp', { coord: origCoord });
    if (el.retryCompareBanner) {
      el.retryCompareBanner.classList.remove('hidden');
      el.retryBannerText.textContent = t('retryBannerText', { moveNum: state.retrySession.moveNum, coord: origCoord });
    }
    showToast(t('toastRetryBack', { moveNum: state.retrySession.moveNum, coord: origCoord }));
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
    showToast(t('toastBothPassed'));
    updatePlayUI();
    renderCurrentBoard();
  } else {
    showToast(t('toastYouPassed'));
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
  showToast(t('toastYouResigned'));
  updatePlayUI();
  renderCurrentBoard();
}

function handleExportSgf() {
  const preset = DIFFICULTY_PRESETS[state.settings.difficulty] || DIFFICULTY_PRESETS.club;
  const sgf = state.game.exportSGF(state.settings.playerColor, t('sgfAiLabel', { rank: localizeRank(preset.rank) }));
  const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  a.href = url;
  a.download = `kaya-sensei-${state.game.size}x${state.game.size}-${dateStr}.sgf`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(t('toastSgfExported'));
}

// ============================================================================
// Practice Dojo Logic
// ============================================================================

function updateDojoMasteryBadges() {
  const solvedCount = PUZZLES.filter((p) => state.dojoSolvedSet.has(p.id)).length;
  const total = PUZZLES.length;
  el.dojoBadgeCount.textContent = `${solvedCount}/${total}`;
  el.dojoMasteryText.textContent = t('dojoMasteryText', { solved: solvedCount, total });
  el.dojoMasteryFill.style.width = `${Math.round((solvedCount / total) * 100)}%`;
}

function renderDojoCurriculum() {
  updateDojoMasteryBadges();

  // Category filter pills
  el.dojoCategoryPills.innerHTML = '';
  const allCats = [{ id: 'all', name: t('dojoCatAll') }, ...PUZZLE_CATEGORIES.map(getLocalizedCategory)];
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
  const filtered = PUZZLES.map((p, idx) => ({ p: getLocalizedPuzzle(p), idx })).filter(
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
  const rawPuzzle = PUZZLES[clamped];
  const puzzle = getLocalizedPuzzle(rawPuzzle);

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
  state.dojoNode = rawPuzzle.tree;
  state.dojoStep = 0;
  state.dojoPathCoords = [];
  state.dojoStatus = 'playing';
  state.dojoLastMove = null;
  state.dojoHintLevel = 0;

  // Populate UI
  const rawCat = PUZZLE_CATEGORIES.find((c) => c.id === puzzle.category);
  const cat = rawCat ? getLocalizedCategory(rawCat) : null;
  el.dojoCatTag.textContent = cat ? cat.name : puzzle.category;
  el.dojoBoardTitle.textContent = puzzle.title;
  el.dojoRankPill.textContent = puzzle.rank;
  el.dojoSolvedPill.classList.toggle('hidden', !state.dojoSolvedSet.has(puzzle.id));
  el.dojoStepIndicator.textContent = puzzle.playerColor === BLACK ? t('dojoBlackFirst') : t('dojoWhiteFirst');

  el.dojoGoal.textContent = puzzle.goal;
  el.dojoBriefing.textContent = puzzle.briefing;

  setDojoFeedback('neutral', t('dojoTurnTitle'), t('dojoTurnBody'), false);

  el.dojoHintBox.classList.add('hidden');
  el.dojoHintLabel.textContent = t('dojoHintBtn', { n: 1 });
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

  const rawPuzzle = PUZZLES[state.dojoPuzzleIndex];
  const puzzle = getLocalizedPuzzle(rawPuzzle);
  const coord = coordToLabel(x, y, puzzle.size);
  const res = state.dojoBoard.play(x, y, puzzle.playerColor);

  if (!res.legal) {
    sound.playSoftError();
    showToast(res.reason || t('toastIllegalMove'));
    return;
  }

  state.dojoLastMove = { x, y, color: puzzle.playerColor };
  sound.playStone(res.captured.length > 0);
  renderCurrentBoard();

  // Check if move is in current solution tree
  const branch = state.dojoNode ? state.dojoNode[coord] : null;
  if (branch) {
    state.dojoPathCoords.push(coord);
    const msg = getLocalizedBranchMessage(rawPuzzle, state.dojoPathCoords, branch.message);

    // Clear exact hint markers once user advances
    if (state.dojoHintLevel >= 2) {
      state.dojoHintLevel = 0;
      el.dojoHintLabel.textContent = t('dojoHintBtn', { n: 1 });
    }

    if (branch.status === 'solved') {
      state.dojoStatus = 'solved';
      state.dojoSolvedSet.add(puzzle.id);
      persistSolved();
      sound.playSolved();
      el.dojoSolvedPill.classList.remove('hidden');
      el.dojoTakeawayBox.classList.remove('hidden');
      el.dojoTakeawayText.textContent = puzzle.takeaway;
      setDojoFeedback('solved', t('dojoSolvedTitle'), msg, false);
      renderDojoCurriculum();
      renderCurrentBoard();
      return;
    }

    // Multi-move continuation: opponent plays strongest resistance
    state.dojoStatus = 'animating';
    setDojoFeedback('continue', t('dojoContinueTitle'), msg, false);

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
  const trap = state.dojoStep === 0 && rawPuzzle.traps ? rawPuzzle.traps[coord] : null;
  state.dojoStatus = 'animating';

  if (trap) {
    const trapMsg = getLocalizedTrapMessage(rawPuzzle, coord, trap.message);
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
      setDojoFeedback('wrong', t('dojoWrongTrapTitle', { coord }), trapMsg, true);
      renderCurrentBoard();
    }, 320);
  } else {
    state.dojoStatus = 'wrong';
    sound.playSoftError();
    setDojoFeedback(
      'wrong',
      t('dojoWrongOtherTitle', { coord }),
      t('dojoWrongOtherBody'),
      true
    );
  }
}

function handleDojoHint() {
  if (state.dojoStatus !== 'playing') {
    loadDojoPuzzle(state.dojoPuzzleIndex);
  }
  const puzzle = getLocalizedPuzzle(PUZZLES[state.dojoPuzzleIndex]);
  state.dojoHintLevel = Math.min(3, state.dojoHintLevel + 1);

  const hintEntry = puzzle.hints[state.dojoHintLevel - 1];
  const hintText = typeof hintEntry === 'string' ? hintEntry : hintEntry?.text || '';

  el.dojoHintBox.classList.remove('hidden');
  el.dojoHintText.textContent = hintText;

  if (state.dojoHintLevel >= 3) {
    el.dojoHintLabel.textContent = t('dojoHintDone');
    el.btnDojoHint.disabled = true;
  } else {
    el.dojoHintLabel.textContent = t('dojoHintBtn', { n: state.dojoHintLevel + 1 });
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

// Retry Banner actions
if (el.btnShowHintsRetry) {
  el.btnShowHintsRetry.addEventListener('click', handleAskSenseiHint);
}
if (el.btnRestoreOriginalMove) {
  el.btnRestoreOriginalMove.addEventListener('click', restoreOriginalGame);
}

// Problem Review Card actions
if (el.btnPrevProblem) {
  el.btnPrevProblem.addEventListener('click', () => {
    if (state.problemReviewIndex > 0) {
      startProblemReview(state.problemReviewIndex - 1);
    }
  });
}
if (el.btnNextProblem) {
  el.btnNextProblem.addEventListener('click', () => {
    if (state.problemReviewIndex < state.problemReviewList.length - 1) {
      startProblemReview(state.problemReviewIndex + 1);
    }
  });
}
if (el.btnPracticeCurrentProblem) {
  el.btnPracticeCurrentProblem.addEventListener('click', () => {
    if (state.problemReviewIndex >= 0 && state.problemReviewList[state.problemReviewIndex]) {
      const prob = state.problemReviewList[state.problemReviewIndex];
      practiceFromMove(prob.moveNum);
    }
  });
}
if (el.btnExitProblemReview) {
  el.btnExitProblemReview.addEventListener('click', exitProblemReview);
}

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
  showToast(t('toastResumed'));
});

// Dojo toolbar
el.btnDojoReset.addEventListener('click', () => loadDojoPuzzle(state.dojoPuzzleIndex));
el.btnDojoTryAgain.addEventListener('click', () => loadDojoPuzzle(state.dojoPuzzleIndex));
el.btnDojoHint.addEventListener('click', handleDojoHint);
el.btnDojoPrev.addEventListener('click', () => loadDojoPuzzle(state.dojoPuzzleIndex - 1));
el.btnDojoNext.addEventListener('click', () => loadDojoPuzzle(state.dojoPuzzleIndex + 1));

// Language Selector
function applyLanguage(lang) {
  const validLang = setLang(lang);
  state.settings.language = validLang;
  persistSettings();
  if (el.langSelect) {
    el.langSelect.value = validLang;
  }
  applyDomTranslations();
  updateDojoMasteryBadges();

  // Refresh active view
  if (state.game) {
    updatePlayUI();
    if (state.retrySession && state.retrySession.originalMove && el.retryCompareBanner && !el.retryCompareBanner.classList.contains('hidden')) {
      const origCoord = coordToLabel(state.retrySession.originalMove.x, state.retrySession.originalMove.y, state.game.size);
      el.retryBannerText.textContent = t('retryBannerText', { moveNum: state.retrySession.moveNum, coord: origCoord });
      el.coachHeadline.textContent = t('coachRetryHead', { moveNum: state.retrySession.moveNum, coord: origCoord });
      el.coachExplanation.textContent = t('coachRetryExp', { coord: origCoord });
    } else if (state.game.moves.length === 0) {
      resetCoachMessage();
    }
    if (state.problemReviewIndex >= 0 && state.problemReviewList.length > 0) {
      startProblemReview(state.problemReviewIndex);
    }
  }
  if (state.mode === 'dojo') {
    loadDojoPuzzle(state.dojoPuzzleIndex);
  }
  if (typeof neuralEngine.getSnapshot === 'function') {
    updateNeuralUI(neuralEngine.getSnapshot(), true);
  }
  renderCurrentBoard();
}

if (el.langSelect) {
  el.langSelect.value = state.settings.language;
  el.langSelect.addEventListener('change', () => {
    applyLanguage(el.langSelect.value);
  });
}

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

function updateNeuralUI(snap, silent = false) {
  const { status, backend, modelName, lastError, progress } = snap;

  el.nnStatusBadge.className = `nn-badge ${status}`;
  if (status === 'idle') {
    el.nnStatusBadge.textContent = t('nnBadgeIdle');
    el.nnProgressWrap.classList.add('hidden');
    el.nnErrorMsg.classList.add('hidden');
    el.btnNnLoad.classList.remove('hidden');
    el.btnNnLoad.disabled = false;
    el.btnNnFile.disabled = false;
    el.btnNnUnload.classList.add('hidden');
    el.nnActiveInfo.textContent = t('nnNoteDefault');
  } else if (status === 'loading') {
    el.nnStatusBadge.textContent = t('nnBadgeLoading');
    el.nnProgressWrap.classList.remove('hidden');
    el.nnErrorMsg.classList.add('hidden');
    el.btnNnLoad.disabled = true;
    el.btnNnFile.disabled = true;
    el.btnNnUnload.classList.add('hidden');

    if (progress) {
      if (progress.phase === 'cache') {
        el.nnProgressText.textContent = t('nnProgCache');
        el.nnProgressPct.textContent = '100%';
        el.nnProgressFill.style.width = '100%';
      } else if (progress.phase === 'compile') {
        el.nnProgressText.textContent = t('nnProgInit');
        el.nnProgressPct.textContent = '100%';
        el.nnProgressFill.style.width = '100%';
      } else {
        const mbStr = progress.loadedMB > 0
          ? ` (${progress.loadedMB.toFixed(1)}${progress.totalMB > 0 ? ` / ${progress.totalMB.toFixed(1)}` : ''} MB)`
          : '';
        el.nnProgressText.textContent = t('nnProgDownload', { mb: mbStr });
        const pct = progress.pct >= 0 ? progress.pct : 55;
        el.nnProgressPct.textContent = progress.pct >= 0 ? `${pct}%` : t('nnProgDownloading');
        el.nnProgressFill.style.width = `${pct}%`;
      }
    }
  } else if (status === 'ready') {
    const backendLabel = backend === 'webgpu' ? t('nnBackendWebgpu') : t('nnBackendWasm');
    el.nnStatusBadge.textContent = backendLabel;
    el.nnProgressWrap.classList.add('hidden');
    el.nnErrorMsg.classList.add('hidden');
    el.btnNnLoad.classList.add('hidden');
    el.btnNnFile.disabled = false;
    el.btnNnUnload.classList.remove('hidden');
    el.nnActiveInfo.textContent = t('nnActiveInfo', { name: modelName, backend: backendLabel });
    if (!silent) showToast(t('nnToastReady', { backend: backendLabel }));
  } else if (status === 'error') {
    el.nnStatusBadge.textContent = t('nnBadgeError');
    el.nnProgressWrap.classList.add('hidden');
    el.nnErrorMsg.classList.remove('hidden');
    el.nnErrorMsg.textContent = t('nnErrLoad', { err: lastError || t('nnErrUnknown') });
    el.btnNnLoad.classList.remove('hidden');
    el.btnNnLoad.disabled = false;
    el.btnNnFile.disabled = false;
    el.btnNnUnload.classList.add('hidden');
  }
}

neuralEngine.subscribe(updateNeuralUI);

el.nnPresetSelect.addEventListener('change', () => {
  const val = el.nnPresetSelect.value;
  state.settings.nnPreset = val;
  persistSettings();
  const isCustom = val === 'custom';
  el.nnCustomUrl.classList.toggle('hidden', !isCustom);
  el.nnErrorMsg.classList.add('hidden');
});

el.nnCustomUrl.addEventListener('change', () => {
  state.settings.nnCustomUrl = el.nnCustomUrl.value.trim();
  persistSettings();
});

async function loadSelectedNeuralNet() {
  const val = el.nnPresetSelect.value;
  let url = '';
  let name = '';
  if (val === 'custom') {
    url = el.nnCustomUrl.value.trim();
    if (!url) {
      el.nnErrorMsg.classList.remove('hidden');
      el.nnErrorMsg.textContent = t('nnErrInvalidUrl');
      return;
    }
    state.settings.nnCustomUrl = url;
    name = url.split('/').pop() || t('nnCustomModelName');
  } else {
    const preset = NN_MODEL_PRESETS.find((p) => p.id === val);
    if (!preset) return;
    url = preset.url;
    const presetKeyMap = {
      'hf-kaya-uint8': 'nnOptHfUint8',
      'hf-kaya-fp16': 'nnOptHf',
      'repo-local': 'nnOptRepo',
    };
    name = presetKeyMap[preset.id] ? t(presetKeyMap[preset.id]) : preset.name;
  }
  state.settings.nnPreset = val;
  persistSettings();
  try {
    await neuralEngine.loadFromUrl(url, name);
    state.settings.nnAutoLoad = true;
    persistSettings();
  } catch {
    // Error already displayed via subscribe handler
  }
}

el.btnNnLoad.addEventListener('click', loadSelectedNeuralNet);

el.btnNnFile.addEventListener('click', () => {
  el.inputNnFile.value = '';
  el.inputNnFile.click();
});

el.inputNnFile.addEventListener('change', async () => {
  const file = el.inputNnFile.files?.[0];
  if (!file) return;
  try {
    await neuralEngine.loadFromFile(file);
    // Local file handles cannot be re-opened automatically across reloads
    state.settings.nnAutoLoad = false;
    persistSettings();
  } catch {
    // Error already displayed via subscribe handler
  }
});

el.btnNnUnload.addEventListener('click', () => {
  neuralEngine.unload();
  state.settings.nnAutoLoad = false;
  persistSettings();
  state.latestOwnershipMap = null;
  renderCurrentBoard();
  showToast(t('nnToastUnloaded'));
});

// ============================================================================
// Initialize App
// ============================================================================

applyDomTranslations();
if (el.langSelect) {
  el.langSelect.value = state.settings.language;
}
if (el.nnPresetSelect) {
  el.nnPresetSelect.value = state.settings.nnPreset;
  el.nnCustomUrl.value = state.settings.nnCustomUrl || '';
  el.nnCustomUrl.classList.toggle('hidden', state.settings.nnPreset !== 'custom');
}
computeBoardSize();
updateDojoMasteryBadges();
startNewGame();

// Auto-restore cached neural net if the user previously enabled one
if (state.settings.nnAutoLoad) {
  loadSelectedNeuralNet();
}
