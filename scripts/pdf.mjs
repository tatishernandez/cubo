// Genera el PDF de entrega: toma una captura de cada cara del cubo 3D con
// Playwright y arma el documento desde print.html usando esas imágenes.
import { build, preview } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, process.argv[2] || 'Cubo_Seis_Caras_Evaluacion_Primer_Corte.pdf');

await build({ root, logLevel: 'warn' });
const server = await preview({ root, preview: { port: 4799, strictPort: true } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome' });

try {
  const dir = resolve(root, 'dist/capturas');
  mkdirSync(dir, { recursive: true });
  const shots = await browser.newPage({ viewport: { width: 1500, height: 1400 }, deviceScaleFactor: 2 });
  for (let n = 1; n <= 6; n++) {
    await shots.goto(`${url}?captura=${n}`);
    await shots.waitForFunction(() => window.__capturaLista);
    await shots.waitForTimeout(300);
    // Recorte al contorno visible del cubo (unión de sus caras proyectadas).
    const clip = await shots.evaluate(() => {
      const rs = [...document.querySelectorAll('.face')].map((f) => f.getBoundingClientRect());
      const x = Math.min(...rs.map((r) => r.left)) - 16;
      const y = Math.min(...rs.map((r) => r.top)) - 16;
      return { x, y, width: Math.max(...rs.map((r) => r.right)) + 16 - x, height: Math.max(...rs.map((r) => r.bottom)) + 16 - y };
    });
    await shots.screenshot({ path: `${dir}/cara${n}.png`, clip });
  }

  const doc = await browser.newPage();
  await doc.goto(`${url}print.html?capturas`, { waitUntil: 'networkidle' });
  await doc.pdf({ path: out, preferCSSPageSize: true });
  console.log(`PDF generado: ${out}`);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
