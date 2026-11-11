# Reglas de movimiento (motion design)

Estas reglas aplican a toda página de contenido que produce SAU.
Las usan `motion-director` (asigna piezas) y `onpage-optimizer` (las comprueba).

Origen: los principios de movimiento de marca del equipo.
Principio: **entrar con intención, sostener, salir limpio.**

## 1. Reglas de marca

1. **Curva de entrada:** `expo.out` (`cubic-bezier(0.16, 1, 0.3, 1)`). Curva de salida: `power3.in`.
2. **Texto:** los títulos entran por máscara. El texto sube recortado. No aparece con un fundido plano.
3. **Cadencia:** el retardo entre elementos de un grupo va de 0,02 a 0,12 s.
4. **Una sola entrada:** cada elemento entra una vez y se queda. No hay bucles infinitos ni animaciones con reloj (`animation-duration` en segundos sin `animation-timeline`). **Excepción: `orbita`.** Sus nodos avanzan un tramo fijo de su órbita mientras la sección cruza la pantalla. El avance va ligado al scroll: si el scroll para, la órbita para, y al volver atrás retrocede. No es un bucle. **Excepción acotada: el flujo de `esquema`** (`layout="stage"`). Cuando el esquema ya está dibujado, unos puntos pequeños recorren en bucle los cables hacia el nodo principal, escalonados, y una petición sale por la conexión cortada y se apaga en la marca de corte. Es sutil, solo usa `transform` y `opacity`, y con `prefers-reduced-motion: reduce` o sin soporte de CSS de scroll no existe.
5. **Propiedades:** solo `transform` y `opacity`. Nunca `width`, `height`, `top`, `left`, `margin`, `clip-path`, `filter` ni `stroke-dashoffset`. Los conectores y las líneas crecen con `scale` dentro de `transform`.

## 2. Reglas de SEO y rendimiento

1. **H1 y LCP:** el H1 y el elemento LCP (imagen o bloque principal de la cabecera) **nunca** se animan. Ocultarlos retrasa el LCP.
2. **Texto en el HTML:** todo el texto está en el HTML que genera el servidor. El movimiento no carga texto con JavaScript.
3. **CLS = 0:** el movimiento no cambia el tamaño ni la posición de otros elementos.
4. **Sin JavaScript para el scroll:** las piezas usan CSS de scroll (`animation-timeline: view()`).
5. **Sin soporte:** si el navegador no admite el CSS de scroll, el contenido se ve estático y completo.
6. **Movimiento reducido:** con `prefers-reduced-motion: reduce`, nada se mueve.
7. **Pantalla inicial:** lo que ya se ve al cargar la página aparece completo, sin animación.
8. **Contenedor de página:** `view()` necesita que la página se desplace con el documento. Un ancestro con `overflow-x: hidden` lo impide. El kit cambia ese caso a `overflow-x: clip` en las páginas con piezas. En páginas nuevas, usa `overflow-x-clip`.
9. **Elementos pequeños:** con `view()`, la animación dura lo que mide el elemento. Un elemento de menos de ~40 px de alto (una línea, una etiqueta, un número) no usa `view()` propio: usa la línea de tiempo con nombre de su contenedor (`view-timeline: --motion-<pieza> block`). Así no salta de golpe.
10. **Figuras con texto:** `esquema` y `orbita` llevan un `figcaption` con texto real que dice lo mismo que el dibujo. Las partes decorativas (líneas, anillos, iconos, números de orden) llevan `aria-hidden`.

## 3. Reglas de dosis

1. **Por defecto:** todos los H2 entran por máscara y los H3 y las citas suben (`reveal`). En páginas de servicio, cada sección numerada abre con `encabezado-seccion`. Lo aplica el kit; la skill no lo decide.
2. **Piezas de bloque** (`bento`, `cifras`, `filas`): como máximo **una por sección H2** y **seis por página**, en todas las intensidades. No cuentan como destacadas. `cifras`, como máximo **una por página**.
3. **Piezas destacadas** (`pasos`, `comparativa`, `cita-destacada`, `esquema`, `orbita`): como máximo **una cada 2–3 secciones H2**.
4. **Límites por página:** `cita-destacada` y `orbita`, una; `esquema`, dos.
5. **Nunca en la primera pantalla:** `esquema` y `orbita` no van en el hero ni en la primera sección visible al cargar.
6. **Sección sin pieza:** es una opción válida. Una pieza solo entra si ayuda a entender el contenido.
7. **Intensidad:** la define el brief (ruta `brief` del perfil, sección "Movimiento"). Si falta, se usa `sobria`.

| Intensidad | Piezas destacadas por página | `orbita` |
|---|---|---|
| `sobria` | 0–2 | No |
| `media` | 2–4 | Máx. 1 |
| `expresiva` | 3–6 (sigue la regla de una cada 2–3 H2) | Máx. 1 |

## 4. Reglas de catálogo

1. Solo se usan piezas de `motion-catalog.md`. Nunca se inventa una pieza.
2. Una pieza nueva entra **primero** en el kit (`kit/`) y **después** en el catálogo.
3. El código de la web (`src/`) es una copia del kit. Se instala con `kit/install_kit.py`. No se edita en `src/`.
4. Las piezas de la tabla «En prueba» del catálogo están en el kit pero no se usan: esperan el OK de Pelayo a sus capturas. Las reglas de este archivo que las nombran se aplican cuando pasen a «Resumen».
