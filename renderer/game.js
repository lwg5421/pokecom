'use strict';
/* 몬스터 둥지 — 바탕화면 위를 돌아다니는 포켓몬 키우기.
   Electron에서는 window.petApi(preload.js)로 저장·메뉴·클릭 통과를 처리하고,
   브라우저에서 index.html을 바로 열면 localStorage로 저장하는 체험 모드로 동작한다. */
const api = window.petApi || mockApi();
function mockApi() {
  const KEY = 'monster-nest-desktop';
  return {
    mock: true,
    async load() { let save = null; try { save = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} return { save }; },
    save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} },
    saveSync(d) { this.save(d); },
    async sprite(key) {
      const m = /^(front|back)\/(\d{1,4})$/.exec(key); if (!m) return null;
      const url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${m[1] === 'back' ? 'back/' : ''}${m[2]}.gif`;
      try {
        const r = await fetch(url); if (!r.ok) return null;
        const b = await r.blob();
        return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
      } catch (e) { return null; }
    },
    async aiStatus() { return { hasKey: false, mock: true }; },
    async aiSetKey() { return { ok: false, error: 'mock' }; },
    async aiClearKey() { return { ok: true }; },
    async aiChat() { return { error: 'mock' }; },
    setIgnore() {}, focus() {}, state() {}, trayIcon() {},
    menu() { if (S && S.pet) openStatus(); },
    onAction() {}
  };
}

let SIZE = 192;
const VER = 1, EGG_TAPS = 12;
const W = () => window.innerWidth, H = () => window.innerHeight;
const stageFor = l => l >= 12 ? 2 : l >= 5 ? 1 : 0;
const xpNeed = l => 20 + l * 12;
const randOf = a => a[randInt(0, a.length - 1)];
const barCls = v => v >= 50 ? '' : v >= 25 ? 'warn' : 'bad';
const STATS = [['hunger', '포만감'], ['mood', '기분'], ['energy', '체력'], ['clean', '청결']];
const NEED_TEXT = { hunger: '배고파요… 밥 주세요', clean: '찝찝해요. 씻겨 주세요', energy: '졸려요… 재워 주세요', mood: '심심해요. 놀아 주세요' };
const CRY = { mew: '뮤우~', ditto: '메타~?', pichu: '피츄!', pikachu: '피카피카!', raichu: '라이~!', eevee: '브이~', flareon: '부스~!', vaporeon: '샤미~', leafeon: '리피~', jolteon: '쥬피!' };
const ICON = {
  feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="14" r="7"/><path d="M12 7c0-2 1.2-3.4 3.4-4"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>',
  wash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/></svg>',
  sleep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  adventure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 9.5h7M8.5 12.5h4"/></svg>',
  dex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/></svg>'
};

let S = null;
const pos = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, mouse = { x: -1, y: -1 };
let dir = 1, mode = 'idle', modeUntil = 0, target = 0, onGround = true, fallFrom = 0, walking = false, tSec = 0;
let drag = null, ignoring = true, hover = false;
let busy = false, B = null, G = null, branching = false, pendingXP = 0, selSp = null;
let bubbleTimer = null, petKey = '', artClass = '', poopSig = '', lastPet = 0, lastTick = Date.now(), saveTimer = null;
let lastStateKey = '', trayKey = '';
let hitBox = { x: 48, y: 48, w: 96, h: 96 };
let chatBusy = false;

/* ---------- 원작 도트 (PokeAPI의 블랙·화이트 움직이는 스프라이트) ----------
   앱 안에 넣어 배포하지 않고, 처음 실행할 때 이 PC에서 내려받아 저장해 둔다.
   아직 못 받았으면(인터넷 없음) 그 포켓몬의 알 그림을 대신 보여 주고, 1분마다 다시 받아 본다. */
const DEX_ID = { mew: 151, ditto: 132, pichu: 172, pikachu: 25, raichu: 26, eevee: 133, flareon: 136, vaporeon: 134, leafeon: 470, jolteon: 135 };
const OFF = {};
function offURL(fid, side = 'front') { return (OFF[fid] && OFF[fid][side]) || ''; }
function monHTML(fid, side = 'front') {
  const u = offURL(fid, side);
  return u ? `<img class="mon pix off" src="${u}" alt="" draggable="false"${side === 'back' ? ' data-max="3"' : ''}>` : eggHTML(FORMS[fid].sp, 0);
}
let loadingOff = false;
async function loadOfficial() {
  if (!api.sprite || loadingOff) return;
  loadingOff = true;
  const order = Object.keys(DEX_ID).sort((a, b) => (S.pet && S.pet.form === b) - (S.pet && S.pet.form === a));
  for (const fid of order) for (const side of ['front', 'back']) {
    if (OFF[fid] && OFF[fid][side]) continue;
    let url = null;
    try { url = await api.sprite(`${side}/${DEX_ID[fid]}`); } catch (e) {}
    if (!url) continue;
    (OFF[fid] = OFF[fid] || {})[side] = url;
    if (side === 'front' && S.pet && S.pet.form === fid) { petKey = ''; trayKey = ''; }
  }
  loadingOff = false;
}
// 그림의 실제 몸 영역(투명하지 않은 부분)을 찾아 발이 바닥에 닿게 맞춘다
const BBOX = new Map();
function bboxOf(img) {
  if (BBOX.has(img.src)) return BBOX.get(img.src);
  const w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  let d; try { d = x.getImageData(0, 0, w, h).data; } catch (e) { return null; }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 100) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bb = x1 < 0 ? { x: 0, y: 0, w, h, nw: w, nh: h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, nw: w, nh: h };
  let still = ''; try { still = c.toDataURL('image/png'); } catch (e) {}
  bb.still = still;
  BBOX.set(img.src, bb);
  return bb;
}
function layoutPet() {
  const img = $('#petArt img'), hit = $('#petHit'), sh = $('#petShadow');
  if (!img) { hit.style.display = 'none'; return; }
  const apply = () => {
    const bb = bboxOf(img); if (!bb) return;
    // 도트가 고르게 보이도록 정수배로 키운다: 원작 GIF는 보통 2배, 크게 3배
    const sc = S.scale === 3 ? 3 : 2;
    const k = img.classList.contains('skin') ? Math.min(sc, 48 * sc / Math.max(bb.nw, bb.nh)) : sc;
    const bw = bb.w * k, bh = bb.h * k;
    const left = SIZE / 2 - (bb.x + bb.w / 2) * k, top = SIZE - (bb.y + bb.h) * k;
    Object.assign(img.style, { width: bb.nw * k + 'px', height: bb.nh * k + 'px', left: left + 'px', top: top + 'px' });
    hitBox = { x: (SIZE - bw) / 2 - 6, y: SIZE - bh - 6, w: bw + 12, h: bh + 12 };
    Object.assign(hit.style, { display: 'block', left: hitBox.x + 'px', top: hitBox.y + 'px', width: hitBox.w + 'px', height: hitBox.h + 'px' });
    const ownShadow = img.classList.contains('pix') && !img.classList.contains('off') && !img.classList.contains('skin');
    sh.hidden = ownShadow;
    Object.assign(sh.style, { width: Math.round(bw * .7) + 'px', left: Math.round((SIZE - bw * .7) / 2) + 'px', top: (isFloaty() ? SIZE + Math.round(SIZE * .16) : SIZE) - 6 + 'px' });
  };
  if (img.complete && img.naturalWidth) apply(); else img.onload = apply;
}
function applyScale() {
  SIZE = 72 * (S.scale === 3 ? 3 : 2);
  const el = $('#pet'); el.style.width = el.style.height = SIZE + 'px';
  petKey = ''; renderPet(); pos.x = clampX(pos.x); if (onGround) pos.y = restY();
}
const EMOTE = {};

/* ---------- 저장 ---------- */
const blankSave = () => ({ v: VER, coins: 30, dex: {}, egg: null, pet: null, savedAt: 0, record: { battles: 0, wins: 0 }, tipShown: false, notify: true, lastNotify: {}, posX: null, skin: null, skinId: 0, skinPix: false, scale: 2, chat: [], aiModel: 'opus' });
function normalize(d) {
  if (!d || d.v !== VER) return blankSave();
  const s = Object.assign(blankSave(), d);
  if (s.pet && !Array.isArray(s.pet.poopX)) s.pet.poopX = [];
  if (!Array.isArray(s.chat)) s.chat = [];
  delete s.official; // 예전 버전의 「원작 도트로 보기」 설정 (직접 찍은 도트는 없앴다)
  if (s.aiModel !== 'haiku') s.aiModel = 'opus';
  return s;
}
function save() {
  S.savedAt = Date.now(); S.posX = Math.round(pos.x);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api.save(S), 700);
}
function saveNow() {
  S.savedAt = Date.now(); S.posX = Math.round(pos.x);
  clearTimeout(saveTimer);
  api.save(S);
}
window.addEventListener('beforeunload', () => {
  if (!S) return;
  S.savedAt = Date.now(); S.posX = Math.round(pos.x);
  try { api.saveSync(S); } catch (e) {}
});

/* ---------- 시간에 따른 변화 (분 단위) ---------- */
function applyDecay(min, f) {
  const p = S.pet; if (!p || min <= 0) return;
  if (p.asleep) {
    p.energy = clamp(p.energy + 2.5 * min);
    p.hunger = clamp(p.hunger - .1 * min * f);
    p.mood = clamp(p.mood - .03 * min * f);
  } else {
    const ml = .15 + (p.hunger < 25 ? .2 : 0) + (p.clean < 30 ? .15 : 0);
    p.hunger = clamp(p.hunger - .22 * min * f);
    p.mood = clamp(p.mood - ml * min * f);
    p.energy = clamp(p.energy - .1 * min * f);
    p.clean = clamp(p.clean - (.1 + .25 * p.poopX.length) * min * f);
  }
}
function catchUp() {
  if (!S.pet || !S.savedAt) return 0;
  const min = Math.min(720, (Date.now() - S.savedAt) / 60000);
  applyDecay(min, .3);
  if (!S.pet.asleep) {
    const n = Math.floor(min / 120);
    for (let i = 0; i < n && S.pet.poopX.length < 3; i++) S.pet.poopX.push(rand(40, W() - 80));
  }
  return min;
}

/* ---------- 위치 ---------- */
const groundY = () => H() - SIZE - 2;
const isFloaty = () => !!(S.pet && S.pet.form === 'mew');
const restY = () => isFloaty() ? groundY() - Math.round(SIZE * .16) : groundY();
const clampX = x => Math.max(-hitBox.x, Math.min(W() - hitBox.x - hitBox.w, x));
const floatY = rest => isFloaty() ? rest + Math.sin(tSec * 1.7) * 7 : rest;
const locked = () => busy || !!B || !!G || branching;
const panelOpen = () => !$('#panel').hidden;

function setMode(m, ms) { mode = m; modeUntil = performance.now() + ms; }
function walkTo(x) { target = clampX(x); setMode('walk', 20000); }
function hop(v, vx = 0) { if (!onGround) return; onGround = false; vel.y = -v; vel.x = vx; fallFrom = groundY(); }
function speed() {
  if (mode === 'follow') return 115;
  if (mode === 'run') return 230;
  if (S.pet && petFace(S.pet) === 'sad') return 26;
  return isFloaty() ? 50 : 58;
}
// 다음에 할 행동 고르기: 걷기 · 통통 달리기 · 두리번 · 포즈 · 신나서 점프 · 꾸벅꾸벅 · 따라가기
let modeT = 0, lastHopT = 0, lookFlips = 0;
function decide() {
  const p = S.pet, f = petFace(p), r = Math.random();
  modeT = tSec;
  if (f === 'sad') { if (r < .25) walkTo(pos.x + rand(-200, 200)); else if (r < .45 && p.energy < 50) setMode('doze', 5000); else setMode('idle', rand(5000, 9000)); return; }
  if (p.energy < 45 && r < .22) { setMode('doze', rand(4500, 7000)); return; }
  const near = mouse.x >= 0 && Math.abs(mouse.x - (pos.x + SIZE / 2)) < 400;
  if (near && p.mood >= 60 && r < .12) { setMode('follow', rand(3000, 6000)); if (Math.random() < .5) say('어디 가요? 같이 가요!', 1800); return; }
  if (r < .40) { walkTo(rand(0, W() - SIZE)); return; }
  if (r < .50 && p.mood >= 55 && p.energy >= 40) { target = clampX(rand(0, W() - SIZE)); setMode('run', 8000); return; }
  if (r < .58) { lookFlips = 0; setMode('look', 3200); return; }
  if (r < .65 && p.mood >= 50) { hop(300); setMode('pose', 1800); return; }
  if (r < .71 && p.mood >= 70) { setMode('excited', 1900); return; }
  if (r < .77 && !bubbleTimer && !currentNeed()) say(CRY[p.form], 1500);
  setMode('idle', rand(2500, 7000));
}
function step(dt) {
  walking = false;
  if (!S.pet && !S.egg) return;
  if (drag && drag.moved) {
    pos.x = clampX(mouse.x - drag.ox);
    pos.y = Math.max(-SIZE * .3, Math.min(restY(), mouse.y - drag.oy));
    return;
  }
  if (drag) return;
  const rest = restY();
  if (!onGround) {
    if (isFloaty()) { vel.y = Math.min(vel.y + 500 * dt, 160); vel.x *= .98; }
    else vel.y += 2400 * dt;
    pos.y += vel.y * dt; pos.x += vel.x * dt;
    if (pos.x < 0) { pos.x = 0; vel.x = -vel.x * .5; }
    else if (pos.x > W() - SIZE) { pos.x = W() - SIZE; vel.x = -vel.x * .5; }
    if (pos.y >= rest) {
      pos.y = rest;
      if (!isFloaty() && vel.y > 700) { vel.y = -vel.y * .3; vel.x *= .6; }
      else { onGround = true; vel.x = vel.y = 0; landed(); }
    }
    return;
  }
  const p = S.pet;
  if (!p || p.asleep || locked()) { pos.y = floatY(rest); return; }
  const now = performance.now();
  if (mode === 'run') {
    const dx = target - pos.x;
    if (Math.abs(dx) < 12 || now > modeUntil) setMode('idle', rand(2000, 5000));
    else {
      dir = dx > 0 ? 1 : -1; walking = true;
      if (tSec - lastHopT > .34) { lastHopT = tSec; hop(isFloaty() ? 140 : 280, dir * speed()); }
    }
  } else if (mode === 'excited') {
    if (tSec - lastHopT > .5) { lastHopT = tSec; hop(isFloaty() ? 180 : 430); }
    if (now > modeUntil) setMode('idle', rand(2000, 4000));
  } else if (mode === 'look') {
    // 두리번두리번: 0.7초마다 반대쪽을 본다. 커서가 가까우면 커서 쪽을 본다
    if (Math.floor((tSec - modeT) / .7) > lookFlips) { lookFlips++; dir = -dir; }
    if (now > modeUntil) { if (mouse.x >= 0 && Math.abs(mouse.x - (pos.x + SIZE / 2)) < 500) dir = mouse.x > pos.x + SIZE / 2 ? 1 : -1; setMode('idle', rand(2000, 5000)); }
  } else if (mode === 'pose' || mode === 'doze') {
    if (now > modeUntil) setMode('idle', rand(2000, 5000));
  } else if (mode === 'walk' || mode === 'follow') {
    const tx = mode === 'follow' ? (mouse.x < 0 ? pos.x : clampX(mouse.x - SIZE / 2)) : target;
    const dx = tx - pos.x;
    if (Math.abs(dx) < 6) { if (mode === 'walk') setMode('idle', rand(2500, 7000)); }
    else { dir = dx > 0 ? 1 : -1; pos.x = clampX(pos.x + dir * Math.min(Math.abs(dx), speed() * dt)); walking = true; }
    if (now > modeUntil) setMode('idle', rand(2500, 6000));
  } else {
    if (mouse.x >= 0 && Math.abs(mouse.x - (pos.x + SIZE / 2)) < 260 && Math.abs(mouse.y - (pos.y + hitBox.y)) < 400) dir = mouse.x > pos.x + SIZE / 2 ? 1 : -1;
    if (now > modeUntil) decide();
  }
  pos.y = floatY(rest);
}
function landed() {
  const fell = groundY() - fallFrom;
  if (fell < H() * .45) return;
  if (S.egg) say('쿵! 알이 무사해요', 1600);
  else if (S.pet && !isFloaty()) say(randOf(['우와아~ 착지 성공!', '휴, 깜짝 놀랐어요!', '한 번 더 해 줘요!']), 1800);
  fallFrom = groundY();
}
function summon() {
  if (!S.pet && !S.egg) { openEggSelect(); return; }
  pos.x = clampX(W() / 2 - SIZE / 2); pos.y = -SIZE; vel.x = vel.y = 0; onGround = false; fallFrom = groundY();
  say(S.pet ? '짠! 여기 있어요' : '알이 여기 있어요!', 2000);
}

/* ---------- 마우스 통과 ---------- */
function setIgnore(v) { if (v === ignoring) return; ignoring = v; api.setIgnore(v); }
function hitTest() {
  if (drag) { setIgnore(false); return; }
  if (mouse.x < 0) { setIgnore(true); setHover(false); return; }
  const el = document.elementFromPoint(mouse.x, mouse.y);
  setIgnore(!(el && el.closest('.hit')));
  setHover(!!(el && el.closest('#petHit')));
}
// 커서가 포켓몬 몸 위에 있는지: 이름·상태 카드를 보여 주고 말풍선은 잠깐 숨긴다
function setHover(v) {
  if (v === hover || (v && drag)) return;
  hover = v; renderHud();
  if (!v) { renderNeeds(); if (bubbleTimer) { $('#bubble').hidden = false; place(); } }
}

/* ---------- 그리기 ---------- */
function petFace(p) {
  if (drag && drag.moved) return 'wow';
  if (p.asleep) return 'sleep';
  if (p.hunger < 25 || p.mood < 25 || p.clean < 25) return 'sad';
  if (p.mood >= 70 && p.hunger >= 45) return 'happy';
  return 'normal';
}
function skinImg() { return `<img class="mon skin${S.skinPix ? ' pix' : ''}" src="${S.skin}" alt="" draggable="false">`; }
function petArt(side = 'front') { return S.skin ? skinImg() : monHTML(S.pet.form, side); }
function renderPet() {
  const art = $('#petArt'), held = !!(drag && drag.moved);
  let key = '', cls = '';
  if (S.pet) {
    const p = S.pet, f = petFace(p);
    const off = !S.skin && offURL(p.form);
    key = S.skin ? 'skin' + S.skinId : off ? 'off' + p.form + (p.asleep ? 'z' : '') : 'wait' + p.form;
    if (key !== petKey) {
      petKey = key;
      if (S.skin) art.innerHTML = skinImg();
      else if (off) {
        const bb = BBOX.get(off);
        art.innerHTML = `<img class="mon pix off" src="${p.asleep && bb && bb.still ? bb.still : off}" alt="" draggable="false">`;
        if (p.asleep && bb && bb.still) BBOX.set(bb.still, bb);
      } else art.innerHTML = petArt();
      layoutPet();
    }
    const modeEmote = chatBusy ? 'think' : mode === 'pose' ? 'love' : mode === 'excited' ? 'happy' : mode === 'look' ? 'q' : mode === 'doze' && !p.asleep ? 'zz' : '';
    renderEmote(modeEmote || f);
    cls = held ? 'held' : p.asleep ? 'sleeping' : mode === 'doze' ? 'doze' : mode === 'pose' ? 'pose' : walking ? 'walking' : 'idle';
  } else if (S.egg) {
    const pr = S.egg.taps / EGG_TAPS;
    key = 'egg' + S.egg.sp + Math.floor(pr * 3);
    if (key !== petKey) { petKey = key; art.innerHTML = eggHTML(S.egg.sp, pr); layoutPet(); }
    renderEmote('normal');
    cls = held ? 'held' : 'egg';
  } else if (petKey) { petKey = ''; art.innerHTML = ''; layoutPet(); }
  if (cls !== artClass) { artClass = cls; art.className = cls; }
  setProp($('#pet'), 'hidden', !S.pet && !S.egg);
  setProp($('#zzz'), 'hidden', !(S.pet && S.pet.asleep));
  setTf($('#petFlip'), 'flip', `scaleX(${dir > 0 ? -1 : 1})`);
  // 통통 튀는 동작: 상태마다 정해진 박자로 도트 1칸씩 움직인다 (CSS 애니메이션보다 CPU를 덜 쓴다)
  const u = S.scale === 3 ? 3 : 2, beat = (period) => Math.floor(tSec / period) % 2;
  const off = { idle: [0, beat(.7) ? -u : 0], walking: [0, beat(.17) ? -u : 0], sleeping: [0, beat(1.2) ? u : 0],
    doze: [0, (tSec % 1.6) < 1.1 ? 2 * u : 0], pose: [0, -u], egg: [Math.floor(tSec / .3) % 10 === 1 ? -u : Math.floor(tSec / .3) % 10 === 2 ? u : 0, 0], held: [beat(.25) ? -2 * u : 2 * u, 0] }[cls] || [0, 0];
  setTf(art, 'bob', `translate(${off[0]}px,${off[1]}px)`);
}
// 값이 바뀌었을 때만 DOM에 쓴다
function setProp(el, prop, v) { if (el[prop] !== v) el[prop] = v; }
// 원작 도트에는 표정이 없어서 머리 위 말풍선 아이콘으로 기분을 보여 준다
function renderEmote(face) {
  const e = $('#emote'), html = EMOTE[face] || '';
  if (e.dataset.face !== face) { e.dataset.face = face; e.innerHTML = html; }
  setProp(e, 'hidden', !html);
  if (html) setTf(e, 'emote', `translate(${Math.round(hitBox.x + hitBox.w - 10)}px,${Math.round(hitBox.y - 18)}px)`);
}
// 위치는 정수 픽셀로 맞춘다(도트가 흐려지지 않게). 바뀌었을 때만 다시 그린다
const lastTf = {};
function setTf(el, key, t) { if (lastTf[key] !== t) { lastTf[key] = t; el.style.transform = t; } }
function place() {
  const px = Math.round(pos.x), py = Math.round(pos.y);
  setTf($('#pet'), 'pet', `translate(${px}px,${py}px)`);
  const top = Math.max(70, py + Math.round(hitBox.y) + 4);
  const b = $('#bubble');
  if (!b.hidden) setTf(b, 'bubble', `translate(${Math.round(Math.max(130, Math.min(W() - 130, px + SIZE / 2)))}px,${top}px) translate(-50%,-100%)`);
  const h = $('#hud');
  if (!h.hidden) setTf(h, 'hud', `translate(${Math.round(Math.max(115, Math.min(W() - 115, px + SIZE / 2)))}px,${Math.max(190, top)}px) translate(-50%,-100%)`);
}
function currentNeed() {
  const p = S.pet;
  if (!p || p.asleep) return '';
  if (p.hunger < 30) return NEED_TEXT.hunger;
  if (p.clean < 30 || p.poopX.length >= 2) return NEED_TEXT.clean;
  if (p.energy < 20) return NEED_TEXT.energy;
  if (p.mood < 30) return NEED_TEXT.mood;
  return '';
}
function say(t, ms = 2800) {
  const b = $('#bubble');
  b.textContent = t; b.hidden = hover;
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { bubbleTimer = null; renderNeeds(); }, ms);
  place();
}
function renderNeeds() {
  if (bubbleTimer) return;
  const b = $('#bubble');
  const t = S.egg ? `톡톡 두드려 주세요 (${S.egg.taps}/${EGG_TAPS})` : currentNeed();
  if (t && !hover && !drag) { if (b.textContent !== t) b.textContent = t; b.hidden = false; place(); }
  else b.hidden = true;
}
function renderHud() {
  const h = $('#hud');
  if (!hover || drag || (!S.pet && !S.egg) || panelOpen()) { h.hidden = true; return; }
  if (S.egg) {
    h.innerHTML = `<div class="h-top"><b>${esc(S.egg.name)}의 알</b></div><div class="sub">${SPECIES[S.egg.sp].name}의 알 · ${S.egg.taps}/${EGG_TAPS}</div><div class="hint">클릭: 두드리기 · 드래그: 옮기기</div>`;
  } else {
    const p = S.pet, need = xpNeed(p.level), F = FORMS[p.form];
    h.innerHTML = `<div class="h-top"><b>${esc(p.name)}</b><span class="lv">LV ${p.level}</span></div><div class="sub">${F.name} · ${TYPE[F.type]} 타입${p.asleep ? ' · 자는 중' : ''}</div>`
      + `<div class="mini"><span>경험치</span><div class="bar"><i class="xp" style="width:${Math.min(100, p.xp / need * 100)}%"></i></div></div>`
      + STATS.map(([k, l]) => { const v = Math.round(p[k]); return `<div class="mini"><span>${l}</span><div class="bar"><i class="${barCls(v)}" style="width:${v}%"></i></div></div>`; }).join('')
      + '<div class="hint">클릭: 쓰다듬기 · 우클릭: 메뉴<br>더블클릭: 상태창 · 드래그: 옮기기</div>';
  }
  h.hidden = false; $('#bubble').hidden = true; place();
}
function renderPoops() {
  const L = $('#poops'), arr = S.pet ? S.pet.poopX : [];
  const sig = arr.map(Math.round).join(',') + '|' + W() + 'x' + H();
  if (sig === poopSig) return;
  poopSig = sig; L.innerHTML = '';
  arr.forEach((x, i) => {
    const b = document.createElement('button');
    b.className = 'poop hit'; b.title = '응가 치우기';
    b.style.left = Math.round(clamp(x, 0, W() - 34)) + 'px';
    b.style.top = (H() - 33) + 'px';
    b.innerHTML = POOP;
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (!S.pet) return;
      S.pet.poopX.splice(i, 1); S.pet.clean = clamp(S.pet.clean + 8);
      say('치웠어요! 고마워요', 1600); renderPoops(); save();
    });
    L.appendChild(b);
  });
}
function particles(svg, n, at) {
  const L = $('#fx');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'pt'; s.innerHTML = svg;
    const cx = at ? at.x : pos.x + SIZE / 2, cy = at ? at.y : pos.y + hitBox.y + hitBox.h * .3;
    s.style.left = (cx - 12 + rand(-24, 24)) + 'px'; s.style.top = (cy + rand(-10, 10)) + 'px';
    s.style.animationDelay = (i * .12) + 's';
    L.appendChild(s); setTimeout(() => s.remove(), 1500 + i * 120);
  }
}
function fx(cls) { const el = $('#pet'); el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 700); }
function glow() { const g = $('#glow'); g.classList.remove('on'); void g.offsetWidth; g.classList.add('on'); }
function renderAll() { renderPet(); renderPoops(); renderNeeds(); renderHud(); syncState(); place(); }

/* ---------- 트레이·메뉴 상태 ---------- */
function menuState() {
  const p = S.pet, notify = S.notify !== false, scale = S.scale === 3 ? 3 : 2, aiModel = S.aiModel;
  if (p) return { phase: 'pet', name: p.name, formName: FORMS[p.form].name, level: p.level, asleep: !!p.asleep, locked: locked(), coins: S.coins, foods: FOODS.map(f => ({ id: f.id, name: f.name, price: f.price })), notify, scale, aiModel, need: currentNeed() };
  if (S.egg) return { phase: 'egg', name: S.egg.name, notify, scale, aiModel };
  return { phase: 'none', notify, scale, aiModel };
}
function syncState() {
  const st = menuState(), k = JSON.stringify(st);
  if (k !== lastStateKey) { lastStateKey = k; api.state(st); }
  const tk = S.pet ? S.pet.form + (S.skin ? S.skinId : '') : S.egg ? 'egg' + S.egg.sp : 'none';
  if (tk !== trayKey) { trayKey = tk; updateTrayIcon(); }
}
function updateTrayIcon() {
  if (api.mock) return;
  if (S.pet && S.skin) { drawTray(S.skin, 0, 0, 48, 48); return; }
  const off = S.pet && offURL(S.pet.form);
  if (off) {
    const img = new Image();
    img.onload = () => {
      const bb = bboxOf(img); if (!bb) return;
      const s = Math.max(bb.w, bb.h) + 2, c = document.createElement('canvas'); c.width = c.height = 48;
      const g2 = c.getContext('2d'); g2.imageSmoothingEnabled = false;
      g2.drawImage(img, bb.x + bb.w / 2 - s / 2, bb.y + bb.h / 2 - s / 2, s, s, 0, 0, 48, 48);
      try { api.trayIcon(c.toDataURL('image/png')); } catch (e) {}
    };
    img.src = off; return;
  }
  drawTray(eggURL(S.pet ? S.pet.sp : S.egg ? S.egg.sp : 'pika', 0), 0, 0, 48, 48);
}
function drawTray(src, x, y, w, h) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const g2 = c.getContext('2d'); g2.imageSmoothingEnabled = !!(S.skin && src === S.skin && !S.skinPix);
    if (S.skin && src === S.skin) { const s = Math.min(48 / img.width, 48 / img.height); w = img.width * s; h = img.height * s; x = (48 - w) / 2; y = (48 - h) / 2; }
    g2.drawImage(img, x, y, w, h);
    try { api.trayIcon(c.toDataURL('image/png')); } catch (e) {}
  };
  img.src = src;
}
function notify(k) {
  if (S.notify === false || api.mock || !S.pet) return;
  const last = S.lastNotify[k] || 0;
  if (Date.now() - last < 30 * 60000) return;
  S.lastNotify[k] = Date.now();
  try { new Notification('몬스터 둥지', { body: `${S.pet.name}: ${NEED_TEXT[k]}` }); } catch (e) {}
}

/* ---------- 창 ---------- */
// 창 안의 원작 도트를 칸에 맞는 정수배(1~2배, 내 포켓몬 뒷모습은 3배)로 키운다
function fitOfficial(root) {
  root.querySelectorAll('img.off').forEach(img => {
    const fit = () => {
      const box = img.parentElement, max = +(img.dataset.max || 2);
      const z = Math.max(1, Math.min(max, Math.floor((box.clientWidth || 96) / img.naturalWidth), Math.floor((box.clientHeight || 96) / img.naturalHeight)));
      img.style.width = img.naturalWidth * z + 'px'; img.style.height = img.naturalHeight * z + 'px';
    };
    if (img.complete && img.naturalWidth) fit(); else img.addEventListener('load', fit, { once: true });
  });
}
function openPanel(html) {
  const o = $('#panel');
  o.innerHTML = html; o.hidden = false; o.scrollTop = 0;
  fitOfficial(o);
  hover = false; renderHud();
  const f = o.querySelector('input, button:not(.x)');
  if (f) f.focus({ preventScroll: true });
  hitTest();
}
function hidePanel() { const o = $('#panel'); o.hidden = true; o.innerHTML = ''; hitTest(); }
function closePanel() {
  hidePanel();
  B = null;
  const n = pendingXP; pendingXP = 0;
  renderAll();
  if (n && S.pet) { gainXP(n); save(); }
}
function statRows(p) {
  const need = xpNeed(p.level);
  return `<div class="row"><span>경험치</span><div class="bar"><i class="xp" style="width:${Math.min(100, p.xp / need * 100)}%"></i></div><span class="num">${p.xp}/${need}</span></div>`
    + STATS.map(([k, l]) => { const v = Math.round(p[k]); return `<div class="row"><span>${l}</span><div class="bar"><i class="${barCls(v)}" style="width:${v}%"></i></div><span class="num">${v}</span></div>`; }).join('');
}
function openStatus() {
  const p = S.pet; if (!p) return;
  const F = FORMS[p.form], off = p.asleep ? 'disabled' : '';
  const days = Math.floor((Date.now() - (p.born || Date.now())) / 86400000) + 1;
  openPanel(`<button class="x" data-close aria-label="닫기">×</button>
  <div class="status-top"><div class="status-art">${petArt()}</div>
  <div class="status-name"><b>${esc(p.name)}</b><span>${F.name} · ${TYPE[F.type]} 타입 · LV ${p.level}</span><div class="coinline" style="margin-top:6px">${COIN}${S.coins} 코인</div></div></div>
  <div class="stats">${statRows(p)}</div>
  <div class="keys">
    <button class="key" data-do="feed" ${off}>${ICON.feed}밥 주기</button>
    <button class="key" data-do="play" ${off}>${ICON.play}놀아 주기</button>
    <button class="key" data-do="wash" ${off}>${ICON.wash}씻기기</button>
    <button class="key" data-do="sleep">${ICON.sleep}${p.asleep ? '깨우기' : '재우기'}</button>
    <button class="key" data-do="adventure" ${off}>${ICON.adventure}모험</button>
    <button class="key" data-do="dex">${ICON.dex}도감</button>
  </div>
  <button class="key wide" data-do="chat">${ICON.chat}말 걸기 (Claude)</button>
  <div class="row-btns"><button class="key ghost" data-do="skin">내 그림으로 바꾸기</button><button class="key ghost" data-do="unskin" ${S.skin ? '' : 'disabled'}>원래 모습으로</button></div>
  <label class="check"><input type="checkbox" id="skinPixel" checked> 고른 그림을 48×48 도트로 바꿔서 쓰기</label>
  <input type="file" id="skinFile" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
  <p class="hint">${days}일째 함께하는 중 · 모험 ${S.record.battles}번 중 ${S.record.wins}번 승리</p>
  <div class="controls"><kbd>클릭</kbd><span>쓰다듬기</span><kbd>더블클릭</kbd><span>이 상태창 열기</span><kbd>우클릭</kbd><span>메뉴 (밥 · 놀기 · 씻기 · 재우기 · 모험)</span><kbd>드래그</kbd><span>들어서 옮기기 · 휙 던지기</span></div>`);
}
function openTip() {
  if (!S.pet || panelOpen() || locked()) return;
  S.tipShown = true; save();
  openPanel(`<div class="sheet-head"><h2>${esc(wa(S.pet.name))} 지내는 법</h2></div>
  <p>${esc(eun(S.pet.name))} 이제 바탕화면에서 살아요. 혼자 돌아다니고, 배고프거나 심심하면 말풍선으로 알려 줘요.</p>
  <div class="controls"><kbd>클릭</kbd><span>쓰다듬기 (기분 +)</span><kbd>더블클릭</kbd><span>상태창 · 모든 기능</span><kbd>우클릭</kbd><span>빠른 메뉴</span><kbd>드래그</kbd><span>들어서 옮기기 · 던지기</span><kbd>응가</kbd><span>클릭하면 치워져요</span></div>
  <p class="hint">작업 표시줄 오른쪽 아래의 아이콘에서도 메뉴를 열 수 있어요. 숨기기, 자동 실행, 종료도 거기 있어요.</p>
  <button class="key wide" data-close>알겠어요</button>`);
}

/* ---------- Claude와 대화 ----------
   질문하면 포켓몬이 자기 말투로 대답한다. API 키와 요청은 메인 프로세스(main.js)가 처리하고,
   화면에는 대답 글자만 돌아온다. 대화 기록은 이 컴퓨터의 save.json에만 남는다. */
const AI_ERR = {
  nokey: 'Claude API 키가 아직 없어요. 아래 「API 키 설정」에서 넣어 주세요.',
  busy: '앞의 질문을 아직 생각하고 있어요.',
  refusal: '그건 대답하기 어려워요. 다른 걸 물어봐 줄래요?',
  long: '대답이 너무 길어졌어요. 조금 짧게 물어봐 줄래요?',
  empty: '음… 할 말이 떠오르지 않아요. 다시 물어봐 줄래요?',
  auth: 'API 키가 맞지 않아요. 「API 키 설정」에서 다시 확인해 주세요.',
  rate: '질문이 너무 많았어요. 1분쯤 쉬었다가 다시 물어봐 주세요.',
  credit: 'API 크레딧이 부족해요. console.anthropic.com에서 결제 상태를 확인해 주세요.',
  network: '인터넷에 연결되지 않았어요. 연결을 확인해 주세요.',
  server: 'Claude 서버가 지금 바빠요. 잠시 뒤에 다시 해 주세요.',
  mock: '체험 모드(브라우저)에서는 대화할 수 없어요. 앱으로 실행해 주세요.'
};
const MODEL_NAME = { opus: 'Claude Opus 5.5', haiku: 'Claude Haiku 5.5' };
function persona() {
  const p = S.pet, F = FORMS[p.form];
  const days = Math.floor((Date.now() - (p.born || Date.now())) / 86400000) + 1;
  const feel = [p.hunger < 30 && '배가 고파요', p.energy < 25 && '졸려요', p.mood < 30 && '심심해요', p.clean < 30 && '몸이 찝찝해요'].filter(Boolean);
  return [
    `너는 사용자의 컴퓨터 바탕화면에 사는 포켓몬 「${F.name}」이고, 트레이너가 지어 준 이름은 「${p.name}」이야.`,
    `${TYPE[F.type]} 타입, 레벨 ${p.level}, 울음소리는 「${CRY[p.form]}」. 트레이너와 함께한 지 ${days}일째야.`,
    `지금 기분: ${feel.length ? feel.join(', ') : '좋아요'}.`,
    '',
    '대답 규칙:',
    '- 한국어 해요체로, 1~3문장으로 짧게 말해. 말풍선에 들어갈 글이라 마크다운, 목록, 제목은 쓰지 마. 이모지는 많아야 1개.',
    `- ${F.name}다운 귀여운 말투를 유지하고, 가끔 울음소리를 섞어.`,
    '- 질문에는 캐릭터를 지키면서도 정확하게 답해. 모르는 건 모른다고 솔직하게 말해.',
    '- 어린이도 쓰는 프로그램이야. 무섭거나 어른용인 내용은 피하고, 숙제는 답만 알려 주지 말고 푸는 방법을 같이 생각해 줘.',
    '- 이름, 주소, 전화번호, 학교, 비밀번호 같은 개인 정보는 묻지 마. 사용자가 말하려 하면 안 알려 줘도 된다고 다정하게 말해.',
    '- 다치거나 위험하거나 괴로운 일이면 믿을 수 있는 어른에게 꼭 이야기하라고 말해 줘.',
    '- 너는 말만 할 수 있어. 인터넷 검색, 파일 열기, 알람 같은 건 할 수 없다고 말해.'
  ].join('\n');
}
function chatLogHTML() {
  const name = esc(S.pet.name);
  const rows = S.chat.map(m => m.role === 'user'
    ? `<div class="msg me">${esc(m.content)}</div>`
    : `<div class="msg pet"><b>${name}</b>${esc(m.content)}</div>`);
  if (chatBusy) rows.push(`<div class="msg pet wait"><b>${name}</b>음… 생각 중</div>`);
  return rows.join('') || `<p class="hint">${esc(eul(S.pet.name))} 불러 보세요. 궁금한 걸 물어보면 대답해 줘요.</p>`;
}
function renderChatLog() {
  const log = $('#chatLog'); if (!log) return;
  log.innerHTML = chatLogHTML(); log.scrollTop = log.scrollHeight;
  const inp = $('#chatIn'), btn = $('#chatSend');
  const off = chatBusy || !!S.pet.asleep;
  if (inp) inp.disabled = off;
  if (btn) btn.disabled = off;
  if (inp && !chatBusy) inp.focus({ preventScroll: true });
}
function openChat() {
  const p = S.pet; if (!p) return;
  api.focus();
  openPanel(`<button class="x" data-close aria-label="닫기">×</button>
  <div class="sheet-head"><h2>${esc(p.name)}에게 말 걸기</h2></div>
  <div id="chatLog" class="chat-log" aria-live="polite"></div>
  <div class="chat-form">
    <input id="chatIn" maxlength="300" placeholder="${p.asleep ? '지금은 자고 있어요' : '궁금한 걸 물어보세요'}" autocomplete="off" ${p.asleep ? 'disabled' : ''}>
    <button id="chatSend" class="key" type="button" ${p.asleep ? 'disabled' : ''}>보내기</button>
  </div>
  <div class="row-btns"><button class="key ghost" id="toKey">API 키 설정</button><button class="key ghost" id="chatClear" ${S.chat.length ? '' : 'disabled'}>대화 지우기</button></div>
  <p class="hint">${MODEL_NAME[S.aiModel]}가 대답해요 (작업 표시줄 아이콘 → 설정 → Claude 모델). 질문할 때마다 API 요금이 조금 들어요.</p>`);
  renderChatLog();
}
async function sendChat() {
  const inp = $('#chatIn'); if (!inp || chatBusy || !S.pet) return;
  const text = inp.value.trim().slice(0, 300); if (!text) return;
  if (S.pet.asleep) { say('쿨쿨… 지금은 자고 있어요', 1800); return; }
  inp.value = '';
  const conv = S.chat;
  conv.push({ role: 'user', content: text });
  chatBusy = true; renderChatLog(); say('음… 생각 중', 60000);
  let res;
  try {
    res = await api.aiChat({ model: S.aiModel, system: persona(), messages: S.chat.slice(-12).map(m => ({ role: m.role, content: m.content })) });
  } catch (e) { res = { error: 'unknown' }; }
  chatBusy = false;
  if (!S.pet || S.chat !== conv) { clearTimeout(bubbleTimer); bubbleTimer = null; renderNeeds(); return; } // 기다리는 동안 처음부터 다시 키웠으면 버린다
  if (res && typeof res.text === 'string' && res.text) {
    S.chat.push({ role: 'assistant', content: res.text });
    if (S.chat.length > 20) S.chat.splice(0, S.chat.length - 20);
    S.pet.mood = clamp(S.pet.mood + 2);
    const short = res.text.length > 90 ? res.text.slice(0, 88) + '…' : res.text;
    say(short, clamp(2500 + res.text.length * 70, 3500, 10000));
    save();
  } else {
    // 실패한 질문은 기록에서 빼고 입력 칸에 되돌려 놓는다
    if (S.chat.length && S.chat[S.chat.length - 1].role === 'user' && S.chat[S.chat.length - 1].content === text) S.chat.pop();
    const code = res && res.error;
    const msg = AI_ERR[code] || `대답을 받지 못했어요${res && res.status ? ` (오류 ${res.status})` : ''}. 잠시 뒤에 다시 해 주세요.`;
    say(code === 'nokey' ? 'Claude API 키가 필요해요!' : '앗, 대답을 못 했어요…', 2600);
    const back = $('#chatIn'); if (back && !back.value) back.value = text;
    if (code === 'nokey' && $('#chatLog')) { openKey(); return; }
    renderChatLog();
    const log = $('#chatLog');
    if (log) { const d = document.createElement('div'); d.className = 'msg err'; d.textContent = msg; log.appendChild(d); log.scrollTop = log.scrollHeight; }
  }
  if (!res || !res.error) renderChatLog();
  const cl = $('#chatClear'); if (cl) cl.disabled = !S.chat.length;
}
async function openKey(note) {
  api.focus();
  let st = {};
  try { st = (await api.aiStatus()) || {}; } catch (e) {}
  const has = st.saved ? '저장된 키가 있어요.' : st.hasKey ? '환경 변수 ANTHROPIC_API_KEY의 키를 쓰는 중이에요.' : '아직 저장된 키가 없어요.';
  openPanel(`<button class="x" data-close aria-label="닫기">×</button>
  <div class="sheet-head"><h2>Claude API 키</h2></div>
  <p>포켓몬이 대답하려면 Anthropic의 Claude API 키가 필요해요. <b>console.anthropic.com</b>에서 만들 수 있고, 질문할 때마다 요금이 조금 들어요. 어린이라면 어른과 함께 설정해 주세요.</p>
  <label class="field" for="keyIn">API 키 (sk-ant-로 시작해요)<input id="keyIn" type="password" maxlength="300" placeholder="sk-ant-..." autocomplete="off" spellcheck="false"></label>
  <p class="hint" id="keyNote">${esc(note || has)}${st.saved && st.secure === false ? ' 이 컴퓨터는 암호화 저장을 지원하지 않아서 내 계정 폴더에만 저장돼요.' : ''}</p>
  <div class="row-btns"><button class="key" id="keySave">저장</button><button class="key ghost" id="keyClear" ${st.saved ? '' : 'disabled'}>저장된 키 지우기</button></div>
  <button class="key ghost wide" id="toChat" ${S.pet ? '' : 'hidden'}>대화로 돌아가기</button>
  <p class="hint">키는 이 컴퓨터에만 암호화해서 저장되고, 화면이나 저장 파일(save.json)에는 들어가지 않아요.</p>`);
}
async function saveKey() {
  const inp = $('#keyIn'); if (!inp) return;
  const v = inp.value.trim();
  const note = t => { const n = $('#keyNote'); if (n) n.textContent = t; };
  if (!v) { note('키를 붙여 넣어 주세요.'); return; }
  let r = {};
  try { r = (await api.aiSetKey(v)) || {}; } catch (e) {}
  inp.value = '';
  if (r.ok) { if (S.pet) { openChat(); say('이제 말 걸어 주세요!', 2200); } else openKey('저장했어요!'); return; }
  note(r.error === 'format' ? '키 모양이 맞지 않아요. sk-ant-로 시작하는 키를 그대로 붙여 넣어 주세요.' : r.error === 'mock' ? AI_ERR.mock : '키를 저장하지 못했어요. 다시 해 주세요.');
}

/* ---------- 알 ---------- */
function openEggSelect() {
  selSp = null;
  api.focus();
  openPanel(`<div class="sheet-head"><h2>알 하나를 골라 주세요</h2></div>
  <p>골라 준 알이 바탕화면으로 떨어져요. 톡톡 두드리면 태어나요.</p>
  <div class="egg-pick">${Object.keys(SPECIES).map(sp => `<button class="egg-opt" data-sp="${sp}" aria-pressed="false">${eggHTML(sp, 0)}<b>${SPECIES[sp].name}</b><span class="ty">${TYPE[SPECIES[sp].type]} 타입</span><small>${SPECIES[sp].egg}</small></button>`).join('')}</div>
  <label class="field" for="nameIn">이름 (비워 두면 기본 이름)<input id="nameIn" maxlength="8" placeholder="먼저 알을 골라 주세요" autocomplete="off"></label>
  <button class="key wide" id="pickGo" disabled>이 알 품기</button>`);
}
function pickEgg(sp) {
  selSp = sp;
  document.querySelectorAll('.egg-opt').forEach(b => b.setAttribute('aria-pressed', b.dataset.sp === sp ? 'true' : 'false'));
  $('#nameIn').placeholder = SPECIES[sp].name;
  $('#pickGo').disabled = false;
}
function confirmEgg() {
  if (!selSp) return;
  const typed = ($('#nameIn').value || '').trim().slice(0, 8);
  S.egg = { sp: selSp, name: typed || SPECIES[selSp].name, custom: !!typed, taps: 0 };
  pos.x = clampX(W() * .62); pos.y = -SIZE; vel.x = vel.y = 0; onGround = false; fallFrom = groundY();
  closePanel(); save();
  say('하늘에서 알이 떨어졌어요! 톡톡 두드려 주세요', 3500);
}
function tapEgg() {
  if (!S.egg || busy) return;
  S.egg.taps++; fx('fx-wobble');
  if (S.egg.taps >= EGG_TAPS) {
    busy = true; say('알이 흔들려요…!', 1500);
    $('#pet').classList.add('evolving');
    setTimeout(() => { $('#pet').classList.remove('evolving'); busy = false; hatch(); }, 1500);
  } else { say(`톡! (${S.egg.taps}/${EGG_TAPS})`, 1100); save(); }
  renderAll();
}
function hatch() {
  const sp = S.egg.sp, form = LINES[sp][0], custom = hasNickname(S.egg), name = custom ? S.egg.name : FORMS[form].name;
  S.pet = { name, custom, sp, form, level: 1, xp: 0, hunger: 80, mood: 80, energy: 90, clean: 100, asleep: false, poopX: [], born: Date.now() };
  S.egg = null; S.dex[form] = 'own'; petKey = '';
  glow(); renderAll(); particles(SPARK, 5);
  say(`${iga(name)} 태어났어요! ${CRY[form]}`, 3500); saveNow();
  if (!S.tipShown) setTimeout(openTip, 2600);
}

/* ---------- 돌보기 ---------- */
function onPetClick() {
  if (locked()) return;
  if (S.egg) { tapEgg(); return; }
  const p = S.pet; if (!p) return;
  if (p.asleep) { say('쉿, 자고 있어요… 쿨쿨', 1500); return; }
  const now = Date.now();
  if (now - lastPet < 1200) { particles(HEART, 1); return; }
  lastPet = now;
  p.mood = clamp(p.mood + 3); hop(380); particles(HEART, 3);
  say(randOf(['헤헤, 간지러워요!', '더 쓰다듬어 주세요!', '기분 최고예요!', CRY[p.form]]), 1800);
  renderHud(); save();
}
function openFeed() {
  const p = S.pet;
  openPanel(`<button class="x" data-close aria-label="닫기">×</button>
  <div class="sheet-head"><h2>밥 주기</h2><span class="coinline">${COIN}${S.coins}</span></div>
  <p>${esc(p.name)}의 포만감은 지금 ${Math.round(p.hunger)}이에요.</p>
  <div class="foods">${FOODS.map(f => `<button class="food" data-food="${f.id}" ${S.coins < f.price ? 'disabled' : ''}><span class="ficon">${FICON[f.id]}</span><span><b>${f.name}</b><small>포만감 +${f.hunger} · 기분 +${f.mood} · 경험치 +${f.xp}</small></span><span class="price">${f.price ? COIN + f.price : '무료'}</span></button>`).join('')}</div>
  <p class="hint">코인은 모험에서 이기면 얻을 수 있어요.</p>`);
}
function feed(id) {
  const p = S.pet, f = FOODS.find(x => x.id === id);
  if (!p || !f || S.coins < f.price) return;
  if (p.hunger >= 95) { say('배불러요! 이따 먹을래요'); if (panelOpen()) closePanel(); return; }
  S.coins -= f.price;
  p.hunger = clamp(p.hunger + f.hunger); p.mood = clamp(p.mood + f.mood);
  pendingXP += f.xp;
  say(`냠냠! ${f.name} 맛있어요`, 2200);
  closePanel(); fx('fx-chomp'); save();
}
function doWash() {
  const p = S.pet;
  if (p.clean >= 98 && p.poopX.length === 0) { say('이미 반짝반짝해요!'); return; }
  p.clean = 100; p.poopX = []; p.mood = clamp(p.mood + 6);
  particles(BUBBLE, 7); fx('fx-wobble');
  say('뽀득뽀득! 개운해요'); renderAll(); save();
}
function fallAsleep(auto) {
  const p = S.pet;
  p.asleep = true; setMode('idle', 3000);
  say(auto ? '꾸벅꾸벅… 졸려서 잠들었어요' : '쿨쿨… 좋은 꿈 꿔', 2400);
  renderAll(); save();
}
function toggleSleep() {
  const p = S.pet;
  if (p.asleep) {
    p.asleep = false;
    if (p.energy < 60) p.mood = clamp(p.mood - 5);
    say(p.energy < 60 ? '으음… 아직 졸린데…' : '잘 잤다!');
    renderAll(); save(); return;
  }
  if (p.energy >= 90) { say('아직 하나도 안 졸려요!'); return; }
  fallAsleep(false);
}

/* ---------- 모험 (배틀) ---------- */
const typeMult = (a, d) => STRONG[a].includes(d) ? 1.5 : STRONG[d].includes(a) ? .7 : 1;
const effText = m => m > 1 ? ' 효과가 굉장했다!' : m < 1 ? ' 효과가 별로인 듯하다…' : '';
function specialOf(fid, foeType) {
  const F = FORMS[fid];
  if (F.sp === 'ditto') return { name: '변신', type: foeType, power: 1.3, miss: 0, copy: true };
  if (F.type === 'psychic') return { name: MOVE.psychic, type: 'psychic', power: 1.35, miss: 0 };
  if (F.type === 'normal') return { name: MOVE.normal, type: 'normal', power: 1.2, miss: 0 };
  if (F.type === 'electric') return { name: MOVE.electric, type: 'electric', power: 1.35, miss: .15, para: .25 };
  return { name: MOVE[F.type], type: F.type, power: 1.4, miss: .15 };
}
function specialHint(fid, foeType) {
  const s = specialOf(fid, foeType);
  if (s.copy) return `상대의 ${TYPE[foeType]} 기술을 따라 해요`;
  if (s.para) return `${TYPE[s.type]} · 가끔 상대를 마비시켜요`;
  if (!s.miss) return `${TYPE[s.type]} · 절대 빗나가지 않아요`;
  return `${TYPE[s.type]} · 가끔 빗나가요`;
}
function wildForm(lv) {
  const sp = randOf(['mew', 'ditto', 'pika', 'eevee']), st = stageFor(lv);
  if (sp === 'eevee') return st === 2 ? randOf(BRANCH) : 'eevee';
  if (sp === 'pika' && st === 0 && Math.random() < .5) return 'pichu'; // 피츄는 야생에서만 만나요
  const line = LINES[sp]; return line[Math.min(st, line.length - 1)];
}
function goAdventure() {
  const p = S.pet;
  if (p.energy < 15) { say('너무 지쳤어요. 좀 재워 주세요'); return; }
  if (p.hunger < 15) { say('배고파서 못 가겠어요…'); return; }
  p.energy = clamp(p.energy - 12); p.hunger = clamp(p.hunger - 6);
  const elv = Math.max(1, p.level + randInt(-1, 1)), ef = wildForm(elv);
  const sad = petFace(p) === 'sad';
  const meMax = 28 + p.level * 6, foeMax = 22 + elv * 5;
  S.record.battles++;
  if (!S.dex[ef]) S.dex[ef] = 'seen';
  const sk = specialOf(p.form, FORMS[ef].type);
  const f = { name: '야생 ' + FORMS[ef].name, form: ef, type: FORMS[ef].type, lv: elv, hp: foeMax, max: foeMax, atk: 4 + elv * 1.8, guard: false, para: false };
  openPanel(`<div class="sheet-head"><h2>모험</h2><span class="muted">${TYPE[f.type]} 타입 · LV ${f.lv}</span></div>
  <div class="arena">
    <div class="ground"></div>
    <div class="binfo foe-info"><div class="bname"><b>${esc(f.name)}</b><span>LV ${f.lv}</span></div><div class="btype">${TYPE[f.type]}</div><div class="hp"><i id="foeHp"></i></div></div>
    <div class="bmon foe" id="foeMon">${monHTML(f.form)}</div>
    <div class="bmon me${!S.skin && offURL(p.form, 'back') ? ' back' : ''}" id="meMon">${petArt('back')}</div>
    <div class="binfo me-info"><div class="bname"><b>${esc(p.name)}</b><span>LV ${p.level}</span></div><div class="hp"><i id="meHp"></i></div><div class="hpnum" id="meHpNum"></div></div>
  </div>
  <div class="blog" id="bLog" aria-live="polite"></div>
  <div class="moves" id="moves">
    <button class="move" data-move="tackle">몸통박치기<small>확실하게 맞혀요</small></button>
    <button class="move special" data-move="special">${sk.name}<small>${specialHint(p.form, f.type)}</small></button>
    <button class="move" data-move="guard">웅크리기<small>다음 피해 절반 + 회복</small></button>
    <button class="move" data-move="run">도망가기<small>80% 성공</small></button>
  </div>`);
  B = { me: { hp: meMax, max: meMax, atk: (6 + p.level * 2) * (sad ? .85 : 1), guard: false, para: false }, foe: f, lock: false, over: false };
  updBars(); bLog(`앗! ${iga(f.name)} 나타났다!${sad ? ` ${iga(p.name)} 기운이 없어 보인다…` : ''}`);
  save(); syncState();
}
function bLog(t) { const l = $('#bLog'); if (l) l.textContent = t; }
function setMoves(dis) { document.querySelectorAll('[data-move]').forEach(b => b.disabled = dis); }
function later(fn, ms) { setTimeout(() => { if (B && !B.over) fn(); }, ms); }
function unlock() { if (!B) return; B.lock = false; setMoves(false); }
function hitFx(side) { const el = $(side === 'foe' ? '#foeMon' : '#meMon'); if (!el) return; el.classList.remove('hit-fx'); void el.offsetWidth; el.classList.add('hit-fx'); }
function updBars() {
  if (!B) return;
  const set = (id, o) => { const el = $(id); if (!el) return; const r = o.hp / o.max; el.style.width = (r * 100) + '%'; el.className = r > .5 ? '' : r > .2 ? 'warn' : 'bad'; };
  set('#foeHp', B.foe); set('#meHp', B.me);
  const n = $('#meHpNum'); if (n) n.textContent = `${B.me.hp}/${B.me.max}`;
}
function act(kind) {
  if (!B || B.lock || B.over) return;
  B.lock = true; setMoves(true);
  const p = S.pet, me = B.me, foe = B.foe;
  if (kind === 'run') {
    if (Math.random() < .8) { bLog(`${iga(p.name)} 무사히 도망쳤다!`); endBattle('run'); return; }
    bLog('도망치지 못했다!'); later(foeTurn, 800); return;
  }
  if (kind === 'guard') {
    me.guard = true; const h = Math.round(me.max * .1); me.hp = Math.min(me.max, me.hp + h);
    bLog(`${iga(p.name)} 몸을 웅크렸다! 체력 +${h}`); updBars(); later(foeTurn, 900); return;
  }
  let dmg, msg, extra = '';
  if (kind === 'tackle') { dmg = me.atk * rand(.85, 1.15); msg = `${p.name}의 몸통박치기!`; }
  else {
    const sk = specialOf(p.form, foe.type);
    if (Math.random() < sk.miss) { bLog(`${p.name}의 ${sk.name}! …빗나갔다!`); later(foeTurn, 900); return; }
    const m = typeMult(sk.type, foe.type);
    dmg = me.atk * sk.power * m * rand(.9, 1.1);
    msg = (sk.copy ? `${p.name}의 변신! ${eul(MOVE[foe.type])} 똑같이 썼다!` : `${p.name}의 ${sk.name}!`) + effText(m);
    if (sk.para && Math.random() < sk.para) { foe.para = true; extra = ` ${iga(foe.name)} 마비되었다!`; }
  }
  if (foe.guard) { dmg *= .5; foe.guard = false; }
  dmg = Math.max(1, Math.round(dmg)); foe.hp = Math.max(0, foe.hp - dmg);
  bLog(`${msg} (${dmg})${foe.hp > 0 ? extra : ''}`); hitFx('foe'); updBars();
  if (foe.hp <= 0) { later(() => endBattle('win'), 750); return; }
  later(foeTurn, 1000);
}
function foeTurn() {
  const p = S.pet, me = B.me, foe = B.foe, myType = FORMS[p.form].type, r = Math.random();
  if (foe.para) { foe.para = false; bLog(`${iga(foe.name)} 몸이 저려서 움직이지 못한다!`); unlock(); return; }
  if (r < .15 && !foe.guard) { foe.guard = true; bLog(`${iga(foe.name)} 잔뜩 경계하고 있다!`); unlock(); return; }
  let dmg, msg, extra = '';
  if (r < .5) {
    const sk = specialOf(foe.form, myType), m = typeMult(sk.type, myType);
    dmg = foe.atk * sk.power * m * rand(.9, 1.1);
    msg = (sk.copy ? `${foe.name}의 변신! ${eul(MOVE[myType])} 똑같이 썼다!` : `${foe.name}의 ${sk.name}!`) + (m > 1 ? ' 아프다!' : '');
    if (sk.para && Math.random() < sk.para) { me.para = true; extra = ` ${iga(p.name)} 마비되었다!`; }
  } else { dmg = foe.atk * rand(.85, 1.15); msg = `${foe.name}의 몸통박치기!`; }
  if (me.guard) { dmg *= .5; me.guard = false; }
  dmg = Math.max(1, Math.round(dmg)); me.hp = Math.max(0, me.hp - dmg);
  bLog(`${msg} (${dmg})${me.hp > 0 ? extra : ''}`); hitFx('me'); updBars();
  if (me.hp <= 0) { later(() => endBattle('lose'), 750); return; }
  if (me.para) {
    me.para = false;
    later(() => { bLog(`${iga(p.name)} 몸이 저려서 움직이지 못한다!`); later(foeTurn, 1000); }, 1100);
    return;
  }
  unlock();
}
function endBattle(res) {
  if (!B) return;
  B.over = true;
  const p = S.pet, f = B.foe; let title, body;
  if (res === 'win') {
    const xp = 10 + f.lv * 4, coins = 5 + f.lv * 2;
    S.coins += coins; p.mood = clamp(p.mood + 8); S.record.wins++; pendingXP += xp;
    const fm = $('#foeMon'); if (fm) fm.classList.add('faint');
    title = '이겼다!'; body = `경험치 +${xp} · 코인 +${coins} · 기분 +8`;
  } else if (res === 'lose') {
    p.mood = clamp(p.mood - 12); pendingXP += 3;
    title = `${iga(p.name)} 쓰러졌어요…`; body = '푹 쉬게 해 주세요. 기분 -12 · 경험치 +3';
  } else { title = '무사히 돌아왔어요'; body = '다음엔 꼭 이겨 보자!'; }
  const mv = $('#moves');
  if (mv) mv.outerHTML = `<div class="result"><h3>${esc(title)}</h3><p>${body}</p><button class="key wide" data-close>돌아가기</button></div>`;
  const dn = document.querySelector('.result [data-close]'); if (dn) dn.focus({ preventScroll: true });
  save();
}

/* ---------- 성장 ---------- */
function gainXP(n) {
  const p = S.pet; if (!p) return;
  p.xp += n; let up = false;
  while (p.xp >= xpNeed(p.level)) { p.xp -= xpNeed(p.level); p.level++; up = true; }
  if (up && !checkEvo()) { say(`레벨 업! 이제 LV ${p.level}`, 2600); hop(420); particles(SPARK, 4); }
  syncState();
}
function checkEvo() {
  const p = S.pet; if (!p || busy || branching) return false;
  const ns = stageFor(p.level), cur = FORMS[p.form].stage;
  if (p.sp === 'eevee') { if (ns === 2 && cur < 2) { openBranch(); return true; } return false; }
  const line = LINES[p.sp], target = line[Math.min(ns, line.length - 1)];
  if (target === p.form || FORMS[target].stage <= cur) return false;
  evolve(target); return true;
}
function openBranch() {
  const p = S.pet; branching = true;
  api.focus();
  openPanel(`<div class="sheet-head"><h2>${esc(p.name)}의 진화</h2></div>
  <p>LV 12가 되었어요! ${esc(p.name)}의 몸이 빛나고 있어요. 어떤 포켓몬으로 진화할지 골라 주세요. 한 번 고르면 바꿀 수 없어요.</p>
  <div class="branch">${BRANCH.map(b => `<button data-branch="${b}">${monHTML(b)}<b>${FORMS[b].name}</b><small>${TYPE[FORMS[b].type]} 타입 · ${FORMS[b].desc}</small></button>`).join('')}</div>`);
  syncState();
}
function chooseBranch(fid) {
  if (!branching) return;
  branching = false; hidePanel(); evolve(fid);
}
// 직접 지은 이름인지: 예전 저장에는 표시가 없어서 포켓몬 이름과 같으면 기본 이름으로 본다
const hasNickname = p => p.custom != null ? !!p.custom : ![...Object.values(FORMS), ...Object.values(SPECIES)].some(f => f.name === p.name);
function evolve(fid) {
  const p = S.pet; busy = true; syncState();
  say(`어라…? ${p.name}의 상태가…!`, 1900);
  $('#pet').classList.add('evolving');
  setTimeout(() => {
    const was = p.name;
    p.form = fid; S.dex[fid] = 'own'; petKey = '';
    if (!hasNickname(p)) p.name = FORMS[fid].name; // 이름을 따로 안 지었으면 진화한 포켓몬 이름으로 바뀐다
    $('#pet').classList.remove('evolving');
    glow(); busy = false; renderAll(); particles(SPARK, 6);
    say(`축하해요! ${iga(was)} ${ro(FORMS[fid].name)} 진화했어요!`, 4000); saveNow();
  }, 1900);
}

/* ---------- 별 잡기 (바탕화면 전체) ---------- */
function startPlay() {
  const p = S.pet;
  if (p.energy < 10) { say('너무 피곤해요… 재워 주세요'); return; }
  openPanel(`<button class="x" data-close aria-label="닫기">×</button>
  <div class="sheet-head"><h2>별 잡기</h2></div>
  <p>바탕화면 여기저기에 별이 나타나요. 12초 동안 최대한 많이 눌러 주세요. 많이 잡을수록 ${esc(p.name)}의 기분이 좋아져요.</p>
  <button class="key wide" id="gStart">시작!</button>`);
}
function runGame() {
  hidePanel();
  G = { hits: 0, left: 12 };
  const s = document.createElement('button');
  s.className = 'star hit'; s.innerHTML = STAR; s.setAttribute('aria-label', '별');
  s.addEventListener('mousedown', e => { e.stopPropagation(); hitStar(); });
  $('#stars').appendChild(s); G.el = s;
  moveStar();
  G.mv = setInterval(moveStar, 1000);
  G.cd = setInterval(() => { if (!G) return; G.left--; updGameHud(); if (G.left <= 0) endGame(); }, 1000);
  updGameHud(); $('#gameHud').hidden = false;
  say('별을 잡아 주세요!', 2000); syncState();
}
function moveStar() {
  if (!G) return;
  G.el.style.left = rand(40, Math.max(60, W() - 110)) + 'px';
  G.el.style.top = rand(80, Math.max(100, H() - SIZE - 120)) + 'px';
  setTimeout(hitTest, 150);
}
function hitStar() {
  if (!G) return;
  G.hits++; updGameHud();
  const r = G.el.getBoundingClientRect();
  particles(SPARK, 2, { x: r.left + r.width / 2, y: r.top });
  hop(320); moveStar();
  clearInterval(G.mv); G.mv = setInterval(moveStar, 1000);
}
function updGameHud() { if (G) $('#gameHud').innerHTML = `<span>남은 시간 <b>${G.left}</b></span><span>잡은 별 <b>${G.hits}</b></span>`; }
function endGame() {
  clearInterval(G.mv); clearInterval(G.cd); G.el.remove();
  const hits = G.hits; G = null;
  $('#gameHud').hidden = true;
  const p = S.pet, mood = Math.min(40, hits * 3 + 5), xp = Math.ceil(hits / 2) + 2;
  p.mood = clamp(p.mood + mood); p.energy = clamp(p.energy - 8); p.hunger = clamp(p.hunger - 4); pendingXP += xp;
  openPanel(`<div class="result"><h3>별 ${hits}개를 잡았어요!</h3><p>기분 +${mood} · 경험치 +${xp} · 체력 -8</p><button class="key wide" data-close>돌아가기</button></div>`);
  save(); syncState();
}

/* ---------- 도감 · 초기화 ---------- */
function openDex() {
  let own = 0, seen = 0;
  const cards = DEX_ORDER.map(fid => {
    const v = S.dex[fid]; if (v === 'own') own++; if (v) seen++;
    return `<div class="dex-card ${v || 'unseen'}">${monHTML(fid)}<b>${v ? FORMS[fid].name : '???'}</b><span class="tag">${v ? TYPE[FORMS[fid].type] + ' · ' : ''}${v === 'own' ? '키워 봄' : v === 'seen' ? '만남' : '아직 몰라요'}</span></div>`;
  });
  openPanel(`<button class="x" data-close aria-label="닫기">×</button>
  <div class="sheet-head"><h2>포켓몬 도감</h2></div>
  <p>만난 포켓몬 ${seen}/${DEX_ORDER.length} · 키워 본 포켓몬 ${own}/${DEX_ORDER.length} · 모험 ${S.record.battles}번 중 ${S.record.wins}번 승리</p>
  <div class="dex">${cards.join('')}</div>
  <p class="hint">피카츄는 LV 12에 라이츄로 진화해요. 피츄는 모험에서 만날 수 있어요. 이브이는 LV 12에 진화할 모습을 직접 골라요. 상성: 불꽃은 풀에, 풀은 물에, 물은 불꽃에, 전기는 물에, 에스퍼는 노말에 강해요.</p>`);
}
function openReset() {
  api.focus();
  openPanel(`<button class="x" data-close aria-label="닫기">×</button>
  <div class="sheet-head"><h2>처음부터 시작할까요?</h2></div>
  <p>${S.pet ? esc(wa(S.pet.name)) + ' 함께한 기록' : '지금까지의 기록'}, 도감, 코인이 모두 사라지고 되돌릴 수 없어요.</p>
  <div class="row-btns"><button class="key ghost" data-close>계속 키우기</button><button class="key danger" id="resetYes">처음부터</button></div>`);
}
function doReset() {
  pendingXP = 0; B = null;
  S = blankSave(); petKey = ''; poopSig = '';
  hidePanel(); saveNow(); renderAll(); openEggSelect();
}

/* ---------- 내 이미지로 모습 바꾸기 ---------- */
function loadSkin(file) {
  if (!/^image\//.test(file.type)) { say('그림 파일(PNG, JPG, GIF, WEBP)만 쓸 수 있어요', 2600); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 256 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const bgRemoved = removeFlatBackground(c);
      const toPix = !$('#skinPixel') || $('#skinPixel').checked;
      if (toPix) { S.skin = imageToPixel(c); S.skinPix = true; }
      else { S.skin = c.toDataURL('image/png'); S.skinPix = Math.max(img.width, img.height) <= 128; }
      S.skinId = Date.now(); petKey = '';
      saveNow(); syncState(); openStatus();
      say((bgRemoved ? '배경을 지웠어요. ' : '') + (toPix ? '도트로 변신 완료! 어때요?' : '새 모습 어때요?'), 3200);
    };
    img.onerror = () => say('이 그림은 열 수 없어요. 다른 파일을 골라 주세요', 2600);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// 그림 가장자리가 한 가지 색(흰 배경 등)이면 가장자리에서부터 그 색을 지운다
function removeFlatBackground(cv) {
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  const px = i => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]];
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map(px);
  if (corners.some(c => c[3] < 250)) return false;
  const ref = corners[0], dist = c => Math.abs(c[0] - ref[0]) + Math.abs(c[1] - ref[1]) + Math.abs(c[2] - ref[2]);
  if (corners.some(c => dist(c) > 36)) return false;
  const seen = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop(); if (seen[i]) continue; seen[i] = 1;
    if (d[i * 4 + 3] < 10 || dist(px(i)) <= 60) {
      d[i * 4 + 3] = 0;
      const x = i % w, y = (i - x) / w;
      if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
    }
  }
  ctx.putImageData(im, 0, 0);
  return true;
}
// 고른 그림을 48×48 도트로: 투명 배경 유지, 색 단순화, 외곽선
function imageToPixel(srcCanvas) {
  const N = PXN, inner = N - 2;
  const s = Math.min(inner / srcCanvas.width, inner / srcCanvas.height);
  const w = Math.max(1, Math.round(srcCanvas.width * s)), h = Math.max(1, Math.round(srcCanvas.height * s));
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcCanvas, Math.floor((N - w) / 2), N - 1 - h, w, h);
  const d = ctx.getImageData(0, 0, N, N).data, g = new Grid(N, N);
  const q = v => Math.min(255, Math.round(v / 42.5) * 42.5);
  let opaque = 0;
  for (let i = 0; i < N * N; i++) if (d[i * 4 + 3] >= 110) { g.c[i] = [q(d[i * 4]), q(d[i * 4 + 1]), q(d[i * 4 + 2]), 255]; opaque++; }
  if (opaque > N * N * .9) { const c2 = document.createElement('canvas'); c2.width = c2.height = 128; const x2 = c2.getContext('2d'); x2.imageSmoothingEnabled = false; x2.drawImage(cv, 0, 0, 128, 128); return c2.toDataURL('image/png'); }
  shadeGrid(g); outlineGrid(g);
  return g.toURL();
}

/* ---------- 메뉴 동작 ---------- */
function doAction(id) {
  const p = S.pet; if (!p) return;
  if (id === 'sleep') { toggleSleep(); return; }
  if (p.asleep) { say('쿨쿨… 지금은 자고 있어요', 1800); return; }
  if (id.startsWith('feed:')) { feed(id.slice(5)); return; }
  if (id === 'feed') { openFeed(); return; }
  if (id === 'play') { startPlay(); return; }
  if (id === 'wash') { doWash(); return; }
  if (id === 'adventure') { goAdventure(); return; }
}
function onAction(id) {
  if (!S) return;
  if (id === 'summon') { summon(); return; }
  if (id === 'notify:on' || id === 'notify:off') { S.notify = id === 'notify:on'; save(); syncState(); return; }
  if (id === 'scale:2' || id === 'scale:3') { S.scale = +id.slice(6); applyScale(); save(); renderAll(); return; }
  if (id === 'aimodel:opus' || id === 'aimodel:haiku') { S.aiModel = id.slice(8); save(); syncState(); if ($('#chatLog')) openChat(); return; }
  if (locked()) { say('지금은 바빠요! 조금만 기다려 주세요', 1600); return; }
  if (id === 'reset') { openReset(); return; }
  if (id === 'eggSelect') { if (!S.pet && !S.egg) openEggSelect(); return; }
  if (id === 'tapEgg') { tapEgg(); return; }
  if (id === 'dex') { openDex(); return; }
  if (id === 'aikey') { openKey(); return; }
  if (id === 'chat') { if (S.pet) openChat(); else say('먼저 알을 깨워 주세요!', 2000); return; }
  if (id === 'status') {
    if (S.pet) openStatus(); else if (!S.egg) openEggSelect(); else say('알을 톡톡 두드려 주세요!', 2000);
    return;
  }
  if (!S.pet) return;
  if (panelOpen()) { closePanel(); if (locked()) return; }
  doAction(id);
}

/* ---------- 주기적 갱신 ---------- */
function tick() {
  const now = Date.now(), min = (now - lastTick) / 60000; lastTick = now;
  const p = S.pet;
  if (p) {
    const before = { hunger: p.hunger, mood: p.mood, clean: p.clean };
    applyDecay(min, 1);
    if (!p.asleep && p.poopX.length < 3 && p.hunger > 20 && !locked() && Math.random() < min * .03) {
      p.poopX.push(clampX(pos.x + (dir > 0 ? -4 : SIZE - 30)));
      p.clean = clamp(p.clean - 8); say('앗, 응가를 했어요!'); renderPoops(); save();
    }
    if (p.asleep && p.energy >= 100) { p.asleep = false; say(`${iga(p.name)} 개운하게 일어났어요!`); save(); }
    if (!p.asleep && p.energy < 8 && !locked() && !drag) fallAsleep(true);
    for (const k of ['hunger', 'mood', 'clean']) if (before[k] >= 25 && p[k] < 25) notify(k);
    if (now - (S.savedAt || 0) > 60000) save();
  }
  renderNeeds();
  if (hover) renderHud();
  syncState();
}
let lastFrame = performance.now(), hitAcc = 0;
// 초당 30번 움직임을 계산한다. 화면은 값이 바뀔 때만 다시 그려지므로 가만히 있을 때는 CPU를 거의 안 쓴다
function frame() {
  const now = performance.now();
  const dt = Math.min(.05, (now - lastFrame) / 1000); lastFrame = now; tSec += dt;
  step(dt); renderPet(); place();
  hitAcc += dt; if (hitAcc > .2) { hitAcc = 0; hitTest(); }
}

/* ---------- 입력 ---------- */
function bind() {
  const pet = $('#pet');
  pet.addEventListener('mousedown', e => {
    if (e.button !== 0 || locked()) return;
    const now = performance.now();
    drag = { sx: e.clientX, sy: e.clientY, ox: e.clientX - pos.x, oy: e.clientY - pos.y, moved: false, lx: e.clientX, ly: e.clientY, lt: now, vx: 0, vy: 0 };
    setIgnore(false); e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!drag) { hitTest(); return; }
    const now = performance.now(), dts = Math.max(1, now - drag.lt) / 1000;
    drag.vx = drag.vx * .6 + ((e.clientX - drag.lx) / dts) * .4;
    drag.vy = drag.vy * .6 + ((e.clientY - drag.ly) / dts) * .4;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
      drag.moved = true; onGround = false; vel.x = vel.y = 0;
      pet.classList.add('dragging'); hover = false; renderHud(); $('#bubble').hidden = true;
      if (S.pet && S.pet.asleep) { S.pet.asleep = false; say('으앗, 깼어요!', 1500); }
      else if (S.pet) say(randOf(['우와~ 높다!', '어디 가요?', '히히, 날아간다!']), 1500);
    }
  });
  window.addEventListener('mouseup', e => {
    if (e.button !== 0 || !drag) return;
    const d = drag; drag = null; pet.classList.remove('dragging');
    if (d.moved) {
      const fresh = performance.now() - d.lt < 120;
      vel.x = fresh ? Math.max(-900, Math.min(900, d.vx * .6)) : 0;
      vel.y = fresh ? Math.max(-900, Math.min(500, d.vy * .5)) : 0;
      fallFrom = pos.y; onGround = false; save();
    } else onPetClick();
    hitTest();
  });
  pet.addEventListener('dblclick', () => { if (S.pet && !locked()) openStatus(); });
  pet.addEventListener('contextmenu', e => { e.preventDefault(); if (!drag) api.menu(menuState()); });
  if (api.onCursor) api.onCursor(pt => { if (drag) return; mouse.x = pt.inside ? pt.x : -1; mouse.y = pt.y; hitTest(); });
  document.addEventListener('mouseleave', () => { if (drag) return; mouse.x = -1; setIgnore(true); setHover(false); });
  window.addEventListener('blur', () => { if (drag) { drag = null; pet.classList.remove('dragging'); onGround = false; } });
  window.addEventListener('resize', () => { pos.x = clampX(pos.x); if (onGround) pos.y = restY(); poopSig = ''; renderPoops(); place(); });

  const panel = $('#panel');
  panel.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-close]')) { closePanel(); return; }
    const d = t.closest('[data-do]');
    if (d && !d.disabled) {
      const a = d.dataset.do;
      if (a === 'skin') { $('#skinFile').click(); return; }
      if (a === 'unskin') { S.skin = null; S.skinId = 0; petKey = ''; saveNow(); syncState(); openStatus(); say('원래 모습으로 돌아왔어요!', 2000); return; }
      if (a === 'feed') { openFeed(); return; }
      if (a === 'dex') { openDex(); return; }
      if (a === 'chat') { openChat(); return; }
      closePanel(); if (!locked()) doAction(a); return;
    }
    const mv = t.closest('[data-move]'); if (mv && !mv.disabled) { act(mv.dataset.move); return; }
    const fd = t.closest('[data-food]'); if (fd && !fd.disabled) { feed(fd.dataset.food); return; }
    const eo = t.closest('.egg-opt'); if (eo) { pickEgg(eo.dataset.sp); return; }
    const br = t.closest('[data-branch]'); if (br) { chooseBranch(br.dataset.branch); return; }
    if (t.closest('#pickGo')) { confirmEgg(); return; }
    if (t.closest('#gStart')) { runGame(); return; }
    if (t.closest('#resetYes')) { doReset(); return; }
    if (t.closest('#chatSend')) { sendChat(); return; }
    if (t.closest('#toKey')) { openKey(); return; }
    if (t.closest('#toChat')) { openChat(); return; }
    if (t.closest('#keySave')) { saveKey(); return; }
    if (t.closest('#keyClear')) { api.aiClearKey().then(() => openKey('저장된 키를 지웠어요.')).catch(() => {}); return; }
    if (t.closest('#chatClear')) { if (chatBusy) return; S.chat = []; save(); renderChatLog(); t.closest('#chatClear').disabled = true; return; }
  });
  panel.addEventListener('change', e => { if (e.target.id === 'skinFile' && e.target.files[0]) loadSkin(e.target.files[0]); });
  // 한글 입력 중(조합 중)에 누른 Enter는 글자 확정용이라 무시한다
  panel.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    if (e.target.id === 'nameIn') { e.preventDefault(); confirmEgg(); }
    if (e.target.id === 'keyIn') { e.preventDefault(); saveKey(); }
    if (e.target.id === 'chatIn') { e.preventDefault(); sendChat(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen() && panel.querySelector('.x')) closePanel(); });
  api.onAction(onAction);
}

/* ---------- 시작 ---------- */
async function boot() {
  let res = {};
  try { res = (await api.load()) || {}; } catch (e) {}
  try { await buildPixelArt(); } catch (e) { console.error('pixel art failed', e); }
  S = normalize(res.save);
  try { Object.assign(EMOTE, await buildEmotes()); } catch (e) {}
  applyScale();
  const away = catchUp();
  lastTick = Date.now();
  pos.x = S.posX != null ? clampX(S.posX) : clampX(W() * .65);
  pos.y = -SIZE; onGround = false; fallFrom = groundY();
  bind();
  renderAll();
  if (S.pet) {
    setTimeout(() => say(away > 60 ? `${iga(S.pet.name)} 보고 싶었대요!` : `${CRY[S.pet.form]} 반가워요!`, 2600), 900);
    setTimeout(checkEvo, 1800);
  } else if (!S.egg) setTimeout(openEggSelect, 600);
  setMode('idle', 2500);
  setInterval(frame, 33);
  setInterval(tick, 1000);
  loadOfficial();
  // 인터넷이 없어서 못 받은 원작 도트는 1분마다 다시 받아 본다
  setInterval(() => { if (Object.keys(OFF).length < Object.keys(DEX_ID).length) loadOfficial(); }, 60000);
}
boot();
