// Cumpleaños de Margot: el 26 de octubre su mitad se decora con banderines y confeti.
// Para probarlo otro día: añade ?cumple a la URL (antes del #), p. ej. index.html?cumple#codigo

const MONTH = 9, DAY = 26; // 26 de octubre (enero = 0)
const COLORS = ['#e0566a', '#4fa86a', '#f2b632', '#5b9bd5', '#f08a5d', '#b07cc6'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const isBirthday = () => {
  if (new URLSearchParams(location.search).has('cumple')) return true;
  const d = new Date();
  return d.getMonth() === MONTH && d.getDate() === DAY;
};

export function startBirthday(half) {
  let deco = null;
  const check = () => {
    const on = isBirthday();
    if (on && !deco) deco = decorate(half);
    if (!on && deco) { deco.remove(); deco = null; }
  };
  check();
  setInterval(check, 60000); // por si la página sigue abierta a medianoche
}

function decorate(half) {
  half.classList.add('cumple');
  const layer = document.createElement('div');
  layer.className = 'cumple-layer';
  layer.setAttribute('aria-hidden', 'true');
  half.prepend(layer);

  // Banderines
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('bunting');
  layer.appendChild(svg);
  const drawBunting = () => {
    const w = half.clientWidth, sag = 34, top = 6, flagW = 30, flagH = 38, gap = 10;
    svg.setAttribute('viewBox', `0 0 ${w} ${top + sag + flagH + 6}`);
    svg.setAttribute('height', top + sag + flagH + 6);
    const y = x => top + sag * 4 * (x / w) * (1 - x / w); // parábola
    let html = `<path d="M0 ${top} Q ${w / 2} ${top + sag * 2} ${w} ${top}" fill="none" stroke="#8a7f78" stroke-width="1.5"/>`;
    const n = Math.floor((w - 20) / (flagW + gap));
    const start = (w - n * (flagW + gap) + gap) / 2;
    for (let i = 0; i < n; i++) {
      const x1 = start + i * (flagW + gap), x2 = x1 + flagW, xm = (x1 + x2) / 2;
      const y1 = y(x1), y2 = y(x2), ym = (y1 + y2) / 2;
      const c = COLORS[i % COLORS.length];
      html += `<g class="flag" style="--d:${(i % 5) * .35}s;transform-origin:${xm}px ${ym}px">` +
        `<path d="M${x1} ${y1} L${x2} ${y2} L${xm} ${ym + flagH} Z" fill="${c}"/></g>`;
    }
    svg.innerHTML = html;
  };
  drawBunting();
  const ro = new ResizeObserver(drawBunting);
  ro.observe(half);

  // Confeti quieto de fondo
  const bits = document.createElement('div');
  bits.className = 'confetti-bits';
  for (let i = 0; i < 46; i++) {
    const b = document.createElement('i');
    const s = 5 + Math.random() * 6;
    b.style.cssText = `left:${Math.random() * 100}%;top:${12 + Math.random() * 86}%;` +
      `width:${s}px;height:${Math.random() < .5 ? s : s * 2.2}px;background:${COLORS[i % COLORS.length]};` +
      `transform:rotate(${Math.random() * 360}deg);border-radius:${Math.random() < .3 ? '50%' : '1px'}`;
    bits.appendChild(b);
  }
  layer.appendChild(bits);

  // Felicitación bajo el nombre
  const msg = document.createElement('div');
  msg.className = 'cumple-msg';
  msg.textContent = 'Feliz cumpleaños, Margot! 🎂';
  half.querySelector('.card header').appendChild(msg);

  // Lluvia de confeti al abrir (y al pulsar el mensaje)
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-fall';
  layer.appendChild(canvas);
  const burst = () => { if (!reduceMotion) rain(canvas, half); };
  msg.onclick = burst;
  setTimeout(burst, 300);

  return {
    remove() {
      ro.disconnect();
      layer.remove(); msg.remove();
      half.classList.remove('cumple');
    }
  };
}

function rain(canvas, half) {
  const dpr = devicePixelRatio || 1;
  const w = half.clientWidth, h = half.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const pieces = Array.from({ length: 160 }, () => ({
    x: Math.random() * w, y: -20 - Math.random() * h * .6,
    vy: 1.6 + Math.random() * 2.2, vx: -0.6 + Math.random() * 1.2,
    rot: Math.random() * 6.3, vr: -.15 + Math.random() * .3,
    sway: Math.random() * 6.3, s: 6 + Math.random() * 6,
    c: COLORS[Math.floor(Math.random() * COLORS.length)]
  }));
  const t0 = performance.now();
  const frame = now => {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = t < 5 ? 1 : Math.max(0, 1 - (t - 5) / 1.5);
    for (const p of pieces) {
      p.y += p.vy; p.sway += .05; p.x += p.vx + Math.sin(p.sway) * .8; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (1 + Math.abs(Math.sin(p.sway))));
      ctx.restore();
    }
    if (t < 6.5) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
  };
  requestAnimationFrame(frame);
}
