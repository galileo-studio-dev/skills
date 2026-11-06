---
name: motion-director
description: "Añade motion design a una página de contenido de SAU. Lee draft.md, asigna piezas del catálogo de movimiento a cada sección y deja el plan en 02b-motion-plan.html. Paso 2b de la secuencia SEO, entre seo-content-writer y onpage-optimizer. Úsala también para animar un post o una página ya publicada, instalar o comprobar el kit de movimiento en la web, o cuando el usuario pida animaciones o motion design en una página."
metadata:
  internal: true
---

# Motion Director

> **Antes de nada:** lee el perfil `.sau/site.json` (ver `running-sau`): de él salen `brief`, `output_dir`, `locale`, `code_repo_path` y el resto de rutas. El instalador del kit se invoca como `${CLAUDE_PLUGIN_ROOT}/skills/motion-director/kit/install_kit.py` con el intérprete `py` o `python3` (el que exista).

Paso 2b de la secuencia. Decide **qué se mueve y dónde**. No escribe animaciones nuevas:
elige piezas de un catálogo cerrado que ya existe en el kit.

**Principio:** el movimiento acompaña al contenido. Nunca tapa el texto que la IA cita,
nunca retrasa el LCP y nunca rompe la página si falla.

## Antes de empezar

Lee estos archivos.

De esta skill (`${CLAUDE_PLUGIN_ROOT}/skills/motion-director/`):

1. `motion-rules.md` — reglas de marca, de SEO y de dosis. Son obligatorias.
2. `motion-catalog.md` — las únicas piezas que puedes usar.
   - Solo las de la tabla «Resumen». Las de «En prueba» (pendientes del OK de Pelayo) no se asignan ni se proponen, aunque `motion-rules.md` ya las nombre.

Del sitio (según el perfil):

3. El brief (ruta `brief` del perfil) — sección "Movimiento": intensidad y páginas sin animación.
   - Si la sección no existe, usa la intensidad `sobria`. Anótalo en el plan.
4. `draft.md` de la unidad (modo page: `<output_dir>/<slug>/draft.md`; modo tanda: `<output_dir>/tanda-<AAAA-MM-DD>/<slug>/draft.md`), u otro Markdown que indique el usuario.
   - Si no hay borrador, pide la ruta. No escribas contenido: eso es `seo-content-writer`.

Si la página aparece en el brief como "sin animación", no asignes piezas destacadas. Entrega el plan con esa decisión.

## Proceso

### Paso 1 — Tipo de página

Lee `page_type` del frontmatter de `draft.md`:

- `blog` / informativa → las piezas van como bloques `:::` dentro del Markdown.
- `service` / `product` → las piezas van como componentes React (`Steps`, `Comparison`, `PullQuote`, `Reveal`). El Markdown no lleva bloques `:::`.

### Paso 2 — Inventario de secciones

Lista cada H2 con su contenido. Para cada uno, anota si contiene:

- Un proceso en orden de 3 a 6 pasos → candidata a `pasos`.
- Dos opciones frente a frente → candidata a `comparativa`.
- La frase que resume la página → candidata a `cita-destacada`.
- Nada de lo anterior → `ninguna` (solo el `reveal` automático).

### Paso 3 — Asignar piezas

Aplica las reglas de dosis de `motion-rules.md`:

- Máximo una pieza destacada cada 2–3 secciones H2.
- Máximo una `cita-destacada` por página.
- Respeta el rango de piezas de la intensidad del brief.
- Si dos secciones compiten, elige la que más ayuda a entender el contenido.

**Regla de la cápsula de respuesta.** Las dos primeras frases bajo cada H2 son la cápsula
que la IA extrae. La cápsula queda **siempre** como párrafo normal, justo después del H2.
Una pieza nunca envuelve la cápsula. Va después.

### Paso 4 — Marcar el borrador

Cambia solo el marcado. **Nunca cambies el texto, los enlaces ni el orden de las secciones.**

1. Añade el bloque `motion:` al frontmatter de `draft.md`:

```yaml
motion:
  intensity: sobria          # sobria | media | expresiva (del brief)
  pieces:
    - section: "¿Cómo se implanta el servicio?"
      piece: pasos
    - section: "¿Software genérico o solución a medida?"
      piece: comparativa
  video: ninguno             # ninguno | propuesta
```

2. **Blog:** envuelve el contenido elegido con la sintaxis exacta de `motion-catalog.md`.
   - `pasos` exige una lista numerada. Si el texto es un párrafo con pasos, conviértelo en lista sin cambiar las palabras.
   - `comparativa` exige dos columnas. Si el texto no se divide limpio en dos, no uses la pieza.
   - `cita-destacada` repite una frase que ya está en la página. No escribas frases nuevas.
3. **Servicio:** no añadas `:::`. Indica en el plan el componente de cada sección.

### Paso 5 — Vídeo (solo páginas de servicio, opcional)

Si la página es de servicio y el brief no lo prohíbe, puedes proponer un vídeo:

- Tipología de las plantillas de vídeo (motion graphics) del equipo, si las hay, por ejemplo `problema-solucion` o `caso-de-uso`.
- Dónde iría en la página. **Nunca en la cabecera:** el vídeo no puede ser el elemento LCP.
- Schema `VideoObject` recomendado.

Solo es una propuesta en el plan (`video: propuesta`). No generes el vídeo.

### Paso 6 — Llevar la página a la web (solo si el usuario lo pide)

Este paso cambia código. Hazlo solo cuando el usuario pida publicar o llevar la página al código.

Si el perfil tiene `motion: plan-only`, **no instales el kit**: deja el plan y la adaptación del código va por un cambio normal y revisado. El resto de este paso es para `motion: install-kit`.

1. Trabaja en una rama nueva desde `base_branch` del perfil (con el prefijo `branch_prefix`), en el checkout `code_repo_path`. **Nunca** empujes a `production_branch`.
2. Comprueba el kit: `<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/motion-director/kit/install_kit.py --root <code_repo_path> --check`.
3. Si falta algo, instálalo: `<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/motion-director/kit/install_kit.py --root <code_repo_path>`. Si el sitio tiene blog con Markdown propio, pasa también `--blog-file <ruta del componente que renderiza el Markdown, relativa al checkout>`. Si el instalador dice que el blog no está conectado, sigue la sección "Conectar el blog a mano" del `README.md` de esta skill.
4. Blog: copia `draft.md` (sin el bloque `motion:` del frontmatter, que no usa el blog) al directorio de contenido del blog del código (uno de `tanda.content_dirs` del perfil, o el que use el sitio).
5. Servicio: usa los componentes indicados en el plan dentro de las secciones de la página.
6. Ejecuta los `checks` del perfil, en orden. Si alguno falla, no abras el pull request.
7. Abre un pull request hacia `base_branch`. El push y el pull request pasan por el OK de la persona (los gestiona `running-sau`).

## Output

**`draft.md`** — el mismo borrador, con el bloque `motion:` y, en blog, los bloques `:::`.

**`02b-motion-plan.html`** (junto a `draft.md`) — rellena `${CLAUDE_PLUGIN_ROOT}/skills/motion-director/templates/motion-plan.html.template` a mano.
Una fila por H2, con la pieza asignada (o `ninguna`) y el motivo.

**Puntuación sobre 5.** Un punto por cada control. Informa de cada uno con honestidad:

1. Todas las piezas pertenecen a `motion-catalog.md`
2. La dosis cumple `motion-rules.md` y la intensidad del brief
3. Ninguna pieza envuelve una cápsula de respuesta, el H1 ni la cabecera
4. El texto, los enlaces y el orden del borrador no cambiaron
5. Cada pieza cumple su "contenido válido" del catálogo (3–6 pasos, 2 columnas, 1 cita)

Una página con 0 piezas destacadas y 5/5 es un resultado válido.

## Handing off

> Siguiente: ejecuta `onpage-optimizer` sobre `draft.md`. Comprueba también el movimiento.

## Credits

Original: Galileo Studio internal SEO skills, adapted for the sau plugin.
