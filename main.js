// 몬스터 둥지 — 바탕화면 데스크톱 펫 메인 프로세스
// 화면 작업 영역 전체를 덮는 투명 창을 띄우고, 포켓몬 위에 마우스가 있을 때만 클릭을 받는다.
const { app, BrowserWindow, screen, ipcMain, Menu, Tray, nativeImage, net, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

// 저장 폴더를 운영체제와 관계없이 같은 이름으로 고정한다 (예: %APPDATA%\MonsterNest)
app.setName('MonsterNest');
app.setPath('userData', path.join(app.getPath('appData'), 'MonsterNest'));

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win = null;
let tray = null;
let settings = { alwaysOnTop: true };
let petState = null; // 렌더러가 보내 주는 현재 상태 (메뉴 구성용)

const savePath = () => path.join(app.getPath('userData'), 'save.json');
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJSON(p, data) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, p);
  } catch (e) {
    console.error('save failed', e);
  }
}

function send(id) {
  if (win && !win.isDestroyed()) {
    if (!win.isVisible()) win.showInactive();
    win.webContents.send('action', id);
  }
}

// ---------- 자동 실행 ----------
function loginItemOptions() {
  if (process.platform !== 'win32') return {};
  if (!app.isPackaged) return { path: process.execPath, args: [app.getAppPath()] };
  return { path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath };
}
function getAutoStart() {
  try { return app.getLoginItemSettings(loginItemOptions()).openAtLogin; } catch { return false; }
}
function setAutoStart(on) {
  app.setLoginItemSettings({ openAtLogin: on, ...loginItemOptions() });
}

// ---------- 창 ----------
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    show: false,
    backgroundColor: '#00000000',
    title: '몬스터 둥지',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });
  if (settings.alwaysOnTop) win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(true, { forward: true });
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('closed', () => { win = null; });
}

// 커서 위치를 직접 확인해서 화면에 알려 준다.
// 운영체제가 마우스 이동을 넘겨주지 않는 경우(리눅스, 커서는 가만히 있는데 포켓몬이 걸어온 경우)에도
// 포켓몬 위에 커서가 있으면 클릭을 받을 수 있게 된다.
let lastCursor = '';
function pollCursor() {
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  const p = screen.getCursorScreenPoint(), b = win.getBounds();
  const key = `${p.x},${p.y},${b.x},${b.y}`;
  if (key === lastCursor) return;
  lastCursor = key;
  const inside = p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height;
  win.webContents.send('cursor', { x: p.x - b.x, y: p.y - b.y, inside });
}

function fitToDisplay() {
  if (!win || win.isDestroyed()) return;
  win.setBounds(screen.getPrimaryDisplay().workArea);
}

function setAlwaysOnTop(on) {
  settings.alwaysOnTop = on;
  writeJSON(settingsPath(), settings);
  if (win) win.setAlwaysOnTop(on, 'floating');
  rebuildTray();
}

function toggleHidden() {
  if (!win) return;
  if (win.isVisible()) win.hide(); else win.showInactive();
  rebuildTray();
}

// ---------- 메뉴 ----------
function actionItems(st) {
  if (!st || st.phase === 'none') return [{ label: '알 고르기', click: () => send('eggSelect') }];
  if (st.phase === 'egg') return [
    { label: `${st.name}의 알`, enabled: false },
    { type: 'separator' },
    { label: '알 두드리기', click: () => send('tapEgg') },
    { label: '도감', click: () => send('dex') }
  ];
  const off = st.asleep || st.locked;
  return [
    { label: `${st.name}  ·  ${st.formName} LV ${st.level}`, enabled: false },
    { label: `코인 ${st.coins}${st.need ? '  ·  ' + st.need : ''}`, enabled: false },
    { type: 'separator' },
    {
      label: '밥 주기',
      enabled: !off,
      submenu: st.foods.map(f => ({
        label: `${f.name}  (${f.price ? f.price + '코인' : '무료'})`,
        enabled: !off && st.coins >= f.price,
        click: () => send('feed:' + f.id)
      }))
    },
    { label: '놀아 주기 (별 잡기)', enabled: !off, click: () => send('play') },
    { label: '씻기기', enabled: !off, click: () => send('wash') },
    { label: st.asleep ? '깨우기' : '재우기', enabled: !st.locked, click: () => send('sleep') },
    { label: '모험 떠나기', enabled: !off, click: () => send('adventure') },
    { type: 'separator' },
    { label: '말 걸기 (Claude)', enabled: !st.locked, click: () => send('chat') },
    { label: '상태창 열기', enabled: !st.locked, click: () => send('status') },
    { label: '도감', enabled: !st.locked, click: () => send('dex') }
  ];
}

function settingItems() {
  const st = petState || {};
  return [
    { label: '항상 다른 창 위에 표시', type: 'checkbox', checked: settings.alwaysOnTop, click: m => setAlwaysOnTop(m.checked) },
    { label: '컴퓨터 켤 때 자동 실행', type: 'checkbox', checked: getAutoStart(), click: m => { setAutoStart(m.checked); rebuildTray(); } },
    { label: '배고플 때 알림 받기', type: 'checkbox', checked: st.notify !== false, click: m => send(m.checked ? 'notify:on' : 'notify:off') },
    {
      label: '크기',
      submenu: [
        { label: '보통', type: 'radio', checked: st.scale !== 3, click: () => send('scale:2') },
        { label: '크게', type: 'radio', checked: st.scale === 3, click: () => send('scale:3') }
      ]
    },
    { type: 'separator' },
    { label: 'Claude API 키 설정…', click: () => send('aikey') },
    {
      label: 'Claude 모델',
      submenu: [
        { label: 'Claude Opus 5.5 (기본 · 똑똑함)', type: 'radio', checked: st.aiModel !== 'haiku', click: () => send('aimodel:opus') },
        { label: 'Claude Haiku 5.5 (빠름 · 저렴함)', type: 'radio', checked: st.aiModel === 'haiku', click: () => send('aimodel:haiku') }
      ]
    },
    { type: 'separator' },
    { label: '처음부터 다시 키우기…', click: () => send('reset') }
  ];
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    ...actionItems(petState),
    { type: 'separator' },
    { label: '화면 가운데로 불러오기', click: () => send('summon') },
    { label: win && win.isVisible() ? '잠깐 숨기기' : '다시 보이기', click: toggleHidden },
    { label: '설정', submenu: settingItems() },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() }
  ]);
}

function rebuildTray() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
  const st = petState;
  let tip = '몬스터 둥지';
  if (st && st.phase === 'pet') tip = `${st.name} (${st.formName} LV ${st.level})${st.need ? ' · ' + st.need : ''}`;
  else if (st && st.phase === 'egg') tip = `${st.name}의 알 · 두드려서 깨워 주세요`;
  tray.setToolTip(tip);
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.on('click', () => {
    if (process.platform === 'darwin') return;
    if (win && !win.isVisible()) { win.showInactive(); rebuildTray(); }
    send('status');
  });
  rebuildTray();
}

// ---------- 원작 도트 ----------
// PokeAPI 공개 저장소의 블랙·화이트 움직이는 스프라이트를 처음 한 번 내려받아 저장해 둔다.
// MONSTER_NEST_SPRITE_BASE는 테스트에서 인터넷 끊김을 흉내 낼 때만 쓴다
const SPRITE_BASE = process.env.MONSTER_NEST_SPRITE_BASE || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/';
async function getSprite(key) {
  const m = /^(front|back)\/(\d{1,4})$/.exec(String(key));
  if (!m) return null;
  const dir = path.join(app.getPath('userData'), 'sprites');
  const file = path.join(dir, `${m[1]}-${m[2]}.gif`);
  try { return 'data:image/gif;base64,' + fs.readFileSync(file).toString('base64'); } catch {}
  try {
    const res = await net.fetch(SPRITE_BASE + (m[1] === 'back' ? 'back/' : '') + m[2] + '.gif');
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 64 || buf.subarray(0, 3).toString('latin1') !== 'GIF') return null;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, buf);
    return 'data:image/gif;base64,' + buf.toString('base64');
  } catch {
    return null;
  }
}

// ---------- Claude와 대화 ----------
// API 키는 이 컴퓨터에 암호화해서 저장하고, 화면(렌더러)에는 절대 넘기지 않는다.
const AI_MODELS = { opus: 'claude-opus-5-5', haiku: 'claude-haiku-5-5' };
let AnthropicSDK = null, aiBusy = false;
const keyPath = () => path.join(app.getPath('userData'), 'claude-key.bin');
function readKey() {
  try {
    const buf = fs.readFileSync(keyPath()), tag = buf.subarray(0, 4).toString('latin1');
    if (tag === 'enc:') return safeStorage.decryptString(buf.subarray(4));
    if (tag === 'raw:') return buf.subarray(4).toString('utf8');
  } catch {}
  return null;
}
function writeKey(key) {
  const secure = safeStorage.isEncryptionAvailable();
  const data = secure ? Buffer.concat([Buffer.from('enc:'), safeStorage.encryptString(key)]) : Buffer.from('raw:' + key);
  fs.mkdirSync(path.dirname(keyPath()), { recursive: true });
  fs.writeFileSync(keyPath(), data, { mode: 0o600 });
  return secure;
}
// 대화 기록을 API 형식으로 정리: user로 시작·끝, 같은 역할이 이어지면 합치고, 길이를 제한한다
function cleanMessages(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const msg of list.slice(-16)) {
    if (!msg || (msg.role !== 'user' && msg.role !== 'assistant') || typeof msg.content !== 'string') continue;
    const content = msg.content.slice(0, 1000).trim();
    if (!content) continue;
    if (out.length && out[out.length - 1].role === msg.role) out[out.length - 1].content += '\n' + content;
    else out.push({ role: msg.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.length && out[out.length - 1].role === 'user' ? out : null;
}
async function aiChat(req) {
  const key = readKey() || process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: 'nokey' };
  if (aiBusy) return { error: 'busy' };
  const messages = cleanMessages(req && req.messages);
  if (!messages) return { error: 'bad' };
  if (!AnthropicSDK) { const mod = require('@anthropic-ai/sdk'); AnthropicSDK = mod.Anthropic || mod.default || mod; }
  const A = AnthropicSDK;
  // MONSTER_NEST_API_BASE는 테스트에서 가짜 서버로 보낼 때만 쓴다
  const client = new A({ apiKey: key, baseURL: process.env.MONSTER_NEST_API_BASE || undefined, maxRetries: 2, timeout: 45000 });
  const model = req.model === 'haiku' ? AI_MODELS.haiku : AI_MODELS.opus;
  const params = { model, max_tokens: 2048, system: String(req.system || '').slice(0, 4000), output_config: { effort: 'low' }, messages };
  aiBusy = true;
  try {
    // Opus는 안전 장치가 거절하면 서버가 다른 모델로 다시 답하게 한다 (Haiku는 이 기능이 없다)
    const res = model === AI_MODELS.opus
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
    if (res.stop_reason === 'refusal') return { error: 'refusal' };
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!text) return { error: res.stop_reason === 'max_tokens' ? 'long' : 'empty' };
    return { text: text.slice(0, 800) };
  } catch (e) {
    const is = cls => typeof A[cls] === 'function' && e instanceof A[cls];
    if (is('AuthenticationError') || is('PermissionDeniedError')) return { error: 'auth' };
    if (is('RateLimitError')) return { error: 'rate' };
    if (is('BadRequestError')) return { error: /credit|balance|billing/i.test(e.message || '') ? 'credit' : 'bad' };
    if (is('APIConnectionError')) return { error: 'network' };
    if (is('APIError')) return { error: e.status >= 500 ? 'server' : 'api', status: e.status };
    return { error: 'unknown' };
  } finally {
    aiBusy = false;
  }
}

// ---------- IPC ----------
ipcMain.handle('ai-status', () => ({ hasKey: !!(readKey() || process.env.ANTHROPIC_API_KEY), saved: !!readKey(), secure: safeStorage.isEncryptionAvailable() }));
ipcMain.handle('ai-set-key', (_e, key) => {
  key = String(key || '').trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{10,}$/.test(key)) return { ok: false, error: 'format' };
  try { return { ok: true, secure: writeKey(key) }; } catch { return { ok: false, error: 'save' }; }
});
ipcMain.handle('ai-clear-key', () => { try { fs.unlinkSync(keyPath()); } catch {} return { ok: true }; });
ipcMain.handle('ai-chat', (_e, req) => aiChat(req));
ipcMain.handle('sprite', (_e, key) => getSprite(key));
ipcMain.handle('load', () => ({ save: readJSON(savePath(), null), platform: process.platform }));
ipcMain.on('save', (_e, data) => writeJSON(savePath(), data));
ipcMain.on('save-sync', (e, data) => { writeJSON(savePath(), data); e.returnValue = true; });
ipcMain.on('ignore', (_e, ignore) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});
ipcMain.on('focus', () => { if (win && !win.isDestroyed()) win.focus(); });
ipcMain.on('state', (_e, st) => { petState = st; rebuildTray(); });
ipcMain.on('menu', (_e, st) => {
  petState = st;
  const menu = Menu.buildFromTemplate([
    ...actionItems(st),
    { type: 'separator' },
    { label: '설정', submenu: settingItems() },
    { label: '잠깐 숨기기', click: toggleHidden },
    { label: '종료', click: () => app.quit() }
  ]);
  menu.popup({ window: win });
});
ipcMain.on('tray-icon', (_e, dataUrl) => {
  if (!tray) return;
  const img = nativeImage.createFromDataURL(dataUrl);
  if (img.isEmpty()) return;
  const size = process.platform === 'darwin' ? 18 : 32;
  tray.setImage(img.resize({ width: size, height: size, quality: 'best' }));
});

// ---------- 시작 ----------
app.on('second-instance', () => send('summon'));

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.monsternest.desktop');
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  settings = { ...settings, ...readJSON(settingsPath(), {}) };
  createWindow();
  createTray();
  setInterval(pollCursor, 66);
  screen.on('display-metrics-changed', fitToDisplay);
  screen.on('display-added', fitToDisplay);
  screen.on('display-removed', fitToDisplay);
});

app.on('window-all-closed', () => app.quit());
