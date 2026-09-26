import { portada, caras, referencias, declaracionIA } from './content.js';

// Versión imprimible con formato APA 7 (trabajo de estudiante), en el orden
// que pide la guía: portada, seis caras, referencias y declaración de IA.
const asset = (path) => import.meta.env.BASE_URL + path;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = (cls, inner) => `<section class="page ${cls}">${inner}</section>`;

const cover = page('cover', `
  <div class="cover-title">
    <p class="titulo"><strong>${portada.tema}</strong></p>
    <p class="subtitulo">Cubo de las Seis Caras: Análisis Tridimensional</p>
  </div>
  <p>${portada.estudiante}</p>
  <p>${portada.programa}, ${portada.universidad}</p>
  <p>${portada.asignatura}</p>
  <p>Grupo ${portada.grupo}</p>
  <p>${portada.docente}</p>
  <p>${portada.fecha}</p>
`);

// Las imágenes originales se rotulan como figuras (APA 7).
let fig = 0;
const cuerpo = (c) =>
  c.imagen
    ? `<div class="figura">
         <p class="fig-num"><strong>Figura ${++fig}</strong></p>
         <p class="fig-titulo"><em>${c.alt}</em></p>
         <img class="cara-img" src="${asset(c.imagen)}" alt="${c.alt}" />
       </div>`
    : c.parrafos.map((p) => `<p>${esc(p)}</p>`).join('');

// Con ?capturas cada cara se muestra como la captura del cubo 3D que genera
// scripts/pdf.mjs; sin él, como texto.
const CAPTURAS = new URLSearchParams(location.search).has('capturas');

const faces = caras.map((c) => page('face', CAPTURAS
  ? `<h1>Cara ${c.numero}. ${c.titulo}</h1>
     <img class="captura-img" src="${asset(`capturas/cara${c.numero}.png`)}" alt="Cara ${c.numero} del cubo: ${c.titulo}" />`
  : `<h1>Cara ${c.numero}. ${c.titulo}</h1>
     <p class="pregunta"><strong>Pregunta orientadora:</strong> ${c.pregunta}</p>
     <div class="body">${cuerpo(c)}</div>`,
)).join('');

const refs = page('refs', `
  <h1>Referencias</h1>
  ${referencias.map((r) => `<p class="ref">${r}</p>`).join('')}
`);

const ia = page('ia', `
  <h1>Declaración de Uso de Inteligencia Artificial</h1>
  <div class="body">${declaracionIA}</div>
`);

document.querySelector('#doc').innerHTML = cover + faces + refs + ia;
