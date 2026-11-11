# Catálogo de piezas de movimiento

Lista cerrada. `motion-director` solo asigna piezas de la tabla «Resumen».
Cada pieza existe en `kit/components/` y se instala en `src/components/motion/`.
Piezas de bloque (`bento`, `cifras`, `filas`): una por sección H2 y **seis por página como máximo**, en cualquier intensidad (`motion-rules.md`, sección 3). `orbita`: solo Galileo y nunca en intensidad sobria.

Reglas de uso: `motion-rules.md`.

## Resumen

| Pieza | Tipo | Cuándo usarla | Componente | Sintaxis en Markdown |
|---|---|---|---|---|
| `reveal` | Automática | Siempre. H2 por máscara; H3 y citas suben. | `Reveal` | Ninguna: la aplica el blog |
| `pasos` | Destacada | Un proceso de 3–6 pasos en orden. | `Steps` | `:::pasos` + lista numerada |
| `comparativa` | Destacada | Dos opciones frente a frente (A frente a B). | `Comparison` + `ComparisonColumn` | `::::comparativa` + dos `:::columna[Título]` |
| `cita-destacada` | Destacada | La frase clave de la página. Máximo una. | `PullQuote` | `:::cita-destacada` |
| `encabezado-seccion` | Automática | Cada sección numerada de una página de servicio. | `SectionHeading` + `SectionKicker` | Solo TSX |
| `bento` | De bloque | 2–8 elementos paralelos con título y frase. | `Bento` + `BentoItem` | `:::bento{columnas=3}` + lista |
| `cifras` | De bloque | 2–4 datos clave con fuente. Máximo una. | `Figures` + `Figure` | `:::cifras` + lista |
| `filas` | De bloque | 2–6 pares etiqueta + texto corto. | `Rows` + `Row` | `:::filas` + lista |
| `esquema` | Destacada | Arquitectura o flujo de 3–7 nodos. Máximo dos. | `Diagram` | Solo TSX |
| `orbita` | Destacada | Una idea «todo gira alrededor de X». Máximo una; no en `sobria`. | `Orbit` | Solo TSX |

## `reveal` (automática)

- **Qué hace:** los H2 suben recortados por una máscara. Los H3 y las citas (`>`) suben y aparecen.
- **Blog:** no requiere marcas. El kit lo aplica a todos los posts.
- **Páginas de servicio:** envolver títulos de sección con `<Reveal as="h2" variant="mask">`. Bloques con `<Reveal>`.
- **Grupos escalonados:** en una fila de tarjetas, `<Reveal index={i}>` en cada tarjeta (0, 1, 2…). Cada una entra un poco después que la anterior. Máximo útil: 5. Es parte de `reveal`: no cuenta como pieza destacada.
- **No usar en:** el H1, la cabecera (hero) ni el elemento LCP.

## `pasos`

- **Qué hace:** numera cada paso, lo hace entrar uno a uno y traza la línea que los une.
- **Contenido válido:** una lista numerada de 3 a 6 elementos. Cada elemento empieza con el nombre del paso en negrita.
- **Markdown:**

```markdown
:::pasos
1. **Diagnóstico.** Revisamos procesos y datos.
2. **Prototipo.** Construimos sobre tus datos.
3. **Despliegue.** Lo integramos en tu equipo.
:::
```

- **TSX:** `<Steps><ol><li>…</li></ol></Steps>`

## `comparativa`

- **Qué hace:** dos columnas que entran por turno. La columna `{destacada}` lleva el color de acento.
- **Contenido válido:** exactamente dos columnas, con título corto y una lista breve.
- **No sustituye a la tabla:** si la comparación tiene más de 2 opciones o más de 4 criterios, usar una tabla.
- **Markdown** (el bloque exterior lleva 4 dos puntos):

```markdown
::::comparativa
:::columna[Software genérico]
- Rápido de empezar.
- No conoce tus documentos.
:::
:::columna[Solución a medida]{destacada}
- Construida sobre tus datos.
- Datos bajo tu control.
:::
::::
```

- **TSX:** `<Comparison><ComparisonColumn title="…">…</ComparisonColumn><ComparisonColumn title="…" highlight>…</ComparisonColumn></Comparison>`

## `cita-destacada`

- **Qué hace:** muestra una frase grande que sube al entrar en pantalla.
- **Contenido válido:** una frase propia de la página, de 8 a 20 palabras. Nunca una cita de un tercero sin fuente.
- **Máximo:** una por página.
- **Markdown:**

```markdown
:::cita-destacada
Una buena solución empieza en tus propios datos.
:::
```

- **TSX:** `<PullQuote><p>…</p></PullQuote>`

## Comportamiento con errores

- **Bloque `:::` desconocido:** el contenido se muestra sin movimiento. La página no se rompe.
- **Directivas de texto** (`:algo`, `::algo`): no se usan. El kit las devuelve a texto normal. Así "Nota:importante" no desaparece.

## Añadir una pieza nueva

1. Crea el componente en `kit/components/` y sus estilos en `kit/styles/motion.css`.
2. Si tiene sintaxis Markdown, añade su nombre a `MOTION_CONTAINERS` en `kit/lib/remark-motion.ts`, y sus atributos admitidos a la lista blanca de atributos. Añade también el caso al renderizador `div` del blog de cada web (ver «Conectar el blog a mano» en `README.md`).
3. Cumple `motion-rules.md`: solo `transform` y `opacity`, CSS de scroll, movimiento reducido.
4. Añade el componente a `FILES` en `kit/install_kit.py`, a `kit/components/index.ts` y su clase a la regla `.overflow-x-hidden:has(…)` de `motion.css`.
5. Escribe su contrato en el banco de pruebas (`evals/sau/motion/`) y pásalo antes de añadirla al catálogo.
6. Añade la pieza a la tabla «Resumen» de este catálogo, con su sección, solo cuando Pelayo haya dado el OK a sus capturas.
7. Ejecuta `<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/motion-director/kit/install_kit.py --root <code_repo_path>` y los `checks` del perfil (por ejemplo, la compilación de la web).
8. Registra la pieza en el banco de pruebas (`evals/sau/motion/LEEME.md`, «Registrar una pieza nueva»): entrada en `piezas.json`, fixture Markdown y sección en el muestrario.
9. Ejecuta `evals/sau/motion/run.sh --nivel todo` y debe salir en verde; la pieza entra en «Resumen» solo después, con el OK de Pelayo a las capturas (`evals/sau/motion/capturas/`).

## Fichas de las piezas de bloque y destacadas añadidas en 2026-11

Fichas de `encabezado-seccion`, `filas`, `bento`, `cifras`, `esquema` y `orbita` (aprobadas por Pelayo, GAL-1904).

## `encabezado-seccion` (automática)

- **Qué hace:** abre una sección con número mono («02»), una línea fina que se dibuja de izquierda a derecha, la etiqueta en mono, el H2 que sube por máscara y una descripción que sube después.
- **Contenido válido:** número de sección, una etiqueta corta en texto real, el H2 y, si hace falta, un párrafo de descripción (la cápsula de respuesta). Una por sección H2 numerada; no cuenta en la dosis.
- **Markdown:** no tiene. Solo TSX: necesita número y etiqueta, que un `## H2` no tiene, y los H2 del blog ya entran por máscara con `reveal`.
- **TSX:** `<SectionHeading index="02" eyebrow="Por qué" title="…" description="…" />`. `SectionKicker` sirve para una etiqueta suelta (se ve estática).
- **No usar en:** el hero (allí va el H1, que nunca se anima), el blog ni secciones sin H2.

## `filas` (de bloque)

- **Qué hace:** una lista de 2–6 pares etiqueta + texto (como la normativa de `/ia-onpremise`: RGPD, AI Act, España). Cada fila sube y el separador que tiene encima crece de izquierda a derecha.
- **Contenido válido:** de 2 a 6 filas. Etiqueta de hasta 3 palabras; texto de 1 a 3 frases. Como máximo una por sección H2 (y cuenta para el tope de seis piezas de bloque por página).
- **No usar si:** hay orden temporal (`pasos`), las etiquetas son largas o cada fila necesita título y párrafos (`bento`), o son FAQ largas.
- **Markdown** (la primera negrita es la etiqueta, sin el punto final; el resto, el texto):

```markdown
:::filas
- **RGPD.** Los datos personales no salen de tu red.
- **AI Act.** Obligaciones de transparencia según el riesgo.
- **España.** La AESIA supervisa desde 2024.
:::
```

- **TSX:** `<Rows><dl><Row label="RGPD">Los datos personales no salen de la UE.</Row></dl></Rows>`

## `bento` (de bloque)

- **Qué hace:** una rejilla de 2–8 tarjetas que suben escalonadas por columna, sin poner `index` a mano. Variante `grid` (solo TSX): tarjetas pegadas con separadores de 1 px, como las cuatro razones numeradas de `/ia-onpremise`.
- **Contenido válido:** de 2 a 8 elementos paralelos, cada uno con un título corto y una o dos frases. Como máximo una por sección H2 (y cuenta para el tope de seis piezas de bloque por página).
- **No usar si:** hay orden (`pasos`), son dos opciones enfrentadas (`comparativa`), cada elemento es solo etiqueta y texto (`filas`) o lo principal es un número (`cifras`).
- **Columnas según el contenedor:** 4 columnas solo si el bento mide 60rem o más (si no, 2 × 2); 3 desde 48rem. En Markdown, el título de cada tarjeta (la primera negrita) pierde el punto final.
- **Markdown** (`columnas` = 2, 3 o 4 y `numerada` son los únicos atributos; en Markdown siempre son tarjetas):

```markdown
:::bento{columnas=3 numerada}
- **Datos en casa.** Nada sale de tu red.
- **Cumplimiento.** RGPD y AI Act desde el diseño.
- **Coste previsible.** Sin pago por uso.
:::
```

- **TSX:** `<Bento columns={4} variant="grid" numbered><ul><BentoItem title="…" icon={<ShieldCheck />}>…</BentoItem></ul></Bento>`

## `cifras` (de bloque)

- **Qué hace:** de 2 a 4 cifras clave en fila. El número sube por máscara (como un H2) y su explicación sube detrás. Sin contador: el número final está siempre en el HTML.
- **Contenido válido:** de 2 a 4 cifras que **ya están en el borrador con su fuente** (nunca se inventa una cifra; si es un claim, pasa por revisión legal). Valor corto (hasta 8 caracteres) y explicación de una frase. Como máximo **una por página** (y cuenta para el tope de seis piezas de bloque por página).
- **No usar si:** las cifras no tienen fuente, hay más de 4 (usar `filas` o una tabla) o el número no es lo importante (`bento`).
- **Unidad:** lo que va tras el último espacio de la cifra («GB», «%») sale más pequeño y en color de acento, con espacio fino sin salto. La cifra va en la fuente del texto (no en mono).
- **Markdown** (la primera negrita de cada elemento es la cifra; el resto, la explicación). Ejemplo con cifras publicadas en `/ia-onpremise` de Galileo:

```markdown
:::cifras
- **4** capas, todas dentro de tu infraestructura.
- **16–24 GB** de memoria de GPU suelen bastar para un primer caso de uso.
- **4 %** del volumen de negocio anual global (o 20 millones de euros, si es mayor): multa máxima del RGPD.
:::
```

- **TSX:** `<Figures><dl><Figure value="4" label="capas, todas dentro de tu infraestructura" note="Fuente: …" /></dl></Figures>`

## `esquema` (destacada)

- **Qué hace:** un esquema de 3–7 nodos unidos por conectores, en el lenguaje del perímetro de `/ia-onpremise` (tiles, cable que se apaga). Cada conector crece desde su nodo de origen y el nodo destino aparece cuando la línea lleva unos dos tercios: la línea «lleva» al nodo. Las conexiones cortadas (`cut`) llevan marca de corte (con perímetro, por defecto en el punto donde cruzan su borde: la frontera corta la conexión) y entran las últimas, con un fundido. En `stage`, ya dibujado, lleva un **flujo continuo y sutil** (excepción acotada de la regla 1.4): puntos de acento que viajan por cada cable hacia el nodo principal (`emphasis`), escalonados, y una petición que sale por la conexión cortada y se apaga en la marca de corte. Solo `transform` y `opacity`; nada con movimiento reducido. El escenario nunca es más alto que la pantalla menos la cabecera fija, y deja hueco arriba para el nodo de y ≈ 0.
- **Dos disposiciones:** `layout="stage"` (por defecto), nodos en (x, y) sobre un escenario, con `perimeter` opcional (rectángulo discontinuo con etiqueta) y nodos `outside`; `layout="row"`, capas o pasos en fila unidos en orden, con el alto del contenido (en móvil, en columna).
- **Contenido válido:** de 3 a 7 nodos con etiquetas de hasta 3 palabras, y un `caption` obligatorio que dice en una frase lo mismo que el dibujo. Como máximo **dos por página**.
- **No usar si:** es una secuencia de pasos con texto largo (`pasos`), hay más de 7 nodos o los nodos necesitan más de 3 palabras.
- **Markdown:** no tiene. Solo TSX: necesita coordenadas y conectores.
- **TSX:** `<Diagram caption="…" perimeter={{ label: "Tu red" }} nodes={[{ id: "srv", label: "Tu servidor", x: 42, y: 50, emphasis: true }, { id: "api", label: "API pública", x: 90, y: 5, outside: true }, …]} edges={[{ from: "srv", to: "doc" }, { from: "srv", to: "api", cut: true }]} />` · en fila: `<Diagram layout="row" caption="…" nodes={[{ id: "ui", label: "Interfaz", sublabel: "Open WebUI" }, …]} />`
- **No usar en:** el hero ni la primera pantalla.

## `orbita` (destacada)

- **Qué hace:** el lenguaje de órbitas de Galileo como sistema solar: un núcleo con halo, 2–3 elipses finas (algunas discontinuas) y nodos sobre ellas. Al llegar a la sección los anillos aparecen y crecen un poco; mientras la sección cruza la pantalla, los nodos avanzan un tramo de su órbita, cada anillo en sentido contrario al anterior. Va pegado al scroll: si el scroll para, la órbita para. No hay bucle.
- **Contenido válido:** un núcleo con etiqueta; de 1 a 4 nodos exteriores con etiqueta de hasta 2 palabras; hasta 3 nodos medios (solo icono) y 2 puntos interiores; un `caption` obligatorio con la idea en una frase. Como máximo **una por página**, solo con intensidad `media` o `expresiva`.
- **No usar si:** es un adorno sin idea detrás, hay más de 4 nodos con etiqueta o la web no es Galileo (salvo que su brief lo pida).
- **Markdown:** no tiene. Solo TSX.
- **TSX:** `<Orbit caption="…" core={{ label: "Tu servidor", sublabel: "Modelo propio", icon: <Cpu /> }} outer={[{ label: "Documentos", icon: <FileText /> }, …]} middle={[{ label: "Accesos", icon: <KeyRound /> }]} inner={2} />`
- **No usar en:** el H1, el hero ni la primera pantalla.

