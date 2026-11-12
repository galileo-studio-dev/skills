# Motion — movimiento de las páginas de SAU

Esta carpeta contiene todo el motion design de SAU. Es la única fuente.
El código de la web (`src/`) recibe copias que instala `kit/install_kit.py`.

## Contenido

| Ruta | Función |
|---|---|
| `motion-rules.md` | Reglas de marca, de SEO y de dosis. |
| `motion-catalog.md` | Lista cerrada de piezas y su sintaxis. |
| `kit/components/` | Componentes React de cada pieza. Sin JavaScript en el navegador. |
| `kit/lib/motion.ts` | Tokens de movimiento (curvas, duraciones, retardos). |
| `kit/lib/remark-motion.ts` | Lee los bloques `:::` del Markdown del blog. |
| `kit/styles/motion.css` | Animaciones con CSS de scroll. |
| `kit/install_kit.py` | Instala o comprueba el kit en el código de la web. |

## Cómo funciona en la secuencia

1. `seo-content-writer` (paso 2) escribe `draft.md`.
2. `motion-director` (paso 2b) lee las reglas y el catálogo, y asigna piezas a las secciones.
3. `onpage-optimizer` (paso 3) comprueba que el movimiento cumple las reglas.
4. Al llevar la página al código, con `motion: install-kit` en el perfil, `motion-director` ejecuta `install_kit.py`. Con `motion: plan-only` no lo ejecuta.

## Instalar o comprobar el kit

El kit está pensado para webs Next.js con Tailwind y carpeta `src/`. `--root` es el checkout del código (`code_repo_path` del perfil `.sau/site.json`). Usa `py` o `python3`, el que exista.

```bash
<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/motion-director/kit/install_kit.py --root <code_repo_path> --check   # informa; no cambia nada
<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/motion-director/kit/install_kit.py --root <code_repo_path>           # instala o sincroniza
```

Después, ejecuta los `checks` del perfil.

El instalador:

- Copia componentes a `src/components/motion/` y librerías a `src/lib/`.
- Copia los estilos a `src/app/motion.css` y los importa en `src/app/globals.css`.
- Añade la dependencia `remark-directive`.
- Con `--blog-file <ruta>`, comprueba que el blog está conectado. No lo conecta: ver la sección siguiente.

Es idempotente: si todo está al día, no cambia nada.

**Aviso: secciones a todo el ancho y `overflow-x-hidden`.** En las páginas con piezas, el kit cambia la raíz `overflow-x-hidden` a `overflow-x: clip`, para que `view()` funcione (regla 2.8 de `motion-rules.md`). Con `clip`, igual que con `hidden`, cualquier sección que se salga del ancho de esa raíz (una sección *full-bleed*, o un bento ancho de 4 columnas dentro de una columna de 56rem) **se corta por los lados**. Esas secciones van fuera del contenedor con `overflow-x-hidden`, o el recorte se pone en un envoltorio por sección. El banco de pruebas lo comprueba: ninguna pieza puede quedar recortada a 1280, 1440 ni 390 px.

## Conectar el blog a mano

El blog es código propio de cada web, así que esta conexión se hace a mano una vez. El kit ya no conecta el blog automáticamente; el parche concreto de cada web vive en el repo privado de esa web. Solo hace falta si el sitio tiene blog con Markdown.

1. En el componente que renderiza el Markdown del blog:
   - Importa `remarkDirective`, `remarkMotion` (de `@/lib/remark-motion`) y las piezas de `@/components/motion`.
   - Exporta `blogRemarkPlugins = [remarkDirective, remarkMotion]` (si el blog ya usa `remarkGfm` u otros plugins, añádelos a la misma lista).
   - Renderiza `h2` con `<Reveal as="h2" variant="mask">`, y `h3` y `blockquote` con `<Reveal>`.
   - Añade un renderizador `div` que lee `data-motion` y devuelve `Steps`, `Comparison`, `ComparisonColumn` o `PullQuote`. Un valor desconocido devuelve un `<div>` normal.
   - Piezas de bloque: el mismo renderizador devuelve también `Bento` (`bento`), `Figures` (`cifras`) y `Rows` (`filas`), pasando el `<ul>`/`<dl>` del Markdown como hijo. Un `<div data-motion>` sin renderizador propio se ve como un `<div>` normal.
2. En la página del post, pasa `remarkPlugins={blogRemarkPlugins}` a `ReactMarkdown`.
3. Pasa ese componente a `install_kit.py` con `--blog-file` para comprobar la conexión (busca el nombre `blogRemarkPlugins`).

`kit/lib/remark-motion.ts` importa los tipos de `mdast-util-to-hast` (`import type {} from "mdast-util-to-hast"`). Ese paquete llega con `remark-rehype` o `react-markdown`; si la web no tiene ninguno de los dos y no compila, añade `mdast-util-to-hast` a `devDependencies`.

## Vídeo opcional

Para páginas de servicio, `motion-director` puede proponer un vídeo corto.
El vídeo lo crea el equipo con sus propias plantillas.
La skill solo deja la propuesta en el plan. No genera el vídeo.

## Mantenimiento

- No edites los archivos copiados en `src/`. Edita `kit/` y vuelve a instalar.
- Una pieza nueva sigue los pasos de "Añadir una pieza nueva" en `motion-catalog.md`.
- Antes de dar por buena una pieza nueva o un cambio en `kit/`: `evals/sau/motion/run.sh --nivel todo` debe salir en verde (la pieza entra en el catálogo solo después, con el OK de Pelayo a las capturas).
