import { openRoom, newRoomCode, roomFromUrl } from './db.js';

const PEOPLE = [
  { id: 'margot', name: 'Margot' },
  { id: 'thomas', name: 'Thomas' }
];
const PHASE_LABEL = { focus: 'Enfoque', short: 'Pausa corta', long: 'Pausa larga' };
const DEFAULT_SETTINGS = { focus: 25, short: 5, long: 15, interval: 4 };
const ME_KEY = 'pomoduo-me';
const ROOM_KEY = 'pomoduo-room';

const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const localDate = (ms = Date.now()) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
};

const dur = (t, phase = t.phase) => (t.settings?.[phase] ?? DEFAULT_SETTINGS[phase]) * 60000;
const defaultTimer = () => ({
  phase: 'focus', running: false, endsAt: null, remaining: DEFAULT_SETTINGS.focus * 60000,
  cycle: 0, today: 0, todayDate: localDate(), settings: { ...DEFAULT_SETTINGS }
});

/* ---------- Arranque ---------- */
let code = roomFromUrl();
if (!code) {
  const saved = store.get(ROOM_KEY);
  if (saved) { history.replaceState(null, '', '#' + saved); code = saved; }
}
if (!code) {
  $('#lobby').hidden = false;
  $('#create-room').onclick = () => { location.hash = newRoomCode(); };
} else {
  store.set(ROOM_KEY, code);
  start(code).catch(err => {
    console.error(err);
    document.body.innerHTML = '<p style="padding:24px">No se pudo conectar con la base de datos. Revisa config.js y las reglas de Firebase.</p>';
  });
}
addEventListener('hashchange', () => location.reload());

async function start(code) {
  const db = await openRoom(code);
  $('#app').hidden = false;
  $('#stats-link').href = 'stats.html#' + code;

  const status = $('#status');
  const setStatus = () => {
    status.textContent = db.mode === 'local' ? '· modo local (sin Firebase)' : (connected ? '' : '· sin conexión');
  };
  let connected = true;
  db.onConnected(c => { connected = c; setStatus(); });
  setStatus();

  /* ----- Este ordenador ----- */
  const meSel = $('#me');
  let me = store.get(ME_KEY) || '';
  meSel.value = me;
  meSel.onchange = () => { me = meSel.value; store.set(ME_KEY, me); renderTitle(); };

  /* ----- Avisos ----- */
  const notifWrap = $('#notif-wrap');
  const notifBtn = $('#notif');
  const refreshNotif = () => {
    if (!('Notification' in window) || Notification.permission === 'granted') { notifWrap.hidden = true; return; }
    notifWrap.hidden = false;
    notifBtn.textContent = Notification.permission === 'denied' ? 'Avisos bloqueados en el navegador' : 'Activar avisos';
    notifBtn.disabled = Notification.permission === 'denied';
  };
  notifBtn.onclick = async () => { unlockAudio(); await Notification.requestPermission(); refreshNotif(); };
  refreshNotif();

  /* ----- Temporizadores ----- */
  const timers = {};   // id -> datos de Firebase
  const views = {};    // id -> elementos
  const tpl = $('#timer-tpl');

  for (const p of PEOPLE) {
    const other = PEOPLE.find(o => o.id !== p.id);
    const el = tpl.content.firstElementChild.cloneNode(true);
    el.dataset.who = p.id;
    el.querySelector('.name').textContent = p.name;
    el.querySelector('.sync').textContent = 'Sincronizar con ' + other.name;
    $('#halves').appendChild(el);
    views[p.id] = {
      el,
      time: el.querySelector('.time'),
      start: el.querySelector('.start'),
      count: el.querySelector('.count'),
      tabs: [...el.querySelectorAll('.tabs button')],
      last: {}
    };

    el.querySelector('.start').onclick = () => { unlockAudio(); toggle(p.id); };
    el.querySelector('.reset').onclick = () => reset(p.id);
    el.querySelector('.sync').onclick = () => sync(p.id, other.id);
    el.querySelector('.gear').onclick = () => openSettings(p);
    views[p.id].tabs.forEach(b => (b.onclick = () => setPhase(p.id, b.dataset.phase)));

  }

  const remainingOf = t => (t.running ? Math.max(0, t.endsAt - db.now()) : t.remaining);
  const update = (id, fn) => db.transaction('timers/' + id, cur => {
    if (!cur) return cur;
    fn(cur);
    return cur;
  });

  function toggle(id) {
    update(id, t => {
      if (t.running) {
        t.remaining = Math.max(0, t.endsAt - db.now());
        t.running = false; t.endsAt = null;
      } else {
        if (t.remaining <= 0) t.remaining = dur(t);
        t.running = true; t.endsAt = db.now() + t.remaining;
      }
    });
  }
  function reset(id) {
    update(id, t => { t.running = false; t.endsAt = null; t.remaining = dur(t); });
  }
  function setPhase(id, phase) {
    const t = timers[id];
    if (!t || t.phase === phase) return;
    if (t.running && !confirm('El temporizador está en marcha. Cambiar de fase?')) return;
    update(id, t => { t.phase = phase; t.running = false; t.endsAt = null; t.remaining = dur(t, phase); });
  }
  function sync(id, fromId) {
    const src = timers[fromId];
    if (!src) return;
    update(id, t => {
      t.settings = { ...src.settings };
      t.phase = src.phase;
      t.cycle = src.cycle;
      t.running = src.running;
      t.endsAt = src.running ? src.endsAt : null;
      t.remaining = src.running ? Math.max(0, src.endsAt - db.now()) : src.remaining;
    });
  }

  /* ----- Ajustes ----- */
  const dlg = $('#settings');
  function openSettings(p) {
    const t = timers[p.id];
    if (!t) return;
    dlg.querySelector('.who').textContent = p.name;
    const f = dlg.querySelector('form');
    for (const k of Object.keys(DEFAULT_SETTINGS)) f.elements[k].value = t.settings[k];
    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return;
      const s = {};
      for (const k of Object.keys(DEFAULT_SETTINGS)) s[k] = Math.max(1, Math.round(Number(f.elements[k].value) || DEFAULT_SETTINGS[k]));
      update(p.id, t => {
        const untouched = !t.running && t.remaining === dur(t);
        t.settings = s;
        if (untouched) t.remaining = dur(t);
      });
    };
    dlg.returnValue = '';
    dlg.showModal();
  }

  /* ----- Fin de fase ----- */
  const handling = new Set();
  const rung = new Set();
  async function finish(id, t) {
    const key = id + ':' + t.endsAt;
    if (handling.has(key)) return;
    handling.add(key);
    const endsAt = t.endsAt;

    if (id === me && !rung.has(key) && db.now() - endsAt < 60000) {
      rung.add(key);
      ring();
      notify(t.phase);
    }

    let ended = null;
    const res = await db.transaction('timers/' + id, cur => {
      if (!cur || !cur.running || cur.endsAt !== endsAt) return; // ya lo hizo otro dispositivo
      ended = { phase: cur.phase, min: cur.settings.focus };
      const today = localDate(endsAt);
      if (cur.phase === 'focus') {
        if (cur.todayDate !== today) { cur.today = 0; cur.todayDate = today; }
        cur.today += 1;
        cur.cycle = (cur.cycle || 0) + 1;
        cur.phase = cur.cycle >= cur.settings.interval ? 'long' : 'short';
      } else {
        if (cur.phase === 'long') cur.cycle = 0;
        cur.phase = 'focus';
      }
      cur.running = false; cur.endsAt = null; cur.remaining = dur(cur);
      return cur;
    });
    if (res.committed && ended?.phase === 'focus') {
      db.push('log/' + id, { at: endsAt, min: ended.min });
    }
  }

  function notify(phase) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const body = phase === 'focus' ? 'Fin del enfoque. Hora de una pausa.' : 'Fin de la pausa. A trabajar.';
    try { new Notification('Pomodúo', { body, icon: 'icon.svg', tag: 'pomoduo' }); } catch {}
  }

  /* ----- Pintar ----- */
  function render(id) {
    const t = timers[id], v = views[id];
    if (!t) return;
    const rem = remainingOf(t);
    const secs = Math.ceil(rem / 1000);
    const txt = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
    const cls = !t.running ? 'idle' : t.phase === 'focus' ? 'focus' : 'break';
    const today = t.todayDate === localDate() ? t.today : 0;
    const n = t.phase === 'focus' ? (t.cycle || 0) + 1 : Math.max(1, t.cycle || 0);
    const countHtml = `#${n} de ${t.settings.interval} <span class="today">· ${today} hoy</span>`;
    const L = v.last;
    if (L.txt !== txt) v.time.textContent = L.txt = txt;
    if (L.cls !== cls) { v.el.classList.remove('idle', 'focus', 'break'); v.el.classList.add(cls); L.cls = cls; }
    if (L.running !== t.running) { v.start.textContent = t.running ? 'PAUSAR' : 'EMPEZAR'; v.start.classList.toggle('running', t.running); L.running = t.running; }
    if (L.phase !== t.phase) { v.tabs.forEach(b => b.classList.toggle('active', b.dataset.phase === t.phase)); L.phase = t.phase; }
    if (L.count !== countHtml) v.count.innerHTML = L.count = countHtml;
    if (id === me) renderTitle();
    if (t.running && rem <= 0) finish(id, t);
  }
  function renderTitle() {
    const t = timers[me];
    if (!t) { document.title = 'Pomodúo'; return; }
    const secs = Math.ceil(remainingOf(t) / 1000);
    const title = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)} · ${PHASE_LABEL[t.phase]} | Pomodúo`;
    if (document.title !== title) document.title = title;
  }

  // Suscripciones (crear estado inicial si no existe)
  for (const p of PEOPLE) {
    db.transaction('timers/' + p.id, cur => (cur ? undefined : defaultTimer()));
    db.watch('timers/' + p.id, v => { timers[p.id] = v; render(p.id); });
  }

  // Un worker sigue haciendo tic aunque la pestaña esté en segundo plano.
  const tick = () => PEOPLE.forEach(p => render(p.id));
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),250)'], { type: 'text/javascript' })));
    w.onmessage = tick;
  } catch { setInterval(tick, 250); }
}

/* ---------- Sonido: timbre de reloj de cocina ---------- */
let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });

function ring() {
  unlockAudio();
  const ctx = audioCtx;
  if (!ctx) return;
  const out = ctx.createGain();
  out.gain.value = 0.35;
  out.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.05;
  const partials = [[2650, 1], [3980, 0.55], [5420, 0.3]];
  for (let burst = 0; burst < 3; burst++) {
    const bs = t0 + burst * 1.15;
    for (let i = 0; i < 16; i++) {
      const st = bs + i * 0.05;
      for (const [f, a] of partials) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f * (1 + (i % 2 ? 0.004 : -0.004));
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(a * 0.5, st + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, st + (i === 15 ? 0.6 : 0.09));
        o.connect(g).connect(out);
        o.start(st);
        o.stop(st + 0.65);
      }
    }
  }
}
