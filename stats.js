import { openRoom, roomFromUrl } from './db.js?v=2';

const PEOPLE = [
  { id: 'margot', name: 'Margot', color: 'var(--s-margot)' },
  { id: 'thomas', name: 'Thomas', color: 'var(--s-thomas)' }
];
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const $ = s => document.querySelector(s);

const code = roomFromUrl() || (() => { try { return localStorage.getItem('pomoduo-room'); } catch { return null; } })();
if (!code) {
  $('#msg').textContent = 'Abre esta página desde el enlace de vuestra sala.';
} else {
  $('#back').href = 'index.html#' + code;
  init(code).catch(e => { console.error(e); $('#msg').textContent = 'No se pudo cargar la base de datos.'; });
}

const fmtH = min => (min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min` : `${Math.round(min)} min`);
const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const weekStart = d => { const x = dayStart(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

let view = 'days';
let logs = { margot: [], thomas: [] };

async function init(code) {
  const db = await openRoom(code);
  if (db.mode === 'local') $('#msg').textContent = 'Modo local: solo se ven los datos de este navegador.';
  $('#legend').innerHTML = PEOPLE.map(p => `<span><i style="background:${p.color}"></i>${p.name}</span>`).join('');
  document.querySelectorAll('.seg button').forEach(b => (b.onclick = () => {
    view = b.dataset.view;
    document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('active', x === b));
    draw();
  }));
  for (const p of PEOPLE) {
    db.watch('log/' + p.id, v => { logs[p.id] = v ? Object.values(v) : []; draw(); });
  }
  addEventListener('resize', draw);
}

function buckets() {
  const now = new Date();
  const out = [];
  if (view === 'days') {
    const first = addDays(dayStart(now), -6);
    for (let i = 0; i < 7; i++) {
      const s = addDays(first, i), e = addDays(s, 1);
      out.push({ s, e, label: i === 6 ? 'hoy' : DAYS[s.getDay()], long: `${DAYS[s.getDay()]} ${s.getDate()} ${MONTHS[s.getMonth()]}` });
    }
  } else {
    const first = addDays(weekStart(now), -7 * 7);
    for (let i = 0; i < 8; i++) {
      const s = addDays(first, 7 * i), e = addDays(s, 7);
      out.push({ s, e, label: `${s.getDate()} ${MONTHS[s.getMonth()]}`, long: `semana del ${s.getDate()} ${MONTHS[s.getMonth()]}` });
    }
  }
  for (const b of out) {
    b.v = {};
    for (const p of PEOPLE) {
      const items = logs[p.id].filter(x => x.at >= +b.s && x.at < +b.e);
      b.v[p.id] = { n: items.length, min: items.reduce((a, x) => a + (x.min || 0), 0) };
    }
  }
  return out;
}

function sumSince(id, since) {
  const items = logs[id].filter(x => x.at >= +since);
  return { n: items.length, min: items.reduce((a, x) => a + (x.min || 0), 0) };
}

function draw() {
  // Tarjetas
  const now = new Date();
  $('#tiles').innerHTML = PEOPLE.map(p => {
    const d = sumSince(p.id, dayStart(now)), w = sumSince(p.id, weekStart(now));
    return `<div class="tile"><div class="who"><span class="dot" style="background:${p.color}"></span>${p.name} · hoy</div>
      <div class="big">${d.n} <span class="sub">${d.n === 1 ? 'pomodoro' : 'pomodoros'}</span></div>
      <div class="sub">${fmtH(d.min)} hoy · ${w.n} esta semana (${fmtH(w.min)})</div></div>`;
  }).join('');

  // Gráfico de barras agrupadas (horas de enfoque)
  const data = buckets();
  const svg = $('#chart');
  svg.classList.remove('hovering');
  $('#tip').hidden = true;
  const W = svg.clientWidth || 800, H = 280;
  const m = { t: 12, r: 8, b: 28, l: 40 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxMin = Math.max(60, ...data.flatMap(b => PEOPLE.map(p => b.v[p.id].min)));
  const stepH = maxMin <= 240 ? 1 : maxMin <= 600 ? 2 : 5;
  const top = Math.ceil(maxMin / 60 / stepH) * stepH * 60;
  const y = v => m.t + ih - (v / top) * ih;
  const bw = iw / data.length;
  const barW = Math.min(28, (bw - 16) / 2);
  let s = '';
  for (let h = 0; h <= top / 60; h += stepH) {
    s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(h * 60)}" y2="${y(h * 60)}"/>`;
    s += `<text x="${m.l - 8}" y="${y(h * 60) + 4}" text-anchor="end">${h} h</text>`;
  }
  data.forEach((b, i) => {
    const cx = m.l + bw * i + bw / 2;
    PEOPLE.forEach((p, j) => {
      const v = b.v[p.id].min;
      const x = cx + (j === 0 ? -barW - 1 : 1);
      const h = Math.max(0, y(0) - y(v));
      if (h > 0) {
        const r = Math.min(4, h, barW / 2);
        s += `<path class="bar" data-i="${i}" fill="${p.color}" d="M${x},${y(0)} V${y(v) + r} q0,-${r} ${r},-${r} H${x + barW - r} q${r},0 ${r},${r} V${y(0)} Z"/>`;
      }
    });
    s += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${b.label}</text>`;
    s += `<rect class="hit" data-i="${i}" x="${m.l + bw * i}" y="${m.t}" width="${bw}" height="${ih}"/>`;
  });
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;

  const tip = $('#tip');
  svg.querySelectorAll('.hit').forEach(r => {
    r.onmouseenter = () => {
      const i = +r.dataset.i, b = data[i];
      svg.classList.add('hovering');
      svg.querySelectorAll('.bar').forEach(el => el.classList.toggle('on', el.dataset.i === String(i)));
      tip.innerHTML = `<b>${b.long}</b>` + PEOPLE.map(p => `<div><i style="background:${p.color}"></i>${p.name}: ${b.v[p.id].n} · ${fmtH(b.v[p.id].min)}</div>`).join('');
      tip.hidden = false;
      const x = m.l + bw * i + bw / 2;
      tip.style.left = Math.min(Math.max(0, x - tip.offsetWidth / 2), W - tip.offsetWidth) + 'px';
      tip.style.top = '0px';
    };
    r.onmouseleave = () => { svg.classList.remove('hovering'); tip.hidden = true; };
  });

  // Tabla
  $('#table').innerHTML = `<tr><th>${view === 'days' ? 'Día' : 'Semana'}</th>${PEOPLE.map(p => `<th>${p.name}</th>`).join('')}</tr>` +
    data.slice().reverse().map(b => `<tr><td>${b.long}</td>${PEOPLE.map(p => `<td>${b.v[p.id].n} · ${fmtH(b.v[p.id].min)}</td>`).join('')}</tr>`).join('');
}
