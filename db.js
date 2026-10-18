// Capa mínima de datos: Firebase Realtime Database, o localStorage como modo local.
import { FIREBASE_CONFIG } from './config.js';

const FB = 'https://www.gstatic.com/firebase10.12.2/';

export function isConfigured() {
  const k = FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey;
  return !!k && !k.startsWith('PEGA') && !!FIREBASE_CONFIG.databaseURL;
}

export function newRoomCode() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, b => abc[b % abc.length]).join('');
}

export function roomFromUrl() {
  const h = decodeURIComponent(location.hash.replace(/^#/, '')).trim();
  return /^[a-z0-9]{20,64}$/.test(h) ? h : null;
}

export async function openRoom(code) {
  return isConfigured() ? openFirebase(code) : openLocal(code);
}

async function openFirebase(code) {
  const appMod = await import(FB + 'firebase-app.js');
  const d = await import(FB + 'firebase-database.js');
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const db = d.getDatabase(app);
  const base = 'rooms/' + code;
  const r = p => d.ref(db, p ? base + '/' + p : base);
  let offset = 0;
  d.onValue(d.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
  let connectedCb = () => {};
  d.onValue(d.ref(db, '.info/connected'), s => connectedCb(!!s.val()));
  return {
    mode: 'firebase',
    now: () => Date.now() + offset,
    onConnected: cb => { connectedCb = cb; },
    watch: (p, cb) => d.onValue(r(p), s => cb(s.val()), e => console.error(e)),
    get: async p => (await d.get(r(p))).val(),
    set: (p, v) => d.set(r(p), v),
    push: (p, v) => d.push(r(p), v),
    transaction: async (p, fn) => {
      const res = await d.runTransaction(r(p), fn);
      return { committed: res.committed, value: res.snapshot.val() };
    }
  };
}

function openLocal(code) {
  const key = 'pomoduo-local-' + code;
  const listeners = new Set();
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };
  const parts = p => (p ? p.split('/').filter(Boolean) : []);
  const getAt = (obj, p) => parts(p).reduce((o, k) => (o == null ? null : o[k] ?? null), obj);
  const setAt = (obj, p, v) => {
    const ks = parts(p);
    if (!ks.length) return v ?? {};
    let o = obj;
    ks.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
    if (v === null || v === undefined) delete o[ks.at(-1)]; else o[ks.at(-1)] = v;
    return obj;
  };
  const clone = v => (v == null ? null : JSON.parse(JSON.stringify(v)));
  const emit = () => { const all = load(); listeners.forEach(l => l.cb(clone(getAt(all, l.p)))); };
  const write = (p, v) => { localStorage.setItem(key, JSON.stringify(setAt(load(), p, clone(v)))); emit(); };
  addEventListener('storage', e => { if (e.key === key) emit(); });
  return Promise.resolve({
    mode: 'local',
    now: () => Date.now(),
    onConnected: cb => cb(true),
    watch: (p, cb) => { const l = { p, cb }; listeners.add(l); cb(clone(getAt(load(), p))); return () => listeners.delete(l); },
    get: async p => clone(getAt(load(), p)),
    set: async (p, v) => write(p, v),
    push: async (p, v) => write(p + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), v),
    transaction: async (p, fn) => {
      const next = fn(clone(getAt(load(), p)));
      if (next === undefined) return { committed: false, value: clone(getAt(load(), p)) };
      write(p, next);
      return { committed: true, value: clone(next) };
    }
  });
}
