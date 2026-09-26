# Cubo de las Seis Caras

Cubo 3D interactivo para la evaluación del primer corte (semanas 3 y 4) de
*Educación Infantil en Colombia y Latinoamérica* — Universidad INCCA de Colombia.

- Arrastra (mouse o dedo) para girar el cubo; toca una cara para leer su desarrollo completo.
- Portada, referencias APA 7 y declaración de IA en los enlaces inferiores.

Todo el texto está en [`src/content.js`](src/content.js).

## Desarrollo

```bash
npm install
npm run dev
```

## PDF de entrega

```bash
npm run pdf -- Apellido_Nombre_Evaluacion_Primer_Corte.pdf
```

`scripts/pdf.mjs` toma con Playwright una captura de cada cara del cubo 3D
(`/?captura=N` muestra la cara N con su contenido completo) y arma el PDF desde
`print.html?capturas`. Requiere Google Chrome instalado.

## Despliegue

`.github/workflows/deploy.yml` construye con Vite y publica `dist/` en GitHub Pages
en cada push a `main` (Settings → Pages → Source: GitHub Actions).
Publicado en https://tatishernandez.github.io/cubo/
