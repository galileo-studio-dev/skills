# Propuesta: 6 piezas nuevas para el kit de motion (GAL-1904)

- **Estado:** propuesta de diseño. Nada de esto está construido. Pide el OK de Pelayo antes de tocar `kit/`, `motion-rules.md` o `motion-catalog.md`.
- **Fecha:** 2026-11-06. **Rama:** `motion/diseno-piezas` (desde `claude/sau-indexacion-obligatoria`, 1b7a3d9).
- **Referencia visual:** `/ia-privada` y `/ia-onpremise` de galileo-studio-web (fondo oscuro, menta `#8aceb3`, Geist/Geist Mono, secciones numeradas, bento). Hoy esos patrones están hechos a mano en cada página; estas piezas los llevan al kit.
- **Pruebas:** cada ficha trae su **contrato de pruebas** para el banco (`skills/evals/sau/motion/`, rama `motion/banco-pruebas`). Niveles: **N1** reglas estáticas sobre el kit, **N2** Markdown e instalador, **N3** navegador.

## 0. Decisiones comunes

Valen para las seis piezas. Las fichas solo dicen lo que cambia.

1. **Todo sigue las reglas actuales.** CSS de scroll, sin JavaScript en el navegador (componentes de servidor, sin `"use client"`), solo `transform` y `opacity`, sin bucles, nada en el H1, el hero ni el elemento LCP. Con `prefers-reduced-motion: reduce` o sin soporte de `animation-timeline`, todo se ve estático y completo. Toda animación nueva vive dentro del mismo bloque `@supports (animation-timeline: view()) { @media (prefers-reduced-motion: no-preference) { … } }`.
2. **Elementos pequeños usan la línea de tiempo de su contenedor.** Con `view()`, la fase `entry` dura lo que mide el elemento. Una línea de 1 px o una etiqueta de 16 px terminarían su animación en 1–16 px de scroll: se verían saltar. Por eso el encabezado, las cifras, el esquema y la órbita declaran una línea de tiempo con nombre en su contenedor (`view-timeline: --motion-… block`) y sus piezas pequeñas la usan. Es la lección principal de este diseño y se propone como regla (ver §7).
3. **Escalonado sin `index` manual.** El retardo sale de la posición en la rejilla con `:nth-child()` y una variable `--motion-col`, no de una prop. Paso del escalonado: `--motion-stagger-step: 7%` del rango (el mismo 7 % que ya usa `Reveal index`).
4. **Patrón de componentes.** Igual que `Steps`: un envoltorio con la clase de la pieza y una lista HTML nativa dentro. Así el Markdown del blog y el TSX comparten el mismo CSS. Cada pieza trae además un ayudante para el elemento (`BentoItem`, `Figure`, `Row`) que solo se usa en TSX.
5. **Colores por variables.** El kit es genérico: no lleva `#8aceb3` ni `#050b10`. Usa `--primary`, `--background`, `--card`, `--border` (ya existen en las webs con shadcn) y variables nuevas `--motion-*` con valor por defecto derivado de ellas. Galileo puede sobrescribirlas en su `globals.css`.
6. **Contenedor de página.** La regla `.overflow-x-hidden:has(…)` de `motion.css` debe incluir las clases nuevas: `.motion-heading, .motion-bento, .motion-figures, .motion-rows, .motion-diagram, .motion-orbit`.
7. **Instalador.** `install_kit.py` tiene la lista `FILES` escrita a mano: cada componente nuevo se añade ahí y en `components/index.ts`.

### Keyframes nuevos (comunes)

```css
@keyframes motion-draw-x { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes motion-grow   { from { transform: scale(0);  } to { transform: scale(1);  } }
@keyframes motion-fade   { from { opacity: 0; }           to { opacity: 1; } }
@keyframes motion-ring-in { from { opacity: 0; transform: scale(0.86); } to { opacity: 1; transform: none; } }
/* órbita: ver ficha 6 */
@keyframes motion-orbit-spin    { from { transform: rotate(0deg); } to { transform: rotate(calc(var(--motion-dir) * var(--motion-sweep))); } }
@keyframes motion-orbit-counter { from { transform: rotate(0deg) scaleY(var(--motion-unsquash)); }
                                  to   { transform: rotate(calc(-1 * var(--motion-dir) * var(--motion-sweep))) scaleY(var(--motion-unsquash)); } }
```

Se reutilizan `motion-rise`, `motion-mask-up` y `motion-pop`, que ya existen.

### Variables nuevas en `:root` de `motion.css`

```css
--motion-stagger-step: 7%;
--motion-line: color-mix(in srgb, var(--primary) 70%, transparent);
--motion-hairline: color-mix(in srgb, var(--foreground) 10%, transparent);
--motion-surface: var(--background);
--motion-accent: var(--primary);
--motion-orbit-stroke: var(--primary);
--motion-orbit-glow: color-mix(in srgb, var(--primary) 22%, transparent);
--motion-orbit-squash: 0.85;          /* móvil: casi círculos */
--motion-orbit-sweep-outer: 24deg;
--motion-orbit-sweep-middle: 36deg;
--motion-orbit-sweep-inner: 52deg;
/* desde 48rem */
@media (min-width: 48rem) { :root { --motion-orbit-squash: 0.55; } }
```

### Tokens nuevos en `kit/lib/motion.ts` (espejo de lo anterior, para documentar y para pruebas)

```ts
/** Paso del escalonado en animaciones de scroll, en fracción del rango (7 %). Equivale a STAGGER.base. */
export const SCROLL_STAGGER_STEP = 0.07;

/** Órbita: aplastado de la elipse y tramo que avanza cada anillo al cruzar la sección. */
export const ORBIT = {
  squash: 0.55,
  squashCompact: 0.85,
  sweepDeg: { outer: 24, middle: 36, inner: 52 },
  radii: { outer: 46, middle: 32, inner: 19 }, // % del ancho del escenario
  maxNodes: { outer: 4, middle: 3, inner: 2 },
} as const;
```

---

## 1. `encabezado-seccion`

- **Tipo:** automática (de estructura). No cuenta en la dosis. Solo en páginas de servicio y landings (TSX).
- **Componente:** `SectionHeading` (+ `SectionKicker` exportado para usos sueltos). Generaliza `IaPrivadaHeading` / `IaPrivadaKicker`.

**Qué hace.** Abre una sección con número mono («02»), una línea fina que se dibuja de izquierda a derecha, la etiqueta en mono, el H2 que sube por máscara y una descripción que sube después.

**Cuándo usarla.** En cada sección numerada de una página de servicio o landing (01–07). **Cuándo no:** en el hero (allí va el H1 y nunca se anima); en el blog (los H2 del Markdown no llevan número ni etiqueta y ya tienen `reveal`); en secciones sin H2.

**Dosis.** Automática: una por sección H2, sin límite. No entra en la tabla sobria/media/expresiva, igual que `reveal`.

**API TSX.**

```tsx
type SectionHeadingProps = {
  index: string;              // "02" — se muestra tal cual
  eyebrow: string;            // etiqueta mono, texto real
  title: ReactNode;           // contenido del H2
  description?: ReactNode;    // párrafo bajo el H2 (cápsula de respuesta si procede)
  as?: "h2" | "h3";           // por defecto "h2"
  align?: "left" | "center";  // por defecto "left"; "center" dibuja la línea desde el centro
  className?: string;
};
export function SectionKicker(props: { index: string; children: string; align?: "left" | "center"; className?: string }): JSX.Element;
```

**Markdown.** Solo TSX. Motivo: necesita número y etiqueta, que un `## H2` de Markdown no tiene; y los H2 del blog ya entran por máscara con `reveal`.

**Técnica CSS.**

- Estructura: `div.motion-heading` (con `view-timeline: --motion-heading block`) > `p.motion-kicker` (`span.motion-kicker-index[aria-hidden]` + `span.motion-kicker-line[aria-hidden]` + `span` etiqueta) + `h2.motion-mask` > `span.motion-mask-inner` + `p.motion-heading-desc`.
- Animaciones, todas sobre `--motion-heading`:

| Elemento | Keyframe | Rango |
|---|---|---|
| número | `motion-rise` (con `--motion-rise: 8px`) | `entry 0% entry 45%` |
| línea | `motion-draw-x`, `transform-origin: left` (`center` si `align="center"`) | `entry 5% entry 55%` |
| etiqueta | `motion-fade` | `entry 10% entry 55%` |
| H2 (`.motion-mask-inner`) | `motion-mask-up` (ya existe) | `entry 15% entry 75%` |
| descripción | `motion-rise` | `entry 25% entry 85%` |

- La regla del H2 sobrescribe solo la línea de tiempo de la máscara dentro del encabezado: `.motion-heading .motion-mask-inner { animation-timeline: --motion-heading; animation-range: entry 15% entry 75%; }`.
- Tokens: `--motion-ease-brand`, `--motion-line`. En `motion.ts`: `EASE_BRAND`, `SCROLL_STAGGER_STEP` (los saltos entre filas de la tabla ≈ 5–10 %).

**Sin soporte / movimiento reducido.** Se ve todo completo: número, línea a ancho completo, etiqueta, H2 y descripción. La línea tiene ancho fijo (`w-8`) en la estructura estática; la animación solo la escala.

**Riesgos.**

- CLS: ninguno; la línea tiene ancho fijo y solo se escala.
- LCP: no aplica (nunca en hero). Si la primera sección tras el hero queda en la primera pantalla, se ve completa (ya está pasada la fase `entry`).
- Accesibilidad: número y línea con `aria-hidden`; la etiqueta es texto real en un `<p>` (no es un encabezado, no altera el índice de la página). El H2 conserva su texto completo en el HTML.
- La máscara recorta descendentes: se mantiene `overflow-clip-margin: 0.2em` de `reveal`.

**Contrato de pruebas.**

- N1: `section-heading.tsx` no tiene `"use client"` ni importa `framer-motion`; número y línea llevan `aria-hidden="true"`; el título se renderiza dentro de `h2` (o `h3` con `as`).
- N1: en `motion.css`, `.motion-kicker-line` solo anima `transform`; la regla con `view-timeline: --motion-heading` existe en `.motion-heading`.
- N1: `install_kit.py` lista `section-heading.tsx` y `index.ts` exporta `SectionHeading` y `SectionKicker`.
- N3: el HTML servido sin JS contiene el número, la etiqueta, el H2 y la descripción como texto.
- N3: CLS = 0 al desplazar la página de arriba abajo.
- N3: con `prefers-reduced-motion: reduce`, `getComputedStyle` de línea y `.motion-mask-inner` da `animation-name: none` y `transform: none`.
- N3 sin soporte (Firefox estable): todo visible; la línea con su ancho completo.
- N3 capturas con el encabezado en 100 % / 60 % / 20 % del alto de la ventana: inicio (nada visible salvo estructura), mitad (línea a medias, H2 subiendo), final (todo en su sitio).
- N3: la línea se dibuja a lo largo de ≥ 80 px de scroll (no salta): se compara su `scaleX` en dos posiciones separadas 40 px y debe ser distinto y estar entre 0 y 1.

**Muestrario.** Lo usan todas las secciones del muestrario (01–07). Se enseña aislado en la sección 01.

---

## 2. `bento`

- **Tipo:** de bloque (nuevo tipo, ver §7). No cuenta como destacada.
- **Componentes:** `Bento` + `BentoItem`.

**Qué hace.** Una rejilla de 2–8 tarjetas que suben escalonadas por columna, sin poner `index` a mano. Variante `rejilla`: tarjetas pegadas con separadores de 1 px (las cuatro razones numeradas de `/ia-onpremise`).

**Cuándo usarla.** Razones, pilares, ventajas, partidas: de 2 a 8 elementos paralelos con título corto y una o dos frases. **Cuándo no:** si hay orden (eso es `pasos`); si son dos opciones enfrentadas (`comparativa`); si cada elemento es solo una etiqueta y un texto (`filas`); si el elemento principal es un número (`cifras`).

**Dosis.** Pieza de bloque: como máximo una por sección H2. No suma en la tabla de destacadas.

**API TSX.**

```tsx
type BentoProps = {
  columns?: 2 | 3 | 4;              // columnas desde 64rem; por defecto 3. Por debajo: 1 (móvil) y 2 (desde 40rem)
  variant?: "cards" | "grid";       // "grid" = rejilla con separadores de 1 px
  numbered?: boolean;               // añade "01", "02"… arriba a la izquierda (aria-hidden)
  className?: string;
  children: ReactNode;              // un <ul> con <BentoItem> (TSX) o el <ul> del Markdown
};
type BentoItemProps = {
  title: ReactNode;                 // texto del título (se renderiza en <h3> o <p> según headingLevel)
  icon?: ReactNode;                 // icono decorativo; el componente le pone aria-hidden
  headingLevel?: "h3" | "p";        // por defecto "h3"
  muted?: boolean;                  // borde discontinuo y sin fondo (la tarjeta "nube" de costes)
  children?: ReactNode;             // descripción
};
// Uso: <Bento columns={4} variant="grid" numbered><ul><BentoItem title="…" icon={<ShieldCheck/>}>…</BentoItem></ul></Bento>
```

**Markdown.**

```markdown
:::bento{columnas=3 numerada}
- **Datos en casa.** Nada sale de tu red.
- **Cumplimiento.** RGPD y AI Act desde el diseño.
- **Coste previsible.** Sin pago por uso.
:::
```

- `columnas` (2, 3 o 4) y `numerada` son los únicos atributos. Otro atributo se ignora.
- La variante `rejilla` es **solo TSX** (ver técnica). En Markdown siempre son tarjetas.
- `remark-motion`: añadir `bento` a `MOTION_CONTAINERS` y pasar `columnas` → `data-columns`, `numerada` → `data-numbered`.

**Técnica CSS.**

- `div.motion-bento[data-columns][data-variant]` > `ul` (rejilla CSS) > `li`.
- Escalonado por columna con `--motion-col`, en tres tramos:
  - base: `--motion-col: 0`.
  - desde 40rem (2 columnas): `li:nth-child(2n)` → 1.
  - desde 64rem: `[data-columns="3"] li:nth-child(3n+2)` → 1, `:nth-child(3n)` → 2; `[data-columns="4"]` → `4n+2` → 1, `4n+3` → 2, `4n` → 3. (`[data-columns="2"]` hereda el tramo de 40rem.)
- Cada `li` usa su propia `view()` (una tarjeta mide > 150 px, así que no salta): `animation: motion-rise; animation-range: entry calc(5% + var(--motion-col) * var(--motion-stagger-step)) entry calc(60% + var(--motion-col) * var(--motion-stagger-step));`.
- **Variante `grid`:** el `ul` tiene fondo `--motion-hairline` y `gap: 1px`; cada `li` tiene fondo opaco `--motion-surface`. **La celda no se anima**: se anima su cuerpo (`li > .motion-bento-body`, que pone `BentoItem`). Si se animara la celda con `opacity: 0`, se vería el fondo del `ul` como un bloque claro antes de que entren las tarjetas (le pasa hoy a `ia-onpremise-reasons`). Por eso `grid` es solo TSX: en Markdown no hay cuerpo envuelto.
- Numeración: el número es un `span[aria-hidden]` que pone `BentoItem` con su posición (contador CSS `counter(motion-bento, decimal-leading-zero)` en Markdown, en un `::before` sin texto accesible).
- Tokens: `--motion-stagger-step`, `--motion-surface`, `--motion-hairline`, `--motion-ease-brand`; `SCROLL_STAGGER_STEP`.

**Sin soporte / movimiento reducido.** Rejilla completa y estática. Separadores visibles.

**Riesgos.**

- CLS: ninguno (solo `transform`/`opacity`; la rejilla reserva su sitio).
- LCP: nunca en hero. Una rejilla en la primera pantalla ya está pasada su fase `entry` y se ve completa.
- Accesibilidad: lista real (`ul > li`), títulos reales; iconos y números `aria-hidden`. Con `headingLevel="h3"`, comprobar que hay un H2 encima (lo da `encabezado-seccion`).
- Hover: el kit no trae efectos de hover; la página puede añadirlos con sus clases.

**Contrato de pruebas.**

- N1: `bento.tsx` sin `"use client"`; iconos y números con `aria-hidden`; `BentoItem` envuelve el contenido en `.motion-bento-body`.
- N1: la variante `grid` no anima el `li` (ninguna regla con `animation` apunta a `.motion-bento[data-variant="grid"] li`), solo `.motion-bento-body`.
- N1: no hay ninguna `index`/`--motion-index` en `bento.tsx` (el escalonado es CSS).
- N2: `:::bento{columnas=3 numerada}` produce `div[data-motion="bento"][data-columns="3"][data-numbered]` con un `ul` de 3 `li`; `:::bento{columnas=9}` o `{color=rojo}` no producen esos atributos y la página no se rompe.
- N2: el instalador lista `bento.tsx`; `--check` informa `missing` si falta y nada si está al día.
- N3: texto de todas las tarjetas presente en el HTML sin JS.
- N3: CLS = 0.
- N3 a 1280 px con 4 columnas: en la misma posición de scroll, la `opacity` de las tarjetas 1→4 es decreciente (escalonado por columna); la tarjeta 5 (fila 2) empieza igual que la 1.
- N3 a 375 px: todas las tarjetas tienen `--motion-col: 0`.
- N3 variante `grid`: en la captura de inicio, el fondo de las celdas es opaco (no se ve el color de separador en el área de las celdas).
- N3 movimiento reducido y sin soporte: todo visible, `transform: none`.
- N3 capturas inicio/mitad/final.

**Muestrario.** Sección 02: las cuatro razones on-premise en variante `grid` numerada, y debajo las cuatro partidas de coste en `cards` con la cuarta `muted`.

---

## 3. `cifras`

- **Tipo:** de bloque. Máximo **una por página** (las cifras pierden fuerza si se repiten).
- **Componentes:** `Figures` + `Figure`.

**Qué hace.** De 2 a 4 cifras clave en fila. El número sube por máscara (como un H2) y su explicación sube detrás. Sin contador que cuente con JavaScript: el número final está siempre en el HTML.

**Cuándo usarla.** Cuando la sección se resume en datos: «0 € en licencias por usuario», «100 % de los datos en tu red», «4 capas». **Cuándo no:** si las cifras no tienen fuente o no son datos propios comprobables (nunca inventar una cifra; pasa por revisión legal si es un claim); si hay más de 4 (usar `filas` o una tabla); si el número no es lo importante (usar `bento`).

**Dosis.** Pieza de bloque, una por página.

**API TSX.**

```tsx
type FiguresProps = { className?: string; children: ReactNode }; // un <dl> con <Figure>
type FigureProps = {
  value: string;          // "0 €", "100 %", "24/7" — texto final, corto (≤ 8 caracteres)
  label: ReactNode;       // explicación, 1 frase
  note?: ReactNode;       // fuente o matiz, pequeño
};
// Uso: <Figures><dl><Figure value="0 €" label="en licencias por usuario" note="Software abierto" /></dl></Figures>
```

- Semántica: `dl > div > dt (label) + dd.motion-figure-value (value) + dd (note)`. En el DOM la explicación va primero (un lector de pantalla lee «en licencias por usuario: 0 €»); visualmente el número va arriba con `order: -1`.

**Markdown.**

```markdown
:::cifras
- **0 €** en licencias por usuario.
- **100 %** de los datos dentro de tu red.
- **4** capas, todas en tu servidor.
:::
```

- La primera negrita de cada elemento es la cifra; el resto, la explicación.
- `remark-motion` transforma la lista: `ul` → `dl`; cada `li` → `div`; la negrita → `dd.motion-figure-value` con `span.motion-mask-inner` dentro (con `data.hName`/`data.hChildren`); el resto → `dt`. Un elemento sin negrita queda como texto normal (sin máscara).

**Técnica CSS.**

- `div.motion-figures` > `dl` (rejilla 1 → 2 → hasta 4 columnas) > `div` con `view-timeline: --motion-figure block` (cada cifra tiene su línea de tiempo: el valor mide ~60 px y por sí solo saltaría).
- Escalonado por columna con `--motion-col`, igual que `bento` (máx. 4).
- Valor: `.motion-figure-value { overflow: clip; overflow-clip-margin: 0.1em; font-variant-numeric: tabular-nums; }` y `.motion-mask-inner` con `motion-mask-up` sobre `--motion-figure`, rango `entry calc(10% + col·step) entry calc(70% + col·step)`.
- Explicación y nota: `motion-rise` con `--motion-rise: 12px`, 10 % después del valor.
- Un filete superior opcional (`border-top: 1px solid --motion-hairline`) estático.
- Tokens: `--motion-stagger-step`, `--motion-ease-brand`, fuente mono de la web (`font-mono`).

**Sin soporte / movimiento reducido.** Cifras completas y estáticas.

**Riesgos.**

- CLS: ninguno; la máscara recorta dentro de su caja.
- SEO/legal: la cifra es texto real (citable por la IA) — por eso no hay contador. El riesgo es de contenido: una cifra sin respaldo. `motion-director` solo puede usar cifras que ya están en el borrador con su fuente.
- Accesibilidad: `dl` con `dt`/`dd`; nada `aria-hidden` (todo es contenido).

**Contrato de pruebas.**

- N1: `figures.tsx` sin `"use client"`, sin `useState`/`useEffect`/`requestAnimationFrame` (no hay contador).
- N1: `.motion-figure-value` declara `overflow: clip` solo dentro del bloque `@supports … no-preference` (sin soporte no recorta nada).
- N2: `:::cifras` con 3 elementos produce `dl > div` ×3, cada uno con `dt` y `dd.motion-figure-value > span.motion-mask-inner`; el texto de la negrita es idéntico al original.
- N2: un elemento sin negrita no rompe la página y no lleva `.motion-figure-value`.
- N3: los valores («0 €», «100 %»…) aparecen en el HTML sin JS y en el `textContent` final son iguales al principio y al final del scroll (no cambian).
- N3: CLS = 0; movimiento reducido: `transform: none`; sin soporte: todo visible.
- N3: el orden de lectura (árbol de accesibilidad) es explicación → valor.
- N3 capturas inicio/mitad/final.

**Muestrario.** Sección 03: tres cifras de la guía on-premise (las que ya estén publicadas con su fuente; si no hay, cifras de ejemplo marcadas como tal y la página fuera del índice).

---

## 4. `filas`

- **Tipo:** de bloque. Como máximo una por sección H2.
- **Componentes:** `Rows` + `Row`.

**Qué hace.** Una lista de 2–6 pares etiqueta + texto (la normativa de `/ia-onpremise`: RGPD, AI Act, España). Cada fila sube y el separador que tiene encima crece de izquierda a derecha.

**Cuándo usarla.** Definiciones, normas, requisitos, preguntas cortas con respuesta de 1–3 frases. **Cuándo no:** si hay orden temporal (`pasos`); si las etiquetas son largas (> 3 palabras) o cada fila necesita título y párrafos (`bento`); para FAQ largas (acordeón propio de la web).

**Dosis.** Pieza de bloque, máx. una por sección H2.

**API TSX.**

```tsx
type RowsProps = { className?: string; children: ReactNode }; // un <dl> con <Row>
type RowProps = { label: ReactNode; children: ReactNode };    // label corto (≤ 3 palabras), texto 1–3 frases
// Uso: <Rows><dl><Row label="RGPD">Los datos personales no salen de la UE.</Row></dl></Rows>
```

**Markdown.**

```markdown
:::filas
- **RGPD.** Los datos personales no salen de tu red.
- **AI Act.** Obligaciones de transparencia según el riesgo.
- **España.** La AESIA supervisa desde 2024.
:::
```

- La primera negrita es la etiqueta (sin el punto final); el resto, el texto.
- `remark-motion`: `ul` → `dl`; `li` → `div`; negrita → `dt`; resto → `dd`. Sin negrita: `dd` solo, la fila sale sin etiqueta.

**Técnica CSS.**

- `div.motion-rows` > `dl` > `div` (rejilla `8.5rem 1fr` desde 40rem; una columna en móvil).
- Cada fila usa su propia `view()` (mide ≥ 60 px). `motion-rise`, rango `entry 5% entry 60%`. El escalonado sale solo del scroll (las filas están una debajo de otra).
- Separador: `div::before` (posición absoluta arriba, 1 px de alto, color `--motion-hairline`, `transform-origin: left`) con `motion-draw-x`, rango `entry 0% entry 45%`: aparece un poco antes que el texto. Primera fila sin separador. El pseudo-elemento usa la línea de tiempo de su fila (como el número de `pasos`).
- Etiqueta en mono y color `--motion-accent`.
- Tokens: `--motion-hairline`, `--motion-accent`, `--motion-ease-brand`.

**Sin soporte / movimiento reducido.** Filas estáticas con separadores completos.

**Riesgos.**

- CLS: ninguno.
- Accesibilidad: `dl`/`dt`/`dd`; el separador es un pseudo-elemento sin contenido (no se lee).
- Markdown: si el texto lleva enlaces o cursivas, todo va dentro de `dd` (por eso la transformación en `remark-motion`, en vez de confiar en la rejilla CSS sobre nodos sueltos).

**Contrato de pruebas.**

- N1: `rows.tsx` sin `"use client"`; el separador es `::before` con `content: ""`; solo anima `transform`.
- N2: `:::filas` con 3 elementos produce `dl` con 3 `div > dt + dd`; un enlace dentro del texto sigue dentro de `dd`; un elemento sin negrita produce solo `dd`.
- N3: texto de etiquetas y filas en el HTML sin JS; CLS = 0.
- N3: en una posición de scroll intermedia, el `scaleX` del separador de una fila es mayor que la `opacity` de su texto llevada a 0–1 (el separador va por delante).
- N3 movimiento reducido: separadores a ancho completo, `transform: none`.
- N3 sin soporte: todo visible.
- N3 capturas inicio/mitad/final.

**Muestrario.** Sección 04: normativa (RGPD, AI Act, España), copiando el contenido de `ia-onpremise-reasons`.

---

## 5. `esquema`

- **Tipo:** destacada. Máximo **dos por página**. **Nunca en hero.**
- **Componente:** `Diagram`.

**Qué hace.** Un esquema de 3–7 nodos unidos por conectores. Los nodos aparecen escalonados y cada conector crece desde su nodo de origen hacia el de destino, siguiendo el orden del recorrido.

**Cuándo usarla.** Para explicar una arquitectura o un flujo que se entiende mejor dibujado: «tu documento → tu servidor → tu equipo», o un núcleo con sus fuentes (el perímetro on-premise). **Cuándo no:** si es una secuencia de pasos con texto largo (`pasos`); si son más de 7 nodos; si los nodos necesitan más de 3 palabras; en la primera pantalla o en el hero (el diagrama del hero de `/ia-privada` se queda estático, como está).

**Dosis.** Destacada: cuenta en la tabla sobria/media/expresiva. Máx. 2 por página.

**API TSX.**

```tsx
type DiagramNode = {
  id: string;
  label: string;              // ≤ 3 palabras, texto real
  sublabel?: string;          // mono, pequeño
  icon?: ReactNode;           // aria-hidden
  x: number; y: number;       // posición en % del escenario (0–100)
  emphasis?: boolean;         // nodo principal (borde y halo de acento)
  order?: number;             // orden de entrada; por defecto, su posición en la lista
};
type DiagramEdge = { from: string; to: string; dashed?: boolean };
type DiagramProps = {
  caption: string;            // obligatorio: describe el esquema en una frase (figcaption)
  nodes: DiagramNode[];       // 3–7
  edges: DiagramEdge[];
  aspect?: "1/1" | "4/3" | "16/9";   // por defecto "4/3"
  showCaption?: boolean;      // por defecto true; false = figcaption solo para lectores (sr-only)
  className?: string;
};
```

**Markdown.** Solo TSX. Motivo: necesita coordenadas y conectores, que no tienen una forma razonable en Markdown; y es una pieza de página de servicio.

**Técnica CSS.**

- `figure.motion-diagram` con `view-timeline: --motion-diagram block` y `aspect-ratio` fijo (reserva el espacio).
- Conectores: un `svg[aria-hidden]` con `viewBox="0 0 100 100"` y `preserveAspectRatio="none"`, una `<line>` por arista con `vector-effect: non-scaling-stroke`. Cada línea crece con `motion-grow` (escala **uniforme** de 0 a 1) con `transform-box: view-box` y `transform-origin: <x1>px <y1>px` (el punto de origen, en unidades del viewBox, puesto en `style` por el componente). Una escala uniforme desde el punto de origen hace crecer la línea en su dirección, sea cual sea el ángulo. Solo `transform`: no se usa `stroke-dashoffset` (decidido).
- Nodos: lista real `ol.motion-diagram-nodes` (o `ul` si el orden no importa) con `li` posicionados en `%` (`left`/`top` estáticos + `translate(-50%, -50%)`), animados con `motion-pop` en un envoltorio interior (para no pisar el `translate` de posición).
- Orden: el componente pone `--motion-step` (0, 1, 2…) en cada nodo según `order`, y en cada arista el `order` de su nodo de origen + 0,5. Rango común: `animation-range: entry calc(10% + var(--motion-step) * 9%) cover calc(30% + var(--motion-step) * 9%)` sobre `--motion-diagram`. Con 7 nodos el último termina hacia `cover 84%`.
- Móvil: el escenario baja a `aspect-ratio: 1/1` y las etiquetas a 11 px; con más de 5 nodos el componente avisa en desarrollo (`console.warn` solo en el servidor) de que conviene revisar la captura de 375 px.
- Tokens: `--motion-line`, `--motion-accent`, `--motion-ease-brand`, `motion-pop`, `motion-grow`.

**Sin soporte / movimiento reducido.** Esquema completo y estático: nodos y conectores dibujados.

**Riesgos.**

- CLS: ninguno (escenario con `aspect-ratio`).
- LCP: un esquema grande podría ser el LCP si estuviera arriba: por eso «nunca en hero ni en la primera pantalla».
- Accesibilidad: `figure` + `figcaption` (texto real); los nodos son una lista leíble con sus etiquetas; conectores e iconos `aria-hidden`.
- Trazo discontinuo: con `non-scaling-stroke` y una escala CSS, el patrón de guiones puede comprimirse durante el crecimiento según el navegador. Se acepta si las capturas lo dan por bueno; si no, las aristas `dashed` entran solo con `motion-fade`.
- Solapes: el kit no puede comprobar que dos etiquetas no se pisen; lo verifica la captura de 375 px del banco.

**Contrato de pruebas.**

- N1: `diagram.tsx` sin `"use client"`; el `svg` tiene `aria-hidden="true"`; no hay `stroke-dashoffset` ni `stroke-dasharray` animados en `motion.css`.
- N1: `caption` es obligatorio en el tipo; `nodes.length` fuera de 3–7 lanza error en compilación del muestrario (test de tipos o aserción en el componente).
- N3: el HTML sin JS contiene el `figcaption` y la etiqueta de cada nodo.
- N3: CLS = 0.
- N3: en una posición intermedia, el nodo con `order` 0 tiene `opacity` mayor que el de `order` 3; la arista que sale del nodo 0 tiene escala > 0 cuando el nodo 0 ya es visible, y la que sale del último nodo vale 0.
- N3: al final del rango, cada `<line>` tiene `getBoundingClientRect` que llega a su nodo destino (±4 px).
- N3 movimiento reducido y sin soporte: todo dibujado, `transform: none`.
- N3 capturas inicio/mitad/final a 1280 y 375 px; a 375 px ninguna etiqueta se solapa con otra (comparación de rectángulos).

**Muestrario.** Sección 05: el perímetro on-premise en radial (núcleo «Tu servidor» + documentos, sistemas, accesos, auditoría; el corte hacia la API pública como arista `dashed`), y debajo un esquema en línea de las cuatro capas (interfaz → orquestación → inferencia → datos).

---

## 6. `orbita`

- **Tipo:** destacada. Máximo **una por página**. **Nunca en el H1, el hero ni la primera pantalla.** Solo con intensidad `media` o `expresiva`.
- **Uso:** pensada para Galileo. El kit es genérico: todos los colores por variables `--motion-orbit-*`.
- **Componente:** `Orbit`.

**Qué hace.** El lenguaje de órbitas de Galileo como sistema solar: un núcleo con halo, 2–3 elipses finas (algunas discontinuas) y nodos sobre ellas. Al llegar a la sección los anillos aparecen y crecen un poco; mientras la sección cruza la pantalla, los nodos avanzan un tramo de su órbita, cada anillo en sentido contrario al anterior. El movimiento va pegado al scroll: si el scroll para, la órbita para. No hay bucle.

**Cuándo usarla.** Para una idea de «todo gira alrededor de X»: el modelo en tu servidor con tus documentos, datos y equipo alrededor. Una vez por página, en la sección que mejor la explica. **Cuándo no:** en hero o primera pantalla; como adorno sin idea detrás; si los nodos son más de 4 con etiqueta; en webs que no son Galileo salvo que su brief lo pida.

**Dosis.** Destacada; cuenta en la tabla. Máx. 1 por página; prohibida con intensidad `sobria`.

**Decisión técnica: rotaciones anidadas con contrarrotación, no `offset-path`.**

| | Rotaciones anidadas | `offset-path` + `offset-distance` |
|---|---|---|
| Regla «solo transform y opacity» | Cumple tal cual | Pide ampliar la regla |
| Elipse adaptable al ancho | Sí: círculos en un plano aplastado con `scaleY` | `ellipse()` sí; `path()` va en px y no escala |
| Etiquetas rectas | Contrarrotación + `scaleY` inverso | `offset-rotate: 0deg`, más simple |
| Animación en el compositor | `transform`: sí | `offset-*`: no garantizado |
| Soporte junto a scroll timelines | El de `transform` (todos) | `offset-path: ellipse()` irregular en Safari |

Se elige **rotaciones anidadas**: cumple la regla sin excepciones, va en el compositor y no depende de soporte desigual. Por eso **no hace falta** cambiar el texto de la regla 1.5 por `offset-path`.

**Geometría (la parte delicada).** Un nodo recorre una elipse si gira en un círculo dentro de un plano aplastado verticalmente. Para que su etiqueta no gire ni se deforme, el nodo deshace las dos cosas:

```
escenario (aspect-ratio 860/460, container-type: inline-size, view-timeline: --motion-orbit block)
├─ svg.motion-orbit-rings [aria-hidden]   ← elipses reales, estáticas (trazo uniforme), entran con motion-ring-in
├─ .motion-orbit-halo                      ← radial-gradient (sin filter: blur), entra con motion-fade
├─ .motion-orbit-core                      ← núcleo: icono + etiqueta, entra con motion-pop
└─ .motion-orbit-plane    transform: scaleY(var(--motion-orbit-squash))          (estático)
   └─ .motion-orbit-spin  --motion-dir: 1 | -1, --motion-sweep: …                (anima motion-orbit-spin)
      └─ .motion-orbit-arm  transform: rotate(a) translateX(calc(r * 1cqi)) rotate(-a)   (estático, tamaño 0, centrado)
         └─ .motion-orbit-node  --motion-unsquash: calc(1 / var(--motion-orbit-squash))  (anima motion-orbit-counter)
            └─ chip o punto con icono
```

- Matriz del nodo: `S · R(θ) · R(a) · T(r) · R(−a) · R(−θ) · S⁻¹`. La parte lineal se cancela (`S·R(θ)·R(−θ)·S⁻¹ = I`): el nodo solo se traslada, a la posición `S·R(θ+a)·(r, 0)`, que está sobre la elipse. La etiqueta queda recta y sin deformar.
- `motion-orbit-spin` y `motion-orbit-counter` usan la **misma** línea de tiempo (`--motion-orbit`), el mismo rango (`cover 0% cover 100%`) y curva `linear`: van sincronizadas por construcción. `linear` porque el giro sigue al dedo; las entradas usan la curva de marca.
- Las elipses se dibujan aparte (SVG estático, sin aplastar) para que el trazo tenga el mismo grosor en toda la vuelta. Los anillos no giran: lo que avanza son los nodos (igual que en `service-orbit`).
- Sentido: anillo exterior `--motion-dir: 1`, medio `-1`, interior `1`. Tramo: exterior 24°, medio 36°, interior 52° (los de dentro van más rápido, como en un sistema solar).
- Ángulos de partida: repartidos por igual en cada anillo (`360° / n`) con un desfase por anillo (el primer nodo exterior empieza en −45°, el medio en +20°, el interior en +65°) para que nada empiece alineado. Radios fijos: 46 / 32 / 19 % del ancho. En escritorio el semieje vertical exterior (46 % × 0,55 ≈ 25 % del ancho ≈ 217 px a 860 px) más medio chip (24 px) supera la mitad del escenario (230 px): el escenario lleva `padding-block: 1.5rem` para que los chips de arriba y abajo no pisen el contenido vecino.
- Entrada: anillos `motion-ring-in` en `entry 0% entry 70%` escalonados 7 % por anillo (de dentro a fuera); núcleo `motion-pop` en `entry 0% entry 50%`; nodos `motion-fade` en `entry 20% entry 80%` (segunda animación del mismo nodo, sobre `opacity`).
- Escritorio (≥ 48rem): `squash 0.55`, chips con icono y etiqueta en el anillo exterior; nodos con icono (sin etiqueta) en el medio; puntos en el interior. Móvil: `squash 0.85` (casi círculos, el escenario pasa a `aspect-ratio: 1/1`), todos los nodos como iconos sin etiqueta y, debajo de la figura, la lista de etiquetas en estático (como hace `service-orbit`).
- Separación comprobada sobre el papel: con `squash 0.55` y 860 px, el hueco vertical entre exterior y medio arriba/abajo es (46 − 32) × 0,55 ≈ 7,7 % ≈ 66 px; chip de 48 px (medio: 24) + nodo de 36 px (medio: 18) = 42 px < 66 px. A 768 px: ≈ 59 px. A 375 px (`squash 0.85`, nodos de 32 px): ≈ 45 px > 32 px. Los cruces en sentido contrario no se pisan porque van en anillos distintos. Lo confirma el banco con capturas.

**API TSX.**

```tsx
type OrbitNode = { label: string; icon?: ReactNode };   // label ≤ 2 palabras
type OrbitProps = {
  caption: string;                          // obligatorio: la idea en una frase (figcaption, texto real)
  core: { label: string; sublabel?: string; icon?: ReactNode };
  outer: OrbitNode[];                       // 1–4, con etiqueta (chips)
  middle?: OrbitNode[];                     // 0–3, solo icono
  inner?: number;                           // 0–2 puntos sin contenido
  dashed?: ("outer" | "middle" | "inner")[];// anillos discontinuos; por defecto ["outer", "inner"]
  showCaption?: boolean;                    // por defecto true
  className?: string;
};
```

- Sin props de ángulos, radios ni velocidades: los fija el kit (`ORBIT` en `motion.ts`) para que no se puedan producir solapes.

**Markdown.** Solo TSX. Motivo: es una pieza de página de servicio, con iconos y estructura que no caben en Markdown, y se limita a una por página.

**Técnica CSS y tokens.** `motion-orbit-spin`, `motion-orbit-counter`, `motion-ring-in`, `motion-pop`, `motion-fade`; variables `--motion-orbit-stroke`, `--motion-orbit-glow`, `--motion-orbit-squash`, `--motion-orbit-sweep-*`; `container-type: inline-size` y unidades `cqi`; `ORBIT` en `motion.ts`. Galileo, en su `globals.css`, no necesita sobrescribir nada (sale de `--primary`), salvo que quiera otro tono para el halo.

**Sin soporte / movimiento reducido.** Imagen estática completa: elipses, halo, núcleo y nodos en sus ángulos de partida (repartidos sin solapes). Es una composición válida por sí sola, como `service-orbit` sin los puntos.

**Riesgos.**

- Regla «una sola entrada, sin bucles»: no hay bucle (no hay `infinite` ni línea de tiempo de documento), pero sí movimiento continuo mientras se hace scroll. Necesita una aclaración explícita en la regla 1.4 (texto en §7).
- CLS: ninguno (escenario con `aspect-ratio`, todo `transform`).
- LCP: nunca en primera pantalla.
- Rendimiento: ~10–15 elementos animados en el compositor. Sin `filter: blur` (el halo de `service-orbit` usa `blur-[90px]`; aquí `radial-gradient`, más barato).
- Nitidez: la escala neta del texto es 1, pero algún navegador podría rasterizar a escala intermedia durante el giro. Se comprueba en capturas (nitidez de la etiqueta del chip).
- Accesibilidad: el escenario visual es `aria-hidden`; el significado va en el `figcaption` (texto real y obligatorio) y en el texto de la sección. La lista móvil también es `aria-hidden` (repite lo que dice el `figcaption`).
- Vestibular: el giro es de 24–52° en toda la sección, lento y ligado al scroll. Con movimiento reducido no hay nada.

**Contrato de pruebas.**

- N1: `orbit.tsx` sin `"use client"`, sin `framer-motion`, sin `<animateMotion>`, sin `requestAnimationFrame`.
- N1: en `motion.css`, ninguna regla de `.motion-orbit*` tiene `animation-iteration-count: infinite` ni `animation-duration` en segundos (todas usan `animation-timeline`).
- N1: `motion-orbit-spin` y `motion-orbit-counter` declaran el mismo `animation-timeline`, `animation-range` y `animation-timing-function`.
- N1: el escenario tiene `aria-hidden="true"` y el `figcaption` existe; `caption` es obligatorio en el tipo; `outer.length` entre 1 y 4.
- N1: ningún color literal (`#…`, `rgb(…)`) en `orbit.tsx` ni en las reglas `.motion-orbit*`.
- N3: el HTML sin JS contiene el `figcaption`, la etiqueta del núcleo y las de los nodos.
- N3: `document.getAnimations()` filtrado a `.motion-orbit*`: todas tienen `timeline` de tipo `ViewTimeline` (ninguna `DocumentTimeline`).
- N3 «si el scroll para, se para»: dos capturas del escenario separadas 1 s sin hacer scroll son idénticas píxel a píxel.
- N3 «avanza con el scroll»: entre inicio y final del cruce, el ángulo de un nodo exterior respecto al centro cambia ≈ +24° (±3°) y el de un nodo medio ≈ −36° (sentido contrario).
- N3 «etiquetas rectas»: el `getBoundingClientRect` de un chip tiene el mismo ancho y alto (±1 px) al inicio, a la mitad y al final.
- N3 «sobre la elipse»: el centro de cada nodo cumple `(dx/rx)² + (dy/ry)² ≈ 1` (±0,05) en las tres posiciones.
- N3: CLS = 0.
- N3 movimiento reducido: ninguna animación activa; los nodos en sus ángulos de partida.
- N3 sin soporte (Firefox estable): composición estática completa.
- N3 capturas inicio/mitad/final a 1280, 768 y 375 px; ningún chip se solapa con otro nodo en ninguna de ellas.
- N3 (regla de página): en el muestrario, la órbita no está en el primer viewport a 1280×800 ni a 375×800.

**Muestrario.** Sección 06, la pieza estrella: núcleo «Tu servidor» (sublabel «Modelo propio», icono de CPU); exterior: Documentos, Datos, Equipo; medio: iconos de llave (accesos) y registro (auditoría); interior: 2 puntos. `caption`: «Tu modelo funciona en tu servidor; tus documentos, tus datos y tu equipo giran a su alrededor sin salir de tu red.»

---

## 7. Cambios propuestos a reglas y catálogo (texto exacto)

### `motion-rules.md`

**Regla 1.4** — sustituir por:

> 4. **Una sola entrada:** cada elemento entra una vez y se queda. No hay bucles infinitos ni animaciones con reloj (`animation-duration` en segundos sin `animation-timeline`). **Excepción única: `orbita`.** Sus nodos avanzan un tramo fijo de su órbita mientras la sección cruza la pantalla. El avance va ligado al scroll: si el scroll para, la órbita para, y al volver atrás retrocede. No es un bucle.

**Regla 1.5** — sustituir por:

> 5. **Propiedades:** solo `transform` y `opacity`. Nunca `width`, `height`, `top`, `left`, `margin`, `clip-path`, `filter` ni `stroke-dashoffset`. Los conectores y las líneas crecen con `scale` dentro de `transform`.

**Nueva regla 2.9** (tras la 2.8):

> 9. **Elementos pequeños:** con `view()`, la animación dura lo que mide el elemento. Un elemento de menos de ~40 px de alto (una línea, una etiqueta, un número) no usa `view()` propio: usa la línea de tiempo con nombre de su contenedor (`view-timeline: --motion-<pieza> block`). Así no salta de golpe.

**Nueva regla 2.10:**

> 10. **Figuras con texto:** `esquema` y `orbita` llevan un `figcaption` con texto real que dice lo mismo que el dibujo. Las partes decorativas (líneas, anillos, iconos, números de orden) llevan `aria-hidden`.

**Sección 3, reglas de dosis** — sustituir las reglas 1–3 y la tabla por:

> 1. **Por defecto:** todos los H2 entran por máscara y los H3 y las citas suben (`reveal`). En páginas de servicio, cada sección numerada abre con `encabezado-seccion`. Lo aplica el kit; la skill no lo decide.
> 2. **Piezas de bloque** (`bento`, `cifras`, `filas`): como máximo **una por sección H2**. No cuentan como destacadas. `cifras`, como máximo **una por página**.
> 3. **Piezas destacadas** (`pasos`, `comparativa`, `cita-destacada`, `esquema`, `orbita`): como máximo **una cada 2–3 secciones H2**.
> 4. **Límites por página:** `cita-destacada` y `orbita`, una; `esquema`, dos.
> 5. **Nunca en la primera pantalla:** `esquema` y `orbita` no van en el hero ni en la primera sección visible al cargar.

(las actuales 4 y 5 pasan a ser 6 y 7)

> | Intensidad | Piezas destacadas por página | `orbita` |
> |---|---|---|
> | `sobria` | 0–2 | No |
> | `media` | 2–4 | Máx. 1 |
> | `expresiva` | 3–6 (sigue la regla de una cada 2–3 H2) | Máx. 1 |

### `motion-catalog.md`

**Tabla de resumen** — sustituir por:

> | Pieza | Tipo | Cuándo usarla | Componente | Sintaxis en Markdown |
> |---|---|---|---|---|
> | `reveal` | Automática | Siempre. H2 por máscara; H3 y citas suben. | `Reveal` | Ninguna: la aplica el blog |
> | `encabezado-seccion` | Automática | Cada sección numerada de una página de servicio. | `SectionHeading` | Solo TSX |
> | `bento` | De bloque | 2–8 elementos paralelos con título y frase. | `Bento` + `BentoItem` | `:::bento{columnas=3}` + lista |
> | `cifras` | De bloque | 2–4 datos clave con fuente. Máximo una. | `Figures` + `Figure` | `:::cifras` + lista |
> | `filas` | De bloque | 2–6 pares etiqueta + texto corto. | `Rows` + `Row` | `:::filas` + lista |
> | `pasos` | Destacada | Un proceso de 3–6 pasos en orden. | `Steps` | `:::pasos` + lista numerada |
> | `comparativa` | Destacada | Dos opciones frente a frente (A frente a B). | `Comparison` + `ComparisonColumn` | `::::comparativa` + dos `:::columna[Título]` |
> | `cita-destacada` | Destacada | La frase clave de la página. Máximo una. | `PullQuote` | `:::cita-destacada` |
> | `esquema` | Destacada | Arquitectura o flujo de 3–7 nodos. Máximo dos. | `Diagram` | Solo TSX |
> | `orbita` | Destacada | Una idea «todo gira alrededor de X». Máximo una; no en `sobria`. | `Orbit` | Solo TSX |

**Sección `reveal`, punto «Grupos escalonados»** — añadir al final:

> Para rejillas de tarjetas, usa `bento`: escalona solo, sin `index`.

**Secciones nuevas.** Una por pieza, con el mismo formato que las actuales (Qué hace · Contenido válido · Markdown · TSX · No usar en). El contenido sale de las fichas 1–6 de esta propuesta: «Qué hace» = primer párrafo; «Contenido válido» = límites de la API (número de elementos y longitud de etiquetas); «Markdown» y «TSX» = los ejemplos de cada ficha.

**«Añadir una pieza nueva», paso 2** — sustituir por:

> 2. Si tiene sintaxis Markdown, añade su nombre a `MOTION_CONTAINERS` en `kit/lib/remark-motion.ts`, y sus atributos admitidos a la lista blanca de atributos. Añade también el caso al renderizador `div` del blog de cada web (ver «Conectar el blog a mano» en `README.md`).

**«Añadir una pieza nueva», pasos nuevos tras el 3:**

> 4. Añade el componente a `FILES` en `kit/install_kit.py`, a `kit/components/index.ts` y su clase a la regla `.overflow-x-hidden:has(…)` de `motion.css`.
> 5. Escribe su contrato en el banco de pruebas (`evals/sau/motion/`) y pásalo antes de añadirla al catálogo.

(los actuales 4 y 5 pasan a ser 6 y 7)

### Otros archivos que cambian al construir (sin texto aquí)

- `SKILL.md`, paso 2 (inventario): añadir candidatas `bento`, `cifras`, `filas`, `esquema`, `orbita`; paso 1: añadir `SectionHeading` y `Diagram`/`Orbit` a la lista de componentes de servicio.
- `README.md`, «Conectar el blog a mano»: el renderizador `div` devuelve también `Bento`, `Figures` y `Rows`.
- `templates/motion-plan.html.template`: no lista piezas; no cambia.

---

## 8. Orden de construcción recomendado

Cada paso es un PR pequeño a la rama del kit, y solo entra si pasa su contrato en el banco.

1. **Base común:** keyframes, variables `--motion-*`, tokens de `motion.ts`, ampliación de `:has()`, lista blanca de atributos en `remark-motion`. Sin piezas nuevas visibles; el banco comprueba que las 4 piezas actuales siguen igual.
2. **`encabezado-seccion`:** la más pequeña; estrena la línea de tiempo con nombre y `motion-draw-x`. Sirve de inmediato a todas las secciones del muestrario.
3. **`filas`:** reutiliza `motion-draw-x`; estrena la transformación lista → `dl` en `remark-motion`.
4. **`bento`:** estrena el escalonado por columna (`--motion-col`), que reutiliza `cifras`.
5. **`cifras`:** reutiliza escalonado y máscara; añade `hChildren` en `remark-motion`.
6. **`esquema`:** estrena SVG con escala desde un punto; la geometría más sencilla de las dos figuras.
7. **`orbita`:** la más compleja; necesita los cambios de reglas 1.4 y 2.10 aprobados y el muestrario montado para validar con capturas.
8. **Reglas y catálogo:** el texto de §7 entra pieza a pieza (regla 4.2: primero kit, luego catálogo), no todo de golpe.
9. **Muestrario de Galileo** (en galileo-studio-web, rama desde `dev`): una página fuera del índice (`noindex`, fuera del sitemap), p. ej. `/[locale]/motion`, con secciones 01–07: 01 `encabezado-seccion`, 02 `bento`, 03 `cifras`, 04 `filas`, 05 `esquema`, 06 `orbita`, 07 las piezas actuales (`pasos`, `comparativa`, `cita-destacada`). Se monta junto con el paso 2 y crece con cada pieza; el banco puede usarla como página de nivel 3. Migrar `/ia-privada` y `/ia-onpremise` a las piezas del kit es una tarea aparte.

## 9. Preguntas abiertas para Pelayo

1. ¿Te vale el nuevo tipo **«de bloque»** (bento, cifras, filas no cuentan como destacadas)? Si cuentan, una página como `/ia-onpremise` se pasaría de dosis en casi todas las secciones.
2. ¿`orbita` prohibida con intensidad `sobria`, o la dejamos a juicio de la skill?
3. ¿Dónde vive el muestrario: página interna `noindex` en galileo-studio-web (propuesta) u otra ruta?
4. `cifras`: ¿hay cifras publicadas y con fuente de la guía on-premise para el muestrario, o usamos cifras de ejemplo en una página fuera del índice?
