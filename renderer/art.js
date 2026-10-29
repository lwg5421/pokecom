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


/* ---------- 알 도트 설계도 (48×48 격자, 1단위 = 1픽셀) ---------- */
const GRID = 48;
const el = (cx, cy, rx, ry, f) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"/>`;
const ph = (d, f) => `<path d="${d}" fill="${f}"/>`;
const EGG_SPOT = { mew: '#F8B4CC', ditto: '#B898E0', pika: '#F8D030', eevee: '#C88A4E' };
function eggShape(sp) {
  const c = EGG_SPOT[sp];
  return ph('M24,13 C31.5,13 35.5,26 35.5,33 C35.5,40 30.5,44.5 24,44.5 C17.5,44.5 12.5,40 12.5,33 C12.5,26 16.5,13 24,13 Z', '#FFF6E6')
    + el(19, 33, 3.5, 3, c) + el(29, 38, 4, 3.5, c) + el(27.5, 22, 2.6, 2.4, c) + el(22, 41.5, 1.8, 1.4, c);
}
