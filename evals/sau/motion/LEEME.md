# Banco de pruebas del kit de motion (plugin sau)

Comprueba que `plugins/sau/skills/motion-director/kit/` cumple `motion-rules.md`. Ninguna pieza
entra en `motion-catalog.md` sin pasarlo. No gasta tokens ni llama a ningún modelo.

```bash
evals/sau/motion/run.sh --nivel todo     # 1 + 2 + 3 + autoprueba
evals/sau/motion/run.sh --nivel 1        # solo reglas estáticas (segundos, sin red)
```

Salida: `0` todo en verde, `1` algo falla, `2` nada falla pero algo no se pudo ejecutar (sin red, sin Node, sin
navegador). Un `2` no cuenta como pasado: la pieza no entra en el catálogo.

## Qué comprueba cada nivel

| Nivel | Qué | Archivo | Necesita |
|---|---|---|---|
| 1 | `@keyframes` solo con `transform`/`opacity` (`offset-*` = aviso); sin `infinite` ni más de 1 repetición; toda animación dentro de `@supports (animation-timeline: view())` y `@media (prefers-reduced-motion: no-preference)`; componentes sin `"use client"`, hooks ni framer-motion; catálogo ↔ `kit/components` ↔ `index.ts` ↔ `MOTION_CONTAINERS` ↔ `piezas.json` | `nivel1.py` | Python 3 |
| 2a | Cada `fixtures/markdown/*.md` pasa por `remark-motion.ts` y da el HTML de su `.expected.html`; bloque desconocido sin movimiento; `Nota:importante` se conserva | `banco-web/tests/nivel2-remark.mjs` | Node ≥ 22.6, `banco-web/node_modules` |
| 2b | `install_kit.py` sobre `fixtures/web-minima/`: `--check` rojo → instalar → `--check` verde → segunda instalación sin cambios; detecta archivos alterados; `--blog-file` | `nivel2_instalador.py` | Python 3 |
| 3 | Con JS desactivado todo el texto está en el HTML; el H1 sin animación y CLS = 0 al hacer scroll; con `reducedMotion: reduce` ninguna animación; sin `animation-timeline` (emulado en Chromium y Firefox real) todo visible a opacidad 1; cada elemento animado empieza oculto/desplazado y termina a opacidad 1; capturas | `banco-web/tests/nivel3.mjs` | Node, `npm ci`, navegadores de Playwright (red la primera vez) |
| autoprueba | Aplica 12 defectos de `fixtures/rotos/` a una copia del kit y exige que el nivel 1 falle; y que el nivel 2a falle sin `pasos` en `MOTION_CONTAINERS` | `autoprueba.py` | Python 3 (+ Node para el caso remark) |

`run.sh` instala `banco-web/node_modules` (`npm ci`) y los navegadores (`npx playwright install chromium firefox`)
si faltan. Si no hay red, esos niveles salen como «NO EJECUTADO».

## Cómo está montado el nivel 3

`banco-web/` es una web Next.js mínima (Tailwind 4) que monta un muestrario con las piezas. El kit del plugin se
copia ahí con `install_kit.py` (`scripts/preparar.mjs`); esas copias están en `.gitignore`. `npm run test:motion`
(en `banco-web/`) hace: instalar kit, `next build`, `next start` y las pruebas de Playwright. Variables:
`BANCO_PUERTO` (3917), `BANCO_SIN_FIREFOX=1`, `BANCO_CAPTURAS=0`.

Las capturas (`capturas/<id>-inicio|mitad|final.png`) son para que Pelayo dé el OK visual a una pieza nueva.
Se regeneran en cada pasada; si pesan más de 2 MB en total, no se commitean.

## Registrar una pieza nueva

Cuatro cosas, en este orden. El nivel 1 falla si falta alguna.

1. **Entrada en `piezas.json`** (una por caso; una pieza puede tener varios, como `reveal`):

   ```json
   {
     "id": "linea-tiempo",
     "pieza": "linea-tiempo",
     "textos": ["Primer hito.", "Segundo hito."],
     "animados": [".motion-timeline > li"],
     "markdown": "linea-tiempo.md"
   }
   ```

   - `pieza`: el nombre exacto de la primera columna de la tabla «Resumen» de `motion-catalog.md`.
   - `id`: identificador del caso, único; es el `data-pieza` de su sección en el muestrario.
   - `textos`: frases que deben estar en el HTML sin JavaScript (todo el texto visible de la pieza).
   - `animados`: selectores CSS, relativos a la sección, de los elementos que se animan. El nivel 3 comprueba
     de cada uno que empieza oculto o desplazado al entrar y que termina con opacidad 1 y sin transformar.
     No pongas aquí elementos con rangos de animación largos que no terminan al entrar (como la línea de `pasos`).
   - `markdown`: nombre del fixture de `fixtures/markdown/`, o `null` si la pieza no tiene sintaxis Markdown.

2. **Fixture Markdown** (solo si tiene sintaxis `:::`): `fixtures/markdown/<nombre>.md` con el ejemplo del
   catálogo, y su `<nombre>.expected.html`. Genera el esperado con
   `cd banco-web && node tests/nivel2-remark.mjs --escribir`, **léelo y compáralo con el catálogo** antes de
   commitearlo: si el HTML esperado se genera sin mirar, el banco solo certifica lo que ya hace el código.

3. **Sección en el muestrario** `banco-web/src/app/page.tsx`: una `<section data-pieza="<id>">` con la pieza y
   los textos de `piezas.json`, seguida de `<Espacio />`. Importa el componente de `@/components/motion`
   (se copia desde el kit al preparar). No uses piezas de motion en la cabecera: es el LCP.

4. **Catálogo y kit**: el componente en `kit/components/` y exportado en `index.ts`; el contenedor en
   `MOTION_CONTAINERS` si lo tiene; la fila y la sección `## \`pieza\`` en `motion-catalog.md`.

Después: `evals/sau/motion/run.sh --nivel todo`, mirar las capturas nuevas y pedir el OK de Pelayo.

## Autoprueba: añadir un defecto roto

`fixtures/rotos/` guarda los defectos. En `autoprueba.py`, añade un caso a `CASOS`
`(nombre, función que muta una copia del kit, texto que debe aparecer en la salida del nivel 1)`.

## Lo que no cubre

- Chromium y Firefox de Playwright, en Windows/Linux de escritorio. Safari no.
- Rendimiento real (LCP, INP) sobre una web de verdad: aquí solo CLS y la ausencia de animación en el H1.
- La conexión del blog es código propio de cada web («Conectar el blog a mano» en el `README.md` de
  motion-director): el banco no la comprueba salvo el marcador de `--blog-file`.
