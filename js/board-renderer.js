// ============================================================================
// High-DPI Kaya Wood Goban Renderer (Canvas 2D)
// Supports 9x9, 13x13, 19x19, Cropped Viewports, Stones & Coaching Overlays
// ============================================================================

import { EMPTY, BLACK, WHITE, getHoshiPoints } from './engine.js';

const COL_LETTERS = 'ABCDEFGHJKLMNOPQRST';

export class GobanRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.cssSize = 600;
    this._woodCache = null;
    this._woodCacheSize = 0;

    // Layout metrics computed on render
    this._metrics = {
      size: 9,
      x0: 0,
      y0: 0,
      x1: 8,
      y1: 8,
      cols: 9,
      rows: 9,
      margin: 34,
      cell: 60,
      offsetX: 34,
      offsetY: 34,
    };
  }

  resize(cssWidth) {
    const clamped = Math.max(280, Math.floor(cssWidth));
    if (this.cssSize === clamped && this.canvas.width === Math.floor(clamped * this.dpr)) {
      return;
    }
    this.dpr = window.devicePixelRatio || 1;
    this.cssSize = clamped;
    this.canvas.width = Math.floor(clamped * this.dpr);
    this.canvas.height = Math.floor(clamped * this.dpr);
    this.canvas.style.width = `${clamped}px`;
    this.canvas.style.height = `${clamped}px`;
    this._woodCache = null;
  }

  _buildWoodTexture(pxSize) {
    const off = document.createElement('canvas');
    off.width = pxSize;
    off.height = pxSize;
    const g = off.getContext('2d');

    // Warm authentic Japanese Kaya wood gradient
    const bg = g.createLinearGradient(0, 0, pxSize, pxSize);
    bg.addColorStop(0, '#e3be78');
    bg.addColorStop(0.45, '#d8ae63');
    bg.addColorStop(1, '#c7974c');
    g.fillStyle = bg;
    g.fillRect(0, 0, pxSize, pxSize);

    // Subtle organic wood grain lines
    g.save();
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const stripeCount = Math.floor(pxSize / 5);
    for (let i = 0; i < stripeCount; i++) {
      const yBase = (i / stripeCount) * pxSize;
      const alpha = 0.025 + rand() * 0.04;
      g.strokeStyle = rand() > 0.45
        ? `rgba(115, 72, 22, ${alpha})`
        : `rgba(255, 232, 185, ${alpha * 0.85})`;
      g.lineWidth = 0.8 + rand() * 2.2;
      g.beginPath();
      const waveAmp = 1.5 + rand() * 5;
      const waveFreq = 0.003 + rand() * 0.006;
      const phase = rand() * Math.PI * 2;
      for (let x = 0; x <= pxSize; x += 20) {
        const y = yBase + Math.sin(x * waveFreq + phase) * waveAmp;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }

    // Gentle warm vignette around board rim
    const vig = g.createRadialGradient(
      pxSize * 0.5, pxSize * 0.48, pxSize * 0.25,
      pxSize * 0.5, pxSize * 0.5, pxSize * 0.72
    );
    vig.addColorStop(0, 'rgba(255, 244, 214, 0.06)');
    vig.addColorStop(1, 'rgba(66, 39, 10, 0.16)');
    g.fillStyle = vig;
    g.fillRect(0, 0, pxSize, pxSize);
    g.restore();

    this._woodCache = off;
    this._woodCacheSize = pxSize;
  }

  pixelToBoard(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const m = this._metrics;
    const gx = Math.round((px - m.offsetX) / m.cell) + m.x0;
    const gy = Math.round((py - m.offsetY) / m.cell) + m.y0;
    if (gx < m.x0 || gx > m.x1 || gy < m.y0 || gy > m.y1) return null;
    if (gx < 0 || gy < 0 || gx >= m.size || gy >= m.size) return null;

    // Ensure pointer is reasonably close to intersection
    const ix = m.offsetX + (gx - m.x0) * m.cell;
    const iy = m.offsetY + (gy - m.y0) * m.cell;
    const dist = Math.hypot(px - ix, py - iy);
    if (dist > m.cell * 0.54) return null;
    return { x: gx, y: gy };
  }

  render(state) {
    const {
      board,
      viewport = null,
      hover = null,
      hoverColor = BLACK,
      lastMove = null,
      showCoords = true,
      showMoveNumbers = false,
      moveNumberMap = null,
      hints = [],
      influenceMap = null,
      territoryMap = null,
      deadStones = null,
      showAtariDanger = false,
      dojoHintRegion = null,
      dojoHintExact = null,
      scoringMode = false,
    } = state;

    const size = board.size;
    const x0 = viewport ? viewport.x0 : 0;
    const y0 = viewport ? viewport.y0 : 0;
    const x1 = viewport ? viewport.x1 : size - 1;
    const y1 = viewport ? viewport.y1 : size - 1;
    const cols = x1 - x0 + 1;
    const rows = y1 - y0 + 1;
    const span = Math.max(cols, rows);

    const W = this.cssSize;
    const margin = showCoords
      ? Math.max(24, Math.min(42, W * (span <= 9 ? 0.072 : span <= 13 ? 0.062 : 0.052)))
      : Math.max(18, W * 0.045);

    const gridSpan = W - margin * 2;
    const cell = span > 1 ? gridSpan / (span - 1) : gridSpan;
    const offsetX = (W - (cols - 1) * cell) / 2;
    const offsetY = (W - (rows - 1) * cell) / 2;

    this._metrics = { size, x0, y0, x1, y1, cols, rows, margin, cell, offsetX, offsetY };

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Wood background
    const pxTarget = Math.floor(W * this.dpr);
    if (!this._woodCache || this._woodCacheSize !== pxTarget) {
      this._buildWoodTexture(pxTarget);
    }
    ctx.drawImage(this._woodCache, 0, 0, W, W);

    // Subtle inner wood bevel
    ctx.strokeStyle = 'rgba(255, 236, 196, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, W - 2);
    ctx.strokeStyle = 'rgba(72, 42, 12, 0.38)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, W - 1);

    const toPx = (gx, gy) => ({
      px: offsetX + (gx - x0) * cell,
      py: offsetY + (gy - y0) * cell,
    });

    // 2. Grid lines
    const hasTopEdge = y0 === 0;
    const hasBottomEdge = y1 === size - 1;
    const hasLeftEdge = x0 === 0;
    const hasRightEdge = x1 === size - 1;
    const stub = cell * 0.38;

    ctx.strokeStyle = 'rgba(42, 27, 11, 0.82)';
    ctx.lineCap = 'square';

    // Vertical lines
    for (let gx = x0; gx <= x1; gx++) {
      const px = Math.round(offsetX + (gx - x0) * cell) + 0.5;
      const isOuter = gx === 0 || gx === size - 1;
      ctx.lineWidth = isOuter ? 1.55 : 1;
      const topY = offsetY - (hasTopEdge ? 0 : stub);
      const botY = offsetY + (rows - 1) * cell + (hasBottomEdge ? 0 : stub);
      ctx.beginPath();
      ctx.moveTo(px, topY);
      ctx.lineTo(px, botY);
      ctx.stroke();
    }

    // Horizontal lines
    for (let gy = y0; gy <= y1; gy++) {
      const py = Math.round(offsetY + (gy - y0) * cell) + 0.5;
      const isOuter = gy === 0 || gy === size - 1;
      ctx.lineWidth = isOuter ? 1.55 : 1;
      const leftX = offsetX - (hasLeftEdge ? 0 : stub);
      const rightX = offsetX + (cols - 1) * cell + (hasRightEdge ? 0 : stub);
      ctx.beginPath();
      ctx.moveTo(leftX, py);
      ctx.lineTo(rightX, py);
      ctx.stroke();
    }

    // 3. Star Points (Hoshi)
    const hoshi = getHoshiPoints(size);
    const hoshiR = Math.max(2.6, Math.min(4.8, cell * 0.088));
    ctx.fillStyle = 'rgba(34, 21, 8, 0.88)';
    for (const [hx, hy] of hoshi) {
      if (hx < x0 || hx > x1 || hy < y0 || hy > y1) continue;
      const { px, py } = toPx(hx, hy);
      ctx.beginPath();
      ctx.arc(px, py, hoshiR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Coordinates
    if (showCoords) {
      const fontSize = Math.max(9, Math.min(13, cell * 0.25));
      ctx.font = `600 ${fontSize}px "PingFang TC", "Noto Sans TC", "Heiti TC", "Microsoft JhengHei", -apple-system, sans-serif`;
      ctx.fillStyle = 'rgba(56, 36, 15, 0.72)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const coordOffset = Math.max(13, margin * 0.52);
      for (let gx = x0; gx <= x1; gx++) {
        const px = offsetX + (gx - x0) * cell;
        const label = COL_LETTERS[gx];
        if (hasTopEdge) ctx.fillText(label, px, offsetY - coordOffset);
        if (hasBottomEdge) ctx.fillText(label, px, offsetY + (rows - 1) * cell + coordOffset);
        if (!hasTopEdge && !hasBottomEdge) ctx.fillText(label, px, offsetY - coordOffset);
      }
      for (let gy = y0; gy <= y1; gy++) {
        const py = offsetY + (gy - y0) * cell;
        const label = String(size - gy);
        if (hasLeftEdge) ctx.fillText(label, offsetX - coordOffset, py);
        if (hasRightEdge) ctx.fillText(label, offsetX + (cols - 1) * cell + coordOffset, py);
        if (!hasLeftEdge && !hasRightEdge) ctx.fillText(label, offsetX - coordOffset, py);
      }
    }

    // 5. Territory / Influence Overlay (under stones or on empty intersections)
    if (influenceMap || territoryMap) {
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          const idx = gy * size + gx;
          const { px, py } = toPx(gx, gy);
          const isEmptyOrDead = board.grid[idx] === EMPTY || (deadStones && deadStones.has(idx));
          if (!isEmptyOrDead) continue;

          if (territoryMap) {
            const owner = territoryMap[idx];
            if (owner !== 0) {
              const sq = cell * 0.3;
              ctx.fillStyle = owner > 0 ? 'rgba(22, 24, 28, 0.78)' : 'rgba(250, 248, 242, 0.88)';
              ctx.strokeStyle = owner > 0 ? 'rgba(255,255,255,0.28)' : 'rgba(30,25,18,0.45)';
              ctx.lineWidth = 1;
              ctx.fillRect(px - sq / 2, py - sq / 2, sq, sq);
              ctx.strokeRect(px - sq / 2, py - sq / 2, sq, sq);
            }
          } else if (influenceMap) {
            const val = influenceMap[idx];
            const strength = Math.abs(val);
            if (strength > 0.25) {
              const sq = cell * (0.18 + Math.min(0.24, (strength - 0.25) * 0.34));
              const alpha = Math.min(0.75, (strength - 0.2) * 0.9);
              ctx.fillStyle = val > 0
                ? `rgba(20, 22, 26, ${alpha})`
                : `rgba(252, 249, 242, ${alpha})`;
              ctx.fillRect(px - sq / 2, py - sq / 2, sq, sq);
            }
          }
        }
      }
    }

    // 6. Dojo Region Hint Glow (under stones)
    if (dojoHintRegion) {
      const { x, y, radius = 1 } = dojoHintRegion;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
        const { px, py } = toPx(x, y);
        const r = cell * (radius + 0.35);
        const grad = ctx.createRadialGradient(px, py, r * 0.1, px, py, r);
        grad.addColorStop(0, 'rgba(245, 190, 72, 0.32)');
        grad.addColorStop(0.7, 'rgba(245, 190, 72, 0.14)');
        grad.addColorStop(1, 'rgba(245, 190, 72, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(214, 134, 24, 0.72)';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 7. Ko Forbidden Point Indicator
    if (board.koPoint >= 0 && !scoringMode) {
      const kx = board.koPoint % size;
      const ky = Math.floor(board.koPoint / size);
      if (kx >= x0 && kx <= x1 && ky >= y0 && ky <= y1) {
        const { px, py } = toPx(kx, ky);
        const s = cell * 0.28;
        ctx.strokeStyle = 'rgba(180, 48, 36, 0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px - s / 2, py - s / 2, s, s);
      }
    }

    // 8. Atari Danger Detection (if enabled)
    let atariStones = null;
    if (showAtariDanger && !scoringMode) {
      atariStones = new Set();
      const groups = board.getAllGroups();
      for (const grp of groups) {
        if (grp.liberties.size === 1) {
          for (const s of grp.stones) atariStones.add(s);
        }
      }
    }

    // 9. Draw Stones
    const stoneR = cell * 0.468;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const idx = gy * size + gx;
        const c = board.grid[idx];
        if (c === EMPTY) continue;
        const { px, py } = toPx(gx, gy);
        const isDead = deadStones && deadStones.has(idx);

        ctx.save();
        if (isDead) ctx.globalAlpha = 0.42;
        this._drawStone(ctx, px, py, stoneR, c);
        ctx.restore();

        // Dead stone X mark in scoring mode
        if (isDead) {
          const xr = stoneR * 0.36;
          ctx.strokeStyle = c === BLACK ? 'rgba(255, 110, 100, 0.92)' : 'rgba(200, 45, 35, 0.92)';
          ctx.lineWidth = Math.max(1.8, cell * 0.055);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(px - xr, py - xr);
          ctx.lineTo(px + xr, py + xr);
          ctx.moveTo(px + xr, py - xr);
          ctx.lineTo(px - xr, py + xr);
          ctx.stroke();
        }

        // Atari warning ring
        if (atariStones && atariStones.has(idx)) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.88)';
          ctx.lineWidth = Math.max(1.8, cell * 0.055);
          ctx.beginPath();
          ctx.arc(px, py, stoneR * 0.86, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Move numbers
        if (showMoveNumbers && moveNumberMap && moveNumberMap.has(idx)) {
          const num = moveNumberMap.get(idx);
          const isLast = lastMove && lastMove.x === gx && lastMove.y === gy;
          ctx.fillStyle = isLast
            ? (c === BLACK ? '#f5c26b' : '#b83b28')
            : (c === BLACK ? 'rgba(244, 240, 232, 0.88)' : 'rgba(26, 22, 18, 0.85)');
          const numSize = num >= 100 ? cell * 0.31 : cell * 0.36;
          ctx.font = `700 ${numSize}px "PingFang TC", "Noto Sans TC", "Heiti TC", "Microsoft JhengHei", -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(num), px, py + 0.5);
        }
      }
    }

    // 10. Last Move Marker (when move numbers are off)
    if (lastMove && !lastMove.pass && lastMove.x >= x0 && lastMove.x <= x1 && lastMove.y >= y0 && lastMove.y <= y1) {
      const idx = lastMove.y * size + lastMove.x;
      const c = board.grid[idx];
      if (c !== EMPTY && !showMoveNumbers) {
        const { px, py } = toPx(lastMove.x, lastMove.y);
        ctx.strokeStyle = c === BLACK ? 'rgba(246, 211, 134, 0.95)' : 'rgba(42, 34, 26, 0.85)';
        ctx.lineWidth = Math.max(2, cell * 0.058);
        ctx.beginPath();
        ctx.arc(px, py, stoneR * 0.36, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 11. Coach Candidate Move Hints (A, B, C)
    if (hints && hints.length > 0 && !scoringMode) {
      const colors = [
        { fill: 'rgba(16, 185, 129, 0.88)', ring: '#059669', text: '#ffffff' },
        { fill: 'rgba(56, 189, 248, 0.85)', ring: '#0284c7', text: '#ffffff' },
        { fill: 'rgba(245, 158, 11, 0.82)', ring: '#d97706', text: '#1c1917' },
      ];
      const labels = ['A', 'B', 'C'];
      hints.slice(0, 3).forEach((h, i) => {
        if (h.x < x0 || h.x > x1 || h.y < y0 || h.y > y1) return;
        if (board.grid[h.y * size + h.x] !== EMPTY) return;
        const { px, py } = toPx(h.x, h.y);
        const pal = colors[i] || colors[2];
        const r = stoneR * 0.78;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.28)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = pal.fill;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = pal.ring;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = pal.text;
        ctx.font = `700 ${Math.max(10, cell * 0.34)}px "PingFang TC", "Noto Sans TC", "Heiti TC", "Microsoft JhengHei", -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[i], px, py + 0.5);
      });
    }

    // 12. Dojo Exact Answer Target Marker (Hint Level 3)
    if (dojoHintExact) {
      const { x, y } = dojoHintExact;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && board.grid[y * size + x] === EMPTY) {
        const { px, py } = toPx(x, y);
        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, stoneR * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.arc(px, py, stoneR * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 13. Ghost Hover Preview Stone
    if (hover && !scoringMode) {
      const { x, y } = hover;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
        const idx = y * size + x;
        if (board.grid[idx] === EMPTY && idx !== board.koPoint) {
          const { px, py } = toPx(x, y);
          ctx.save();
          ctx.globalAlpha = 0.44;
          this._drawStone(ctx, px, py, stoneR, hoverColor, false);
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  _drawStone(ctx, px, py, r, color, withShadow = true) {
    if (withShadow) {
      ctx.save();
      ctx.fillStyle = 'rgba(28, 17, 5, 0.34)';
      ctx.beginPath();
      ctx.arc(px + r * 0.11, py + r * 0.14, r * 0.99, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (color === BLACK) {
      // Matte Japanese Nachiguro Slate Stone
      const grad = ctx.createRadialGradient(
        px - r * 0.3, py - r * 0.3, r * 0.06,
        px, py, r
      );
      grad.addColorStop(0, '#4f545e');
      grad.addColorStop(0.28, '#24272d');
      grad.addColorStop(0.78, '#111317');
      grad.addColorStop(1, '#08090b');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      // Subtle rim light
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else {
      // Warm Hamaguri Clamshell White Stone
      const grad = ctx.createRadialGradient(
        px - r * 0.28, py - r * 0.3, r * 0.05,
        px, py, r
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#f6f3eb');
      grad.addColorStop(0.84, '#ded7c7');
      grad.addColorStop(1, '#bfb5a1');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(92, 74, 48, 0.22)';
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }
  }
}
