'use strict';
/* 도트 엔진 — art.js의 설계도를 48×48 픽셀로 찍어 낸다.
   1) 몸통 레이어를 작은 캔버스에 그려 팔레트 색으로만 칠하고
   2) 위쪽은 밝게, 아래·오른쪽은 어둡게 한 칸씩 명암을 넣고
   3) 바깥에 같은 계열의 진한 색으로 1픽셀 외곽선을 두른 뒤
   4) 눈·입·볼은 픽셀 단위로 직접 찍는다. */
const PXN = GRID;
const INK = [30, 34, 51, 255], WHITE = [255, 255, 255, 255], TONGUE = [255, 120, 140, 255];
function hexRGB(h) {
  let s = h.slice(1); if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const n = parseInt(s, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 255];
}
const mixC = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)).concat(255);
const tone = (c, t) => t < 0 ? mixC(c, [16, 12, 30], -t) : mixC(c, [255, 255, 255], t);
const lum = c => c[0] * .3 + c[1] * .59 + c[2] * .11;
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.c[y * this.w + x] : null; }
  set(x, y, col) { if (this.in(x, y)) this.c[y * this.w + x] = col; }
  clone() { const g = new Grid(this.w, this.h); g.c = this.c.slice(); return g; }
  line(x0, y0, x1, y1, col) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) { this.set(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  toURL() {
    const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
    const ctx = cv.getContext('2d'), im = ctx.createImageData(this.w, this.h);
    this.c.forEach((col, i) => { if (col) im.data.set(col, i * 4); });
    ctx.putImageData(im, 0, 0);
    return cv.toDataURL('image/png');
  }
}

function svgImage(svg) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = rej;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" '));
  });
}
async function pixelize(svg, w, h, opt = {}) {
  const im = await svgImage(svg);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const pal = [...new Set((svg.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).map(s => s.toUpperCase()))].map(hexRGB).concat(opt.extra || []);
  const g = new Grid(w, h);
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] < (opt.alpha || 96)) continue;
    let best = pal[0], bd = Infinity;
    for (const p of pal) { const e = (p[0] - d[i * 4]) ** 2 + (p[1] - d[i * 4 + 1]) ** 2 + (p[2] - d[i * 4 + 2]) ** 2; if (e < bd) { bd = e; best = p; } }
    g.c[i] = best;
  }
  return g;
}
// 명암: 위쪽 가장자리는 밝게, 아래·오른쪽 가장자리는 어둡게
function shadeGrid(g) {
  const src = g.c.slice(), at = (x, y) => (g.in(x, y) ? src[y * g.w + x] : null);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = at(x, y); if (!c) continue;
    if (!at(x, y - 1)) g.set(x, y, tone(c, .22));
    else if (!at(x, y + 1) || !at(x + 1, y)) g.set(x, y, tone(c, -.16));
  }
}
// 외곽선: 바깥 빈칸 중 몸에 닿은 칸을 이웃 색보다 진하게
function outlineGrid(g, amt = .58) {
  const src = g.c.slice(), at = (x, y) => (g.in(x, y) ? src[y * g.w + x] : null);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (at(x, y)) continue;
    let n = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const c = at(x + dx, y + dy); if (c && (!n || lum(c) < lum(n))) n = c; }
    if (n) g.set(x, y, tone(n, -amt));
  }
}
function dropShadow(g, cy, hw, C = g.w / 2) {
  for (let x = Math.round(C - hw); x < Math.round(C + hw); x++) {
    const edge = x === Math.round(C - hw) || x === Math.round(C + hw) - 1;
    for (const y of edge ? [cy] : [cy, cy + 1]) if (!g.get(x, y)) g.set(x, y, [12, 18, 40, 70]);
  }
}

/* ---------- 포켓몬 스프라이트 ---------- */
const SPR_BASE = {}, SPR_URL = {};
const svgWrap = inner => `<svg viewBox="0 0 ${GRID} ${GRID}">${inner}</svg>`;
async function buildBase(fid, step) {
  const sp = SPRITE[fid];
  const g = await pixelize(svgWrap(sp.svg(step)), PXN, PXN);
  shadeGrid(g);
  outlineGrid(g);
  dropShadow(g, sp.float ? 45 : 44, sp.shadow[1], sp.shadow[0]);
  SPR_BASE[fid + '|' + step] = g;
}
// 표정 찍기: 눈 상자(ew×eh) 왼쪽 위 좌표, 입 기준점, 볼 위치는 SPRITE[fid].face에 있다
function stampFace(g, f, face) {
  const set = (x, y, c) => g.set(x, y, c);
  const ink = INK, w = f.ew, h = f.eh, mid = Math.floor(h / 2);
  const blush = f.cheek && (f.cheekAlways || face === 'happy' || face === 'sleep');
  if (blush) for (const [cx, cy] of f.cheeks) for (let i = 0; i < f.cw; i++) for (let j = 0; j < f.ch; j++) set(cx + i, cy + j, hexRGB(f.cheek));
  f.eyes.forEach(([x, y], idx) => {
    const left = idx === 0, m = y + mid;
    const openEye = () => {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(x + i, y + j, f.iris && j > 0 ? hexRGB(f.iris) : ink);
      if (w > 1) set(x, y + (f.iris ? 1 : 0), WHITE);
    };
    switch (face) {
      case 'happy':
        set(x - 1, m, ink); for (let i = 0; i < w; i++) set(x + i, m - 1, ink); set(x + w, m, ink); break;
      case 'sleep':
        set(x - 1, m - 1, ink); for (let i = 0; i < w; i++) set(x + i, m, ink); set(x + w, m - 1, ink); break;
      case 'hurt': {
        const cx = x + Math.floor((w - 1) / 2);
        for (const [dx, dy] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) set(cx + dx, m + dy, ink);
        break;
      }
      case 'sad':
        openEye();
        if (left) { set(x - 1, y - 1, ink); set(x, y - 2, ink); } else { set(x + w, y - 1, ink); set(x + w - 1, y - 2, ink); }
        break;
      default: openEye();
    }
  });
  if (f.nose && face !== 'hurt') set(f.nose[0], f.nose[1], [64, 36, 30, 255]);
  const [mx, my] = f.mouth;
  const M = {
    4: { normal: [[-1, 0], [0, 1], [1, 1], [2, 0]], happy: [[-1, 0], [0, 0], [1, 0], [2, 0]], tongue: [[0, 1], [1, 1]], sad: [[-1, 1], [0, 0], [1, 0], [2, 1]], wow: [[0, 0], [1, 0], [0, 1], [1, 1]], sleep: [[0, 0], [1, 0]], hurt: [[-1, 1], [0, 0], [1, 1], [2, 0]] },
    3: { normal: [[-1, 0], [0, 1], [1, 0]], happy: [[-1, 0], [0, 0], [1, 0]], tongue: [[0, 1]], sad: [[-1, 1], [0, 0], [1, 1]], wow: [[0, 0], [0, 1]], sleep: [[0, 0]], hurt: [[-1, 1], [0, 0], [1, 1]] },
    wide: { normal: [[-4, 0], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 0]], happy: [[-4, 0], [-3, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 1], [3, 0]], tongue: [], sad: [[-3, 1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 1]], wow: [[-1, 0], [0, 0], [-1, 1], [0, 1]], sleep: [[-2, 0], [-1, 0], [0, 0], [1, 0]], hurt: [[-3, 1], [-2, 0], [-1, 1], [0, 0], [1, 1], [2, 0]] }
  }[f.mw];
  const key = face === 'normal' || !M[face] ? 'normal' : face;
  for (const [dx, dy] of M[key]) set(mx + dx, my + dy, ink);
  if (key === 'happy') for (const [dx, dy] of M.tongue) set(mx + dx, my + dy, TONGUE);
}
function spriteURL(fid, face = 'normal', step = 0) {
  const key = fid + '|' + face + '|' + step;
  if (SPR_URL[key]) return SPR_URL[key];
  const base = SPR_BASE[fid + '|' + step] || SPR_BASE[fid + '|0'];
  if (!base) return '';
  const g = base.clone();
  stampFace(g, SPRITE[fid].face, face);
  return (SPR_URL[key] = g.toURL());
}
function spriteHTML(fid, face, step) { return `<img class="mon pix" src="${spriteURL(fid, face, step)}" alt="" draggable="false">`; }

/* ---------- 알 ---------- */
const EGG_BASE = {};
async function buildEgg(sp) {
  const g = await pixelize(svgWrap(eggShape(sp)), PXN, PXN);
  shadeGrid(g);
  for (const [x, y] of [[17, 20], [17, 21], [18, 19], [17, 22]]) if (g.get(x, y)) g.set(x, y, WHITE);
  outlineGrid(g);
  dropShadow(g, 45, 9, 24);
  EGG_BASE[sp] = g;
}
function eggURL(sp, pr) {
  const stage = pr >= .67 ? 2 : pr >= .34 ? 1 : 0, key = 'egg|' + sp + '|' + stage;
  if (SPR_URL[key]) return SPR_URL[key];
  const g = EGG_BASE[sp].clone(), crack = [96, 72, 52, 255];
  const path = pts => { for (let i = 1; i < pts.length; i++) g.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], crack); };
  if (stage >= 1) path([[16, 27], [19, 30], [17, 33], [21, 35]]);
  if (stage >= 2) path([[32, 24], [29, 27], [32, 30], [29, 33]]);
  return (SPR_URL[key] = g.toURL());
}
function eggHTML(sp, pr) { return `<img class="mon pix" src="${eggURL(sp, pr)}" alt="" draggable="false">`; }

/* ---------- 아이콘 ---------- */
async function pixIcon(svg, w, h, outline = true) {
  const g = await pixelize(svg, w, h);
  if (outline) outlineGrid(g, .5);
  return `<img class="pix" src="${g.toURL()}" alt="" draggable="false">`;
}
// 원작 도트용 머리 위 기분 아이콘
async function buildEmotes() {
  const note = '<svg viewBox="0 0 12 14"><rect x="7" y="1" width="2" height="9" fill="#3A3A5A"/><rect x="7" y="1" width="4.5" height="2.2" fill="#3A3A5A"/><ellipse cx="5.5" cy="10.5" rx="3.2" ry="2.4" fill="#3A3A5A"/></svg>';
  const sweat = '<svg viewBox="0 0 10 14"><path d="M5 1 C7 5 9 8 9 10 A4 4 0 0 1 1 10 C1 8 3 5 5 1Z" fill="#6CB8F0"/></svg>';
  const bang = '<svg viewBox="0 0 6 14"><rect x="1.5" y="1" width="3" height="8" fill="#E84040"/><rect x="1.5" y="10.5" width="3" height="2.5" fill="#E84040"/></svg>';
  const q = '<svg viewBox="0 0 10 14"><path d="M2 4.5C2 2.3 3.6 1 5.2 1 7.2 1 8.5 2.3 8.5 4 8.5 5.6 7.4 6.3 6.4 7 5.6 7.5 5.4 8 5.4 9.2H3.8C3.8 7.6 4.3 6.8 5.4 6 6.3 5.4 6.8 5 6.8 4.1 6.8 3.2 6.1 2.6 5.2 2.6 4.2 2.6 3.6 3.3 3.6 4.5Z" fill="#3A6AD8"/><rect x="3.8" y="10.4" width="1.8" height="2" fill="#3A6AD8"/></svg>';
  const dots = '<svg viewBox="0 0 16 8"><rect x="1" y="3" width="3" height="3" fill="#3A3A5A"/><rect x="6.5" y="3" width="3" height="3" fill="#3A3A5A"/><rect x="12" y="3" width="3" height="3" fill="#3A3A5A"/></svg>';
  const z = '<svg viewBox="0 0 10 10"><path d="M1 1H9V3L4 7H9V9H1V7L6 3H1Z" fill="#5B6FC4"/></svg>';
  // HEART는 buildPixelArt에서 이미 도트 그림(<img>)으로 바뀌어 있으면 그대로 쓴다. 하나가 실패해도 나머지는 쓴다
  const jobs = [pixIcon(note, 12, 14), pixIcon(sweat, 10, 14), pixIcon(bang, 6, 14), HEART.startsWith('<img') ? HEART : pixIcon(HEART, 11, 11), pixIcon(q, 10, 14), pixIcon(dots, 16, 8), pixIcon(z, 10, 10)];
  const [n, s, b, h, qq, dd, zz] = (await Promise.allSettled(jobs)).map(r => r.status === 'fulfilled' ? r.value : '');
  const out = { happy: n, sad: s, hurt: s, wow: b, held: b, love: h, q: qq, think: dd, zz };
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}
async function buildPixelArt() {
  const jobs = [];
  for (const fid of Object.keys(SPRITE)) for (const step of [0, 1, 2]) jobs.push(buildBase(fid, step));
  for (const sp of Object.keys(LINES)) jobs.push(buildEgg(sp));
  await Promise.all(jobs);
  BUBBLE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#CDEBFF"/><circle cx="9" cy="9" r="2.6" fill="#FFFFFF"/></svg>';
  [COIN, HEART, BUBBLE, SPARK, STAR, POOP] = await Promise.all([
    pixIcon(COIN.replace('<svg ', '<svg '), 10, 10), pixIcon(HEART, 11, 11), pixIcon(BUBBLE, 9, 9),
    pixIcon(SPARK, 9, 9), pixIcon(STAR, 13, 13), pixIcon(POOP, 15, 13)
  ]);
  for (const k of Object.keys(FICON)) FICON[k] = await pixIcon(FICON[k], 22, 20);
}
