// ============================================================================
// In-Browser Neural Network Engine (ONNX Runtime Web — WebGPU / WASM)
// Supports KataGo V7 ONNX models (bin_input [1,22,H,W] + global_input [1,19])
// with automatic Browser Cache API persistence & streaming download progress
// ============================================================================

import { EMPTY, BLACK, WHITE, opponent } from './engine.js';
import { t } from './i18n.js';

const ORT_CDN_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.webgpu.min.js';
const MODEL_CACHE_NAME = 'kaya-sensei-onnx-v1';

// Default model presets (users can also drop ./models/katago.onnx for GitHub Pages
// or paste any HTTPS Hugging Face / custom .onnx URL, or load a local .onnx file)
export const NN_MODEL_PRESETS = [
  {
    id: 'repo-local',
    name: '專案內建模型（./models/katago.onnx）',
    url: './models/katago.onnx',
    note: '適合 GitHub Pages：將 .onnx 放入 models/ 資料夾即可自動載入。',
  },
  {
    id: 'hf-kaya-fp16',
    name: 'KataGo b28c512 FP16（Hugging Face · 強職業級）',
    url: 'https://huggingface.co/kaya-go/kaya/resolve/main/kata1-b28c512nbt-adam-s11165M-d5387M.fp16.onnx',
    note: '需要較多記憶體與 WebGPU；初次下載後自動快取於瀏覽器。',
  },
];

let ortLoadPromise = null;

async function ensureOrtLoaded() {
  if (typeof window !== 'undefined' && window.ort) return window.ort;
  if (ortLoadPromise) return ortLoadPromise;

  ortLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ORT_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.ort) {
        // Point WASM binaries to matching CDN path so single-threaded WASM works on GitHub Pages
        if (window.ort.env && window.ort.env.wasm) {
          window.ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
          // Single-threaded WASM avoids needing COOP/COEP headers on GitHub Pages
          window.ort.env.wasm.numThreads = 1;
        }
        resolve(window.ort);
      } else {
        reject(new Error(t('nnErrOrtLoad')));
      }
    };
    script.onerror = () => reject(new Error(t('nnErrOrtCdn')));
    document.head.appendChild(script);
  });

  return ortLoadPromise;
}

export async function detectBestBackend() {
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    } catch {
      // Fallback to wasm
    }
  }
  return 'wasm';
}

// ============================================================================
// KataGo V7 Spatial & Global Feature Encoder
// ============================================================================

export function encodeKataGoV7(board, colorToPlay, {
  komi = 6.5,
  rules = 'chinese',
  recentMoves = [], // array of { x, y, pass } oldest -> newest
  targetBoardSize = null, // e.g., 19 if model has fixed 19x19 spatial dims
} = {}) {
  const size = board.size;
  const H = targetBoardSize || size;
  const W = targetBoardSize || size;
  const planeSize = H * W;
  const opp = opponent(colorToPlay);

  const bin = new Float32Array(22 * planeSize);
  const glob = new Float32Array(19);

  // Precompute liberty counts for all groups
  const libCountGrid = new Uint8Array(size * size);
  const groups = board.getAllGroups();
  for (const grp of groups) {
    const lc = Math.min(4, grp.liberties.size);
    for (const s of grp.stones) libCountGrid[s] = lc;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcIdx = y * size + x;
      const dstIdx = y * W + x;
      const c = board.grid[srcIdx];

      // Channel 0: On-board mask
      bin[0 * planeSize + dstIdx] = 1.0;

      if (c === colorToPlay) {
        // Channel 1: Current player stones
        bin[1 * planeSize + dstIdx] = 1.0;
      } else if (c === opp) {
        // Channel 2: Opponent stones
        bin[2 * planeSize + dstIdx] = 1.0;
      }

      if (c !== EMPTY) {
        const libs = libCountGrid[srcIdx];
        if (libs === 1) bin[3 * planeSize + dstIdx] = 1.0;      // Channel 3: 1 liberty (atari)
        else if (libs === 2) bin[4 * planeSize + dstIdx] = 1.0; // Channel 4: 2 liberties
        else if (libs === 3) bin[5 * planeSize + dstIdx] = 1.0; // Channel 5: 3 liberties
      }

      // Channel 6: Simple Ko-illegal point
      if (srcIdx === board.koPoint) {
        bin[6 * planeSize + dstIdx] = 1.0;
      }
    }
  }

  // Channels 9..13: Last 5 moves (t-1 .. t-5) & Global 0..4: Pass history
  const histLen = Math.min(5, recentMoves.length);
  for (let k = 0; k < histLen; k++) {
    const m = recentMoves[recentMoves.length - 1 - k];
    if (m.pass || m.x < 0 || m.y < 0) {
      glob[k] = 1.0;
    } else if (m.x < W && m.y < H) {
      bin[(9 + k) * planeSize + (m.y * W + m.x)] = 1.0;
    }
  }

  // Global 5: Self-komi / 20.0 (positive if current player receives komi)
  const selfKomi = colorToPlay === WHITE ? komi : -komi;
  glob[5] = selfKomi / 20.0;

  // Global 6: Ko rule (0.0 = positional superko)
  glob[6] = 0.0;
  // Global 7: Suicide disallowed (0.0)
  glob[7] = 0.0;
  // Global 8: Scoring (0.0 = Chinese Area, 1.0 = Japanese Territory)
  glob[8] = rules === 'japanese' ? 1.0 : 0.0;

  return {
    binInput: bin,
    globalInput: glob,
    spatialH: H,
    spatialW: W,
  };
}

// ============================================================================
// Softmax & KataGo Output Decoder
// ============================================================================

function softmax(arr, start = 0, length = arr.length) {
  let maxVal = -Infinity;
  for (let i = 0; i < length; i++) {
    const v = arr[start + i];
    if (v > maxVal) maxVal = v;
  }
  const out = new Float32Array(length);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const e = Math.exp(arr[start + i] - maxVal);
    out[i] = e;
    sum += e;
  }
  if (sum > 0) {
    for (let i = 0; i < length; i++) out[i] /= sum;
  }
  return out;
}

function decodeKataGoOutputs(results, boardSize, spatialH, spatialW, colorToPlay) {
  const keys = Object.keys(results);

  // Locate policy, value, and ownership tensors by common KataGo ONNX names or shapes
  let policyTensor = results.policy || results.out_policy || results.policy_logits || null;
  let valueTensor = results.value || results.out_value || results.value_logits || null;
  let ownershipTensor = results.ownership || results.out_ownership || null;
  let miscValueTensor = results.miscvalues || results.out_miscvalue || results.score_value || null;

  for (const k of keys) {
    const t = results[k];
    const d = t.dims;
    const low = k.toLowerCase();
    if (!policyTensor && (low.includes('policy') || (d.length >= 2 && d[d.length - 1] === spatialH * spatialW + 1))) {
      policyTensor = t;
    } else if (!valueTensor && (low === 'value' || low.includes('value_logit') || (d.length === 2 && d[1] === 3))) {
      valueTensor = t;
    } else if (!ownershipTensor && (low.includes('owner') || (d.length >= 3 && d[d.length - 1] === spatialW && d[d.length - 2] === spatialH))) {
      ownershipTensor = t;
    } else if (!miscValueTensor && (low.includes('misc') || low.includes('score'))) {
      miscValueTensor = t;
    }
  }

  // 1. Policy probabilities mapped back to boardSize x boardSize + pass
  const totalBoard = boardSize * boardSize;
  const policyProbs = new Float32Array(totalBoard);
  let passProb = 0;

  if (policyTensor) {
    const pData = policyTensor.data;
    const flatLen = spatialH * spatialW + 1;
    // KataGo policy may be [1, 2, H*W+1] (channel 0 = current move policy) or [1, H*W+1]
    const probs = softmax(pData, 0, Math.min(flatLen, pData.length));
    let sumValid = 0;
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        const p = probs[y * spatialW + x] || 0;
        policyProbs[y * boardSize + x] = p;
        sumValid += p;
      }
    }
    passProb = probs[spatialH * spatialW] || 0;
    sumValid += passProb;
    if (sumValid > 0) {
      for (let i = 0; i < totalBoard; i++) policyProbs[i] /= sumValid;
      passProb /= sumValid;
    }
  }

  // 2. Winrate from Black's perspective
  let playerWinrate = 0.5;
  if (valueTensor && valueTensor.data.length >= 2) {
    const vData = valueTensor.data;
    if (vData.length >= 3) {
      // KataGo V7 value logits: [win, loss, noresult] from current player's perspective
      const vp = softmax(vData, 0, 3);
      playerWinrate = vp[0] + 0.5 * vp[2];
    } else {
      // Single scalar or [win, loss]
      const vp = softmax(vData, 0, 2);
      playerWinrate = vp[0];
    }
  }
  const blackWinrate = colorToPlay === BLACK ? playerWinrate : (1 - playerWinrate);

  // 3. Ownership map [-1 White .. +1 Black]
  let ownershipBlack = null;
  if (ownershipTensor) {
    const oData = ownershipTensor.data;
    ownershipBlack = new Float32Array(totalBoard);
    const sign = colorToPlay === BLACK ? 1 : -1;
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        const raw = oData[y * spatialW + x] || 0;
        ownershipBlack[y * boardSize + x] = Math.tanh(raw) * sign;
      }
    }
  }

  // 4. Score lead estimate (from miscvalues or ownership sum)
  let scoreLeadBlack = (blackWinrate - 0.5) * 14;
  if (miscValueTensor && miscValueTensor.data.length >= 3) {
    // In KataGo miscvalues, index 2 is typically expected score / 20.0 from current player perspective
    const rawLead = miscValueTensor.data[2] * 20.0;
    if (Number.isFinite(rawLead) && Math.abs(rawLead) < 300) {
      scoreLeadBlack = colorToPlay === BLACK ? rawLead : -rawLead;
    }
  } else if (ownershipBlack) {
    let sumOwn = 0;
    for (let i = 0; i < totalBoard; i++) sumOwn += ownershipBlack[i];
    scoreLeadBlack = sumOwn;
  }

  return {
    policyProbs,
    passProb,
    playerWinrate,
    blackWinrate,
    scoreLeadBlack,
    ownershipBlack,
  };
}

// ============================================================================
// NeuralEngineManager — Singleton managing model loading, caching & inference
// ============================================================================

class NeuralEngineManager {
  constructor() {
    this.session = null;
    this.status = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
    this.backend = null;  // 'webgpu' | 'wasm'
    this.modelName = '';
    this.fixedBoardSize = null; // null = dynamic axes, or 19 if fixed 19x19
    this.inputNames = { bin: 'bin_input', global: 'global_input' };
    this.lastError = null;
    this.evalCount = 0;
    this._listeners = new Set();
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify(progress = null) {
    const snap = {
      status: this.status,
      backend: this.backend,
      modelName: this.modelName,
      fixedBoardSize: this.fixedBoardSize,
      lastError: this.lastError,
      progress,
    };
    this._listeners.forEach((fn) => fn(snap));
  }

  isReady() {
    return this.status === 'ready' && this.session !== null;
  }

  unload() {
    this.session = null;
    this.status = 'idle';
    this.modelName = '';
    this.lastError = null;
    this._notify();
  }

  async _fetchWithCacheAndProgress(url, onProgress) {
    // 1. Check Cache API first for instant offline repeat loads
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(MODEL_CACHE_NAME);
        const cached = await cache.match(url);
        if (cached) {
          onProgress?.({ phase: 'cache', pct: 100, loadedMB: 0, totalMB: 0 });
          return await cached.arrayBuffer();
        }
      } catch {
        // Cache API unavailable (e.g., private mode or file://)
      }
    }

    // 2. Stream download with live percentage updates
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(t('nnErrNotFound', { status: resp.status }));
    }

    const contentLength = parseInt(resp.headers.get('content-length') || '0', 10);
    if (!resp.body || !resp.body.getReader) {
      const buf = await resp.arrayBuffer();
      onProgress?.({ phase: 'download', pct: 100, loadedMB: buf.byteLength / 1048576, totalMB: buf.byteLength / 1048576 });
      return buf;
    }

    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      const pct = contentLength > 0 ? Math.min(99, Math.round((received / contentLength) * 100)) : -1;
      onProgress?.({
        phase: 'download',
        pct,
        loadedMB: received / 1048576,
        totalMB: contentLength > 0 ? contentLength / 1048576 : 0,
      });
    }

    const merged = new Uint8Array(received);
    let offset = 0;
    for (const ch of chunks) {
      merged.set(ch, offset);
      offset += ch.byteLength;
    }

    // 3. Save to Cache API for future offline instant loads
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(MODEL_CACHE_NAME);
        await cache.put(url, new Response(merged.buffer, {
          headers: { 'Content-Type': 'application/octet-stream' },
        }));
      } catch {
        // Ignore quota errors
      }
    }

    return merged.buffer;
  }

  async _initSessionFromBuffer(arrayBuffer, displayName, onProgress) {
    onProgress?.({ phase: 'compile', pct: 100 });
    const ort = await ensureOrtLoaded();
    const preferred = await detectBestBackend();
    const providers = preferred === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];

    let session = null;
    let activeBackend = preferred;
    try {
      session = await ort.InferenceSession.create(arrayBuffer, {
        executionProviders: providers,
        graphOptimizationLevel: 'all',
      });
    } catch (err) {
      // Fallback cleanly to WASM if WebGPU compilation fails on a specific model op
      if (preferred === 'webgpu') {
        activeBackend = 'wasm';
        session = await ort.InferenceSession.create(arrayBuffer, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
      } else {
        throw err;
      }
    }

    // Inspect model input names & spatial dimensions
    const names = session.inputNames || [];
    const binName = names.find((n) => n.toLowerCase().includes('bin') || n.toLowerCase().includes('spatial')) || names[0] || 'bin_input';
    const globName = names.find((n) => n.toLowerCase().includes('glob')) || names[1] || 'global_input';
    this.inputNames = { bin: binName, global: globName };

    // Probe whether the model accepts 9x9 dynamic spatial dims or requires 19x19 padded input
    this.fixedBoardSize = null;
    try {
      const testBin = new ort.Tensor('float32', new Float32Array(22 * 9 * 9), [1, 22, 9, 9]);
      const testGlob = new ort.Tensor('float32', new Float32Array(19), [1, 19]);
      await session.run({ [binName]: testBin, [globName]: testGlob });
    } catch {
      this.fixedBoardSize = 19;
    }

    this.session = session;
    this.backend = activeBackend;
    this.modelName = displayName;
    this.status = 'ready';
    this.lastError = null;
    this._notify({ phase: 'ready', pct: 100 });
    return true;
  }

  async loadFromUrl(url, displayName = '') {
    this.status = 'loading';
    this.lastError = null;
    this._notify({ phase: 'download', pct: 0 });

    try {
      const buf = await this._fetchWithCacheAndProgress(url, (prog) => this._notify(prog));
      const label = displayName || url.split('/').pop() || 'KataGo ONNX';
      return await this._initSessionFromBuffer(buf, label, (prog) => this._notify(prog));
    } catch (err) {
      this.status = 'error';
      this.lastError = err?.message || String(err);
      this._notify();
      throw err;
    }
  }

  async loadFromFile(file) {
    this.status = 'loading';
    this.lastError = null;
    this._notify({ phase: 'compile', pct: 50 });

    try {
      const buf = await file.arrayBuffer();
      return await this._initSessionFromBuffer(buf, file.name, (prog) => this._notify(prog));
    } catch (err) {
      this.status = 'error';
      this.lastError = err?.message || String(err);
      this._notify();
      throw err;
    }
  }

  async evaluate(board, colorToPlay, { komi = 6.5, rules = 'chinese', recentMoves = [] } = {}) {
    if (!this.isReady()) return null;
    const ort = window.ort;
    const targetSize = this.fixedBoardSize || board.size;
    const { binInput, globalInput, spatialH, spatialW } = encodeKataGoV7(board, colorToPlay, {
      komi,
      rules,
      recentMoves,
      targetBoardSize: targetSize,
    });

    const feeds = {
      [this.inputNames.bin]: new ort.Tensor('float32', binInput, [1, 22, spatialH, spatialW]),
      [this.inputNames.global]: new ort.Tensor('float32', globalInput, [1, 19]),
    };

    const results = await this.session.run(feeds);
    this.evalCount++;
    return decodeKataGoOutputs(results, board.size, spatialH, spatialW, colorToPlay);
  }
}

export const neuralEngine = new NeuralEngineManager();
