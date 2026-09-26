import { portada, caras, referencias, declaracionIA } from './content.js';

const asset = (path) => import.meta.env.BASE_URL + path;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Modo captura (?captura=N): cada cara muestra su contenido completo y el
// cubo queda fijo con la cara N al frente, para tomar capturas del PDF.
const CAPTURA = Number(new URLSearchParams(location.search).get('captura')) || 0;

// Contenido completo de una cara: la imagen original o sus párrafos.
const cuerpo = (c) =>
  c.imagen
    ? `<a href="${asset(c.imagen)}" target="_blank" rel="noopener"><img class="cara-img" src="${asset(c.imagen)}" alt="${c.alt}" /></a>`
    : c.parrafos.map((p) => `<p>${esc(p)}</p>`).join('');

// ---------- Cuaterniones mínimos para una rotación tipo "trackball" ----------
// q = [x, y, z, w]. Las fórmulas coinciden con rotate3d() de CSS.
const qAxis = (x, y, z, deg) => {
  const h = (deg * Math.PI) / 360;
  const s = Math.sin(h);
  return [x * s, y * s, z * s, Math.cos(h)];
};
const qMul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [
  aw * bx + ax * bw + ay * bz - az * by,
  aw * by - ax * bz + ay * bw + az * bx,
  aw * bz + ax * by - ay * bx + az * bw,
  aw * bw - ax * bx - ay * by - az * bz,
];
const qNorm = (q) => {
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
};
const qSlerp = (a, b, t) => {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (dot < 0) { b = b.map((v) => -v); dot = -dot; }
  if (dot > 0.9995) return qNorm(a.map((v, i) => v + (b[i] - v) * t));
  const th = Math.acos(dot);
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return a.map((v, i) => v * wa + b[i] * wb);
};
const qRotate = (q, v) => {
  const [x, y, z] = qMul(qMul(q, [...v, 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [x, y, z];
};
const qCss = ([x, y, z, w]) => {
  w = Math.max(-1, Math.min(1, w));
  const s = Math.sqrt(1 - w * w);
  if (s < 1e-6) return 'rotate3d(0, 1, 0, 0deg)';
  const deg = (2 * Math.acos(w) * 180) / Math.PI;
  return `rotate3d(${x / s}, ${y / s}, ${z / s}, ${deg}deg)`;
};

// Posición de cada cara (transform CSS), su normal local y la rotación del
// cubo que la deja de frente.
const LAYOUT = [
  { tf: 'rotateY(0deg)', n: [0, 0, 1], q: qAxis(0, 1, 0, 0) },
  { tf: 'rotateY(90deg)', n: [1, 0, 0], q: qAxis(0, 1, 0, -90) },
  { tf: 'rotateY(180deg)', n: [0, 0, -1], q: qAxis(0, 1, 0, 180) },
  { tf: 'rotateY(-90deg)', n: [-1, 0, 0], q: qAxis(0, 1, 0, 90) },
  { tf: 'rotateX(90deg)', n: [0, -1, 0], q: qAxis(1, 0, 0, -90) },
  { tf: 'rotateX(-90deg)', n: [0, 1, 0], q: qAxis(1, 0, 0, 90) },
];

// ---------- Render ----------
const $ = (s) => document.querySelector(s);
const cube = $('#cube');
const stage = $('#stage');
const nav = $('#faces-nav');

$('#kicker').textContent = `${portada.evaluacion} · ${portada.universidad}`;
$('#tema').textContent = portada.tema;

caras.forEach((c, i) => {
  const face = document.createElement('section');
  face.className = 'face';
  face.dataset.index = i;
  face.style.setProperty('--c', c.color);
  face.style.setProperty('--tf', LAYOUT[i].tf);
  face.innerHTML = `
    <div class="face-top">
      <span class="face-num">${c.numero}</span>
      <span class="face-icon" aria-hidden="true">${c.icono}</span>
    </div>
    <h2>${c.titulo}</h2>
    <p class="face-q">${c.pregunta}</p>
    ${c.imagen
      ? `<img class="face-img" src="${asset(c.imagen)}" alt="" draggable="false" />`
      : `<div class="face-text">${(CAPTURA ? c.parrafos : c.parrafos.slice(0, 1)).map((p) => `<p>${esc(p)}</p>`).join('')}</div>`}
    <span class="face-cta">Toca para leer →</span>`;
  cube.appendChild(face);

  const b = document.createElement('button');
  b.style.setProperty('--c', c.color);
  b.innerHTML = `<b>${c.numero}</b><span>${c.titulo}</span>`;
  b.addEventListener('click', () => {
    if (current === i) openFace(i);
    else snapTo(i);
  });
  nav.appendChild(b);
});

// ---------- Estado de rotación ----------
let q = qNorm(qMul(qAxis(1, 0, 0, -18), qAxis(0, 1, 0, 28)));
let vel = { x: 0, y: 0 }; // grados por frame
let snap = null; // { from, to, t0, dur }
let idle = true; // giro automático hasta la primera interacción
let current = -1;

const DRAG_K = 0.45; // grados por píxel

if (CAPTURA) {
  document.body.classList.add('captura');
  idle = false;
  // Leve giro para que se vea el volumen del cubo sin deformar el texto.
  q = qNorm(qMul(qMul(qAxis(1, 0, 0, -6), qAxis(0, 1, 0, -10)), LAYOUT[CAPTURA - 1].q));
  prepararCaptura();
}

// Reduce la letra de cada cara hasta que su texto completo quepa.
async function prepararCaptura() {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  document.querySelectorAll('.face').forEach((face) => {
    const text = face.querySelector('.face-text');
    if (!text) return;
    let size = parseFloat(getComputedStyle(face).fontSize) * 1.25;
    face.style.fontSize = `${size}px`;
    while (text.scrollHeight > text.clientHeight + 1 && size > 6) {
      size *= 0.97;
      face.style.fontSize = `${size}px`;
    }
  });
  window.__capturaLista = true;
}

function applyDrag(dx, dy) {
  const r = qMul(qAxis(0, 1, 0, dx), qAxis(1, 0, 0, -dy));
  q = qNorm(qMul(r, q));
}

function frontFace() {
  let best = 0, bz = -Infinity;
  LAYOUT.forEach((f, i) => {
    const z = qRotate(q, f.n)[2];
    if (z > bz) { bz = z; best = i; }
  });
  return best;
}

// Qué cara está bajo un punto de pantalla. Se calcula con un rayo desde la
// cámara en vez de usar el hit-testing del DOM, que falla con caras 3D
// perfectamente alineadas (sobre todo en móviles).
const scene = $('.scene');
function pickFace(clientX, clientY) {
  const r = scene.getBoundingClientRect();
  const half = r.width / 2;
  const P = parseFloat(getComputedStyle(scene).perspective) || r.width * 3.2;
  const dir = [clientX - (r.left + half), clientY - (r.top + r.height / 2), -P];
  const inv = [-q[0], -q[1], -q[2], q[3]];
  // Rayo en coordenadas locales del cubo: cámara en (0, 0, P).
  const o = qRotate(inv, [0, 0, P]);
  const d = qRotate(inv, dir);
  let best = -1, bestT = Infinity;
  LAYOUT.forEach((f, i) => {
    const dn = d[0] * f.n[0] + d[1] * f.n[1] + d[2] * f.n[2];
    if (dn >= 0) return; // cara de espaldas
    const on = o[0] * f.n[0] + o[1] * f.n[1] + o[2] * f.n[2];
    const t = (half - on) / dn;
    const h = o.map((v, k) => v + d[k] * t);
    if (t > 0 && t < bestT && h.every((v) => Math.abs(v) <= half + 1)) { best = i; bestT = t; }
  });
  return best;
}

function snapTo(i) {
  idle = false;
  vel = { x: 0, y: 0 };
  // Mantiene el giro "de pie": se lleva la cara al frente sin torcerla.
  snap = { from: q, to: LAYOUT[i].q, t0: performance.now(), dur: 650 };
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

function tick(now) {
  if (snap) {
    const t = Math.min(1, (now - snap.t0) / snap.dur);
    q = qSlerp(snap.from, snap.to, ease(t));
    if (t >= 1) snap = null;
  } else if (!dragging) {
    if (idle) applyDrag(0.18, 0);
    else if (Math.abs(vel.x) + Math.abs(vel.y) > 0.01) {
      applyDrag(vel.x, vel.y);
      vel.x *= 0.94;
      vel.y *= 0.94;
    }
  }
  cube.style.transform = qCss(q);

  const f = frontFace();
  if (f !== current) {
    current = f;
    [...nav.children].forEach((b, i) => b.classList.toggle('active', i === f));
    [...cube.children].forEach((el, i) => el.classList.toggle('front', i === f));
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---------- Arrastre (mouse + táctil con Pointer Events) ----------
let dragging = false;
let start = null;
let last = null;

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  dragging = true;
  idle = false;
  snap = null;
  vel = { x: 0, y: 0 };
  start = { x: e.clientX, y: e.clientY, face: pickFace(e.clientX, e.clientY) };
  last = { x: e.clientX, y: e.clientY, t: performance.now() };
  stage.classList.add('grabbing');
});

window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - last.x;
  const dy = e.clientY - last.y;
  const now = performance.now();
  applyDrag(dx * DRAG_K, dy * DRAG_K);
  const dt = Math.max(1, now - last.t) / 16.7;
  vel = { x: (dx * DRAG_K) / dt, y: (dy * DRAG_K) / dt };
  last = { x: e.clientX, y: e.clientY, t: now };
});

function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  stage.classList.remove('grabbing');
  if (performance.now() - last.t > 80) vel = { x: 0, y: 0 };
  const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
  if (moved < 8 && start.face >= 0) {
    vel = { x: 0, y: 0 };
    openFace(start.face);
  }
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', (e) => { dragging = false; stage.classList.remove('grabbing'); });

// Teclado: flechas giran el cubo, Enter abre la cara frontal.
window.addEventListener('keydown', (e) => {
  if (modal.open) return;
  const map = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
  if (map[e.key]) {
    idle = false; snap = null; vel = { x: map[e.key][0] * 0.15, y: map[e.key][1] * 0.15 };
    applyDrag(...map[e.key]);
  } else if (e.key === 'Enter') openFace(current);
});

// ---------- Modal ----------
const modal = $('#modal');
let modalIndex = null; // número de cara, o null para páginas extra

function show({ badge, color, title, question, body, pager }) {
  modal.style.setProperty('--c', color);
  $('#modal-badge').textContent = badge;
  $('#modal-title').textContent = title;
  $('#modal-q').textContent = question || '';
  $('#modal-q').hidden = !question;
  $('#modal-body').innerHTML = body;
  $('#modal-foot').hidden = !pager;
  $('#modal-body').scrollTop = 0;
  if (!modal.open) modal.showModal();
}

function openFace(i) {
  const c = caras[i];
  modalIndex = i;
  show({
    badge: c.numero,
    color: c.color,
    title: `Cara ${c.numero} · ${c.titulo}`,
    question: c.pregunta,
    body: cuerpo(c),
    pager: true,
  });
  snapTo(i);
}

const extras = {
  portada: () => ({
    badge: '🎓',
    color: '#264653',
    title: 'Portada',
    body: `
      <div class="portada">
        <p class="kicker">${portada.universidad}</p>
        <h3>${portada.tema}</h3>
        <p class="lema">“${portada.lema}”</p>
        <dl>
          <dt>Estudiante</dt><dd>${portada.estudiante}</dd>
          <dt>Asignatura</dt><dd>${portada.asignatura}</dd>
          <dt>Programa</dt><dd>${portada.programa}</dd>
          <dt>Grupo</dt><dd>${portada.grupo}</dd>
          <dt>Docente</dt><dd>${portada.docente}</dd>
          <dt>Fecha</dt><dd>${portada.fecha}</dd>
        </dl>
      </div>`,
  }),
  referencias: () => ({
    badge: '📚',
    color: '#264653',
    title: 'Referencias (APA 7.ª ed.)',
    body: `<ul class="refs">${referencias.map((r) => `<li>${r}</li>`).join('')}</ul>`,
  }),
  ia: () => ({
    badge: '🤖',
    color: '#264653',
    title: 'Declaración de uso de Inteligencia Artificial',
    body: declaracionIA,
  }),
};

document.querySelectorAll('[data-extra]').forEach((b) =>
  b.addEventListener('click', () => {
    modalIndex = null;
    show(extras[b.dataset.extra]());
  }),
);

$('#modal-close').addEventListener('click', () => modal.close());
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
$('#prev').addEventListener('click', () => openFace((modalIndex + 5) % 6));
$('#next').addEventListener('click', () => openFace((modalIndex + 1) % 6));
modal.addEventListener('keydown', (e) => {
  if (modalIndex === null) return;
  if (e.key === 'ArrowLeft') openFace((modalIndex + 5) % 6);
  if (e.key === 'ArrowRight') openFace((modalIndex + 1) % 6);
});
