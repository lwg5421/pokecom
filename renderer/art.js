'use strict';
/* ---------- 공용 도구 ---------- */
const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fin(w) { const ch = w.charCodeAt(w.length - 1); if (ch < 0xAC00 || ch > 0xD7A3) return -1; return (ch - 0xAC00) % 28; }
const iga = w => w + (fin(w) > 0 ? '이' : '가');
const wa = w => w + (fin(w) > 0 ? '과' : '와');
const eul = w => w + (fin(w) > 0 ? '을' : '를');
const eun = w => w + (fin(w) > 0 ? '은' : '는');
const ro = w => { const f = fin(w); return w + (f > 0 && f !== 8 ? '으로' : '로'); };

/* ---------- 포켓몬 데이터 ---------- */
const TYPE = { psychic: '에스퍼', normal: '노말', electric: '전기', fire: '불꽃', water: '물', grass: '풀' };
const STRONG = { fire: ['grass'], water: ['fire'], grass: ['water'], electric: ['water'], psychic: ['normal'], normal: [] };
const MOVE = { psychic: '사이코키네시스', normal: '전광석화', electric: '10만볼트', fire: '화염방사', water: '하이드로펌프', grass: '리프블레이드' };
const FORMS = {
  mew: { sp: 'mew', name: '뮤', type: 'psychic', stage: 1 },
  ditto: { sp: 'ditto', name: '메타몽', type: 'normal', stage: 1 },
  pichu: { sp: 'pika', name: '피츄', type: 'electric', stage: 0 },
  pikachu: { sp: 'pika', name: '피카츄', type: 'electric', stage: 1 },
  raichu: { sp: 'pika', name: '라이츄', type: 'electric', stage: 2 },
  eevee: { sp: 'eevee', name: '이브이', type: 'normal', stage: 1 },
  flareon: { sp: 'eevee', name: '부스터', type: 'fire', stage: 2, desc: '불꽃처럼 뜨거운 털' },
  vaporeon: { sp: 'eevee', name: '샤미드', type: 'water', stage: 2, desc: '물속에서도 자유로워요' },
  leafeon: { sp: 'eevee', name: '리피아', type: 'grass', stage: 2, desc: '잎사귀로 햇빛을 모아요' },
  jolteon: { sp: 'eevee', name: '쥬피썬더', type: 'electric', stage: 2, desc: '털끝에서 번개가 튀어요' }
};
const SPECIES = {
  mew: { name: '뮤', type: 'psychic', egg: '둥실 떠다니는 환상의 포켓몬. 기술이 절대 빗나가지 않아요' },
  ditto: { name: '메타몽', type: 'normal', egg: '「변신」으로 상대의 기술을 그대로 따라 해요' },
  pika: { name: '피카츄', type: 'electric', egg: '피카츄로 태어나 LV 12에 라이츄로 진화. 상대를 마비시켜요' },
  eevee: { name: '이브이', type: 'normal', egg: 'LV 12에 부스터 · 샤미드 · 리피아 · 쥬피썬더 중 하나로 진화' }
};
const LINES = { mew: ['mew'], ditto: ['ditto'], pika: ['pikachu', 'pikachu', 'raichu'], eevee: ['eevee'] };
const BRANCH = ['flareon', 'vaporeon', 'leafeon', 'jolteon'];
const DEX_ORDER = ['mew', 'ditto', 'pichu', 'pikachu', 'raichu', 'eevee', 'flareon', 'vaporeon', 'leafeon', 'jolteon'];
const FOODS = [
  { id: 'berry', name: '오랭열매', price: 0, hunger: 15, mood: 2, xp: 1 },
  { id: 'jelly', name: '포핀', price: 5, hunger: 28, mood: 12, xp: 2 },
  { id: 'box', name: '특제 도시락', price: 15, hunger: 60, mood: 8, xp: 8 }
];

/* ---------- 그림 ---------- */
let COIN = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="#FFD54A" stroke="#C99400" stroke-width="1.5"/><circle cx="10" cy="10" r="4.5" fill="none" stroke="#C99400" stroke-width="1.4"/></svg>';
let HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.5 3.2 5 6.6 5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.4 0 5.4 3.5 4.1 6.8C19.5 16.4 12 21 12 21z" fill="#FF6B8A"/></svg>';
let BUBBLE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="rgba(190,230,255,.6)" stroke="#fff" stroke-width="1.6"/><circle cx="9" cy="9" r="2" fill="#fff"/></svg>';
let SPARK = '<svg viewBox="0 0 24 24"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#FFE071" stroke="#E0A800" stroke-width=".8"/></svg>';
let STAR = '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" fill="#FFD84A" stroke="#D99A00" stroke-width="1.2" stroke-linejoin="round"/></svg>';
let POOP = '<svg viewBox="0 0 40 34"><ellipse cx="20" cy="28" rx="16" ry="5.5" fill="#94643A"/><ellipse cx="20" cy="20" rx="11.5" ry="5" fill="#A3713F"/><ellipse cx="20" cy="12.5" rx="6.5" ry="4.2" fill="#B07D48"/><path d="M20 8.5c0-3 2-5 4-5.5" stroke="#B07D48" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
const FICON = {
  berry: '<svg viewBox="0 0 44 40"><path d="M22 12C22 8 25 6 30 5" stroke="#3E8E41" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M22 12C10 12 7 24 13 31C17 36 27 36 31 31C37 24 34 12 22 12Z" fill="#4A8FD8"/><circle cx="16" cy="20" r="2.6" fill="#fff" opacity=".6"/></svg>',
  jelly: '<svg viewBox="0 0 44 40"><circle cx="22" cy="22" r="13" fill="#F5A3C7"/><circle cx="22" cy="22" r="13" fill="none" stroke="#D96BA0" stroke-width="2" stroke-dasharray="4 3"/><circle cx="17" cy="17" r="3" fill="#fff" opacity=".7"/></svg>',
  box: '<svg viewBox="0 0 44 40"><rect x="5" y="11" width="34" height="24" rx="5" fill="#F2B544"/><rect x="5" y="11" width="34" height="7" rx="3.5" fill="#D9892B"/><circle cx="15" cy="26" r="4.4" fill="#fff"/><circle cx="15" cy="26" r="2" fill="#F2C94C"/><rect x="23" y="23" width="12" height="6.5" rx="3.2" fill="#E35D5D"/></svg>'
};


/* ---------- 공식 디자인 도트 설계도 ----------
   48×48 격자에서 1단위 = 1픽셀. 몸통은 도형으로 그린 뒤 pixel.js가 팔레트 색으로 찍고,
   눈·입·볼은 face 좌표에 픽셀 단위로 직접 찍는다. 네발 포켓몬은 왼쪽을 바라본다. */
const GRID = 48;
const el = (cx, cy, rx, ry, f, r = 0) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${r ? ` transform="rotate(${r} ${cx} ${cy})"` : ''}/>`;
const pg = (pts, f) => `<polygon points="${pts}" fill="${f}"/>`;
const ph = (d, f) => `<path d="${d}" fill="${f}"/>`;
const ln = (d, s, w) => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rc = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
// 네발 다리: A쌍(앞 가까운 다리 + 뒤 먼 다리)과 B쌍이 번갈아 들린다
function leg(x, pair, step, col, paw) {
  const up = (step === 1 && pair === 'A') || (step === 2 && pair === 'B');
  const top = 35, bottom = up ? 42 : 44, lx = x - (up ? 1 : 0);
  return rc(lx, top, 4, bottom - top, col) + (paw ? rc(lx, bottom - 3, 4, 3, paw) : '');
}
function quadLegs(step, far, near, paw) {
  return { far: leg(15, 'B', step, far, paw) + leg(31, 'A', step, far, paw), near: leg(19, 'A', step, near, paw) + leg(34, 'B', step, near, paw) };
}
const EV_HEAD = c => el(15, 18.5, 9.5, 8.5, c) + el(8, 22, 3.8, 2.8, c);
const EV_FACE = iris => ({ eyes: [[8, 16], [15, 16]], ew: 2, eh: 3, iris, nose: [4, 21], mouth: [8, 23], mw: 3 });
const PIKA_FEET = (step, c, x1 = 18.5, x2 = 29.5) => el(x1, step === 1 ? 41 : 42.5, 4, 2.2, c) + el(x2, step === 2 ? 41 : 42.5, 4, 2.2, c);

const SPRITE = {
  pikachu: {
    color: '#F8D030', shadow: [24, 10],
    svg: s => pg('30,37 35,32 33,30 39,25 37,23 45,13 46.5,15 41.5,23 43.5,25 37.5,31 39.5,33 32.5,39.5', '#F8D030') + pg('30,37 34,33.5 36.5,35.5 32.5,39.5', '#B07028')
      + pg('13.5,16 4.5,2 8,1 19.5,12', '#F8D030') + pg('4.5,2 8,1 11.4,4.3 7.2,6.2', '#2A2A2A')
      + pg('34.5,16 43.5,2 40,1 28.5,12', '#F8D030') + pg('43.5,2 40,1 36.6,4.3 40.8,6.2', '#2A2A2A')
      + PIKA_FEET(s, '#F8D030') + el(24, 34, 10, 8.8, '#F8D030') + el(24, 19, 11.5, 9.5, '#F8D030')
      + el(16.5, 32, 2.2, 3.2, '#D8A818', -35) + el(31.5, 32, 2.2, 3.2, '#D8A818', 35),
    face: { eyes: [[18, 17], [28, 17]], ew: 2, eh: 3, nose: [23, 21], mouth: [23, 23], mw: 4, cheeks: [[13, 21], [32, 21]], cw: 3, ch: 3, cheek: '#E8402A', cheekAlways: true }
  },
  pichu: {
    color: '#F8DC58', shadow: [24, 8],
    svg: s => pg('29.5,39 34,36 32.5,34.5 37,31.5 38.5,32.5 35.5,35.5 36.5,36.5 31,40.5', '#2A2A2A')
      + ph('M15,19 L3.5,8 C2,3.5 5,1.5 9,3.5 L20,14 Z', '#2A2A2A') + ph('M15.5,18 L6,8.5 C5.5,6 7,5 9,6 L19,14.5 Z', '#F8DC58')
      + ph('M33,19 L44.5,8 C46,3.5 43,1.5 39,3.5 L28,14 Z', '#2A2A2A') + ph('M32.5,18 L42,8.5 C42.5,6 41,5 39,6 L29,14.5 Z', '#F8DC58')
      + el(20.5, s === 1 ? 42 : 43, 3.2, 1.8, '#F8DC58') + el(27.5, s === 2 ? 42 : 43, 3.2, 1.8, '#F8DC58')
      + el(24, 37.5, 7.5, 6.5, '#F8DC58') + el(24, 30.5, 6.5, 1.8, '#2A2A2A') + el(24, 21, 12, 10, '#F8DC58')
      + el(18, 35.5, 1.8, 2.6, '#E0C040', -30) + el(30, 35.5, 1.8, 2.6, '#E0C040', 30),
    face: { eyes: [[17, 19], [29, 19]], ew: 2, eh: 3, mouth: [23, 24], mw: 4, cheeks: [[13, 23], [32, 23]], cw: 3, ch: 2, cheek: '#F8A0B4', cheekAlways: true }
  },
  raichu: {
    color: '#F0A040', shadow: [24, 11],
    svg: s => ln('M31,38 C42,41 46,34 43,25', '#2A2A2A', 1.6) + pg('43,25.5 39,20 42.5,20 40,13 47,21 43.5,21 45,25.5', '#F8D030')
      + ph('M15,15 C8,10 4,4 7,0.5 C12,2 16.5,7 19.5,11 Z', '#7A4820') + ph('M14.5,13 C10,9.5 7.5,5.5 8.5,3 C11,5 14,8 16.5,11 Z', '#F8D030')
      + ph('M33,15 C40,10 44,4 41,0.5 C36,2 31.5,7 28.5,11 Z', '#7A4820') + ph('M33.5,13 C38,9.5 40.5,5.5 39.5,3 C37,5 34,8 31.5,11 Z', '#F8D030')
      + el(18, s === 1 ? 41.5 : 43, 4.5, 2, '#7A4820') + el(30, s === 2 ? 41.5 : 43, 4.5, 2, '#7A4820')
      + el(24, 33.5, 11, 9.5, '#F0A040') + el(24, 35.5, 7, 6.5, '#F8E4B0')
      + el(14.5, 31, 2.4, 3.4, '#F0A040', -30) + el(13.5, 33.8, 1.6, 1.3, '#7A4820') + el(33.5, 31, 2.4, 3.4, '#F0A040', 30) + el(34.5, 33.8, 1.6, 1.3, '#7A4820')
      + el(24, 18, 11, 9, '#F0A040'),
    face: { eyes: [[18, 16], [28, 16]], ew: 2, eh: 3, nose: [23, 20], mouth: [23, 22], mw: 4, cheeks: [[13, 20], [32, 20]], cw: 3, ch: 3, cheek: '#F8D030', cheekAlways: true }
  },
  mew: {
    color: '#F8B4CC', shadow: [24, 7], float: true,
    svg: s => `<g transform="translate(0 -3)">` + ln('M29,34 C40,39 47,31 43,22 C40,16 45,11 42,7', '#F8B4CC', 2.2) + el(41.5, 6, 2.4, 3.2, '#F8B4CC', 20)
      + pg('13,12 14.5,3.5 20,8.5', '#F8B4CC') + pg('28,8.5 33.5,3.5 35,12', '#F8B4CC')
      + el(19.5, 38.5 - (s === 1 ? 1 : 0), 2.8, 4.8, '#F8B4CC', 18) + el(28.5, 38.5 - (s === 2 ? 1 : 0), 2.8, 4.8, '#F8B4CC', -18)
      + el(24, 31, 6.5, 7, '#F8B4CC') + el(18, 29, 1.8, 3, '#E890B0', 35) + el(30, 29, 1.8, 3, '#E890B0', -35)
      + el(24, 16.5, 11.5, 9.5, '#F8B4CC') + `</g>`,
    face: { eyes: [[17, 11], [28, 11]], ew: 3, eh: 4, iris: '#3C7CD8', mouth: [23, 18], mw: 4, cheeks: [[14, 16], [32, 16]], cw: 2, ch: 1, cheek: '#F080A8' }
  },
  ditto: {
    color: '#B898E0', shadow: [24, 16],
    svg: s => `<g transform="translate(24 44) scale(${s === 1 ? '1.05 .95' : s === 2 ? '.96 1.04' : '1 1'}) translate(-24 -44)">`
      + ph('M8,41 C5,36 9,31 12,30 C11,26 15,22 19,22.5 C21,20.5 27,20.5 29.5,22.5 C34,22 38,26 37,29.5 C41,30.5 44,35 41.5,40.5 C38.5,43.5 34,41.5 30.5,42.5 C26.5,44.5 21.5,43.5 17.5,42.5 C13.5,43.5 9.5,43.5 8,41 Z', '#B898E0')
      + el(7.5, 34, 2.6, 2, '#B898E0', -20) + el(41, 33.5, 2.4, 1.9, '#B898E0', 20) + `</g>`,
    face: { eyes: [[20, 30], [27, 30]], ew: 1, eh: 1, mouth: [24, 34], mw: 'wide' }
  },
  eevee: {
    color: '#C88A4E', shadow: [27, 14],
    svg: s => {
      const L = quadLegs(s, '#A06A38', '#C88A4E');
      return ph('M33,30 C41,30 47,23 46,15 C45,8.5 40,6.5 37,9.5 C41,12.5 41,18 37,22 C35,24 33,26 32.5,28.5 Z', '#C88A4E') + el(41.5, 9, 4.5, 3, '#F2DEB0', -20)
        + pg('16,13 20,0.5 24.5,2 22.5,16', '#C88A4E') + pg('17.5,12 20.5,3 23,4 21.5,13', '#6A4020')
        + pg('6.5,16 1,1.5 4.5,0.5 14,12', '#C88A4E') + pg('7,13.5 3,3.5 5,3 12.5,12', '#6A4020')
        + L.far + el(28, 31.5, 10.5, 6.5, '#C88A4E') + L.near
        + ph('M10,24.5 C7.5,28.5 10.5,32 14,31 C14,35 18.5,35.5 20,32.5 C22,35.5 27,34 26,30.5 C29,29.5 28.5,24.5 24.5,23 L14,23.5 Z', '#F2DEB0')
        + EV_HEAD('#C88A4E');
    },
    face: EV_FACE('#4A2810')
  },
  flareon: {
    color: '#F07A38', shadow: [27, 15],
    svg: s => {
      const L = quadLegs(s, '#C85A20', '#F07A38');
      return ph('M32,30 C41,31 48,24 47,15 C46.5,8 41,5 37,8.5 C40,12 41,17 37,21.5 C34.5,24 32.5,26.5 31.5,29 Z', '#F8D878') + el(42, 10, 5, 4, '#F8D878', -20)
        + pg('16,13 20,0.5 24.5,2 22.5,16', '#F07A38') + pg('17.5,12 20.5,3 23,4 21.5,13', '#A84018')
        + pg('6.5,16 1,1.5 4.5,0.5 14,12', '#F07A38') + pg('7,13.5 3,3.5 5,3 12.5,12', '#A84018')
        + L.far + el(28, 31.5, 10.5, 6.5, '#F07A38') + L.near
        + ph('M9,23 C5.5,28 9,33 13,32 C12.5,37 18.5,37.5 20.5,33.5 C23,37 28.5,35 27,31 C30.5,29.5 30,23.5 25,22 L13,22 Z', '#F8D878')
        + EV_HEAD('#F07A38')
        + ph('M10,13 C9,9 12,8 13.5,10 C14,7 18,7 18,10.5 C20,9.5 21.5,12 19.5,13.5 Z', '#F8D878');
    },
    face: EV_FACE(null)
  },
  vaporeon: {
    color: '#6EC4EE', shadow: [28, 15],
    svg: s => {
      const L = quadLegs(s, '#4E9ED0', '#6EC4EE');
      return ph('M35,27 C41,28 43,26 44,22 C44.5,26 43,31 37,34 Z', '#6EC4EE') + pg('43,23.5 46.5,14.5 46,22 48,27.5 43.5,26', '#3470B8')
        + ph('M16.5,12.5 C17.5,7.5 20,4.5 23.5,4 C22.5,7 22,9 22.5,11 C24,9.5 26,9 28,9.5 C26,12 23,14.5 19.5,16 Z', '#EEF2E6')
        + ph('M8,15 C2,12 0.5,6 2,2.5 C4.5,6.5 7,7.5 8.5,10 C8.5,6.5 10,4.5 12.5,3.5 C13,7.5 13,11 12,13.5 Z', '#EEF2E6')
        + L.far + el(28, 31.5, 11, 6.5, '#6EC4EE') + L.near
        + ph('M21,25.5 C25,20.5 31,20.5 36,25 C31,24 26,24.5 21,26.5 Z', '#3470B8')
        + ph('M10.5,24 C8,27.5 10.5,31 13.5,30.5 C14,33.5 18,34 19.5,31.5 C21.5,33.5 25.5,32.5 25,29.5 C27.5,28.5 27,24.5 23.5,23 L14,23.5 Z', '#EEF2E6')
        + EV_HEAD('#6EC4EE') + pg('12,12.5 15,9 18,12.5 15,14', '#3470B8');
    },
    face: EV_FACE(null)
  },
  leafeon: {
    color: '#EEDCA8', shadow: [27, 14],
    svg: s => {
      const L = quadLegs(s, '#CDB683', '#EEDCA8', '#7A5634');
      return ph('M34,29 C37,22 41,14 47,9.5 C47.5,18 43.5,26 37,31 Z', '#5CAA4A') + ln('M35.5,29 C39,22 42,16 46,11', '#3B7A32', .9)
        + ph('M16.5,13 C17.5,7.5 21,2.5 26.5,1 C27,6.5 24.5,11.5 21,15.5 Z', '#5CAA4A') + ln('M18,13 C20,9 22.5,5 26,2', '#3B7A32', .9)
        + ph('M7,15.5 C1.5,11 0.5,5 3,0.5 C8.5,3 12.5,8 13.5,12 Z', '#5CAA4A') + ln('M7.5,14 C5,10 3.5,6 3.5,2', '#3B7A32', .9)
        + L.far + el(28, 31.5, 10.5, 6.5, '#EEDCA8') + L.near
        + ph('M14,26.5 C11.5,30 13,33.5 16,34 C16.5,31 16,28.5 14,26.5 Z', '#5CAA4A')
        + EV_HEAD('#EEDCA8') + ph('M12.5,13.5 C11,10 12.5,6.5 15.5,5 C16.5,8.5 15.5,11.5 12.5,13.5 Z', '#5CAA4A');
    },
    face: EV_FACE('#6A3A18')
  },
  jolteon: {
    color: '#F8D040', shadow: [27, 15],
    svg: s => {
      const L = quadLegs(s, '#D0A828', '#F8D040');
      return pg('34,27 44,21 40.5,27.5 47.5,27.5 40.5,31.5 45,36 34,33', '#F8D040')
        + pg('16,13 21,0 25,1.5 22.5,16', '#F8D040') + pg('17.5,12 21,2.5 23.5,3.5 21.5,13', '#C09020')
        + pg('6.5,16 0.5,0.5 4,0 14,12', '#F8D040') + pg('7,13.5 2.5,3 4.5,2.5 12.5,12', '#C09020')
        + L.far + el(28, 31.5, 10.5, 6.5, '#F8D040') + L.near
        + pg('20,26 22.5,20.5 25.5,25 28.5,19.5 31,25 34,20.5 36,26.5', '#F8D040')
        + pg('10,24 7.5,29.5 11.5,28.5 11.5,33.5 15.5,30.5 17.5,35 19.5,30.5 23.5,34 24.5,29.5 28,29.5 25.5,23.5', '#F6F6F6')
        + EV_HEAD('#F8D040') + pg('20,15 25.5,13.5 22,18.5', '#F8D040');
    },
    face: EV_FACE(null)
  }
};
const EGG_SPOT = { mew: '#F8B4CC', ditto: '#B898E0', pika: '#F8D030', eevee: '#C88A4E' };
function eggShape(sp) {
  const c = EGG_SPOT[sp];
  return ph('M24,13 C31.5,13 35.5,26 35.5,33 C35.5,40 30.5,44.5 24,44.5 C17.5,44.5 12.5,40 12.5,33 C12.5,26 16.5,13 24,13 Z', '#FFF6E6')
    + el(19, 33, 3.5, 3, c) + el(29, 38, 4, 3.5, c) + el(27.5, 22, 2.6, 2.4, c) + el(22, 41.5, 1.8, 1.4, c);
}
