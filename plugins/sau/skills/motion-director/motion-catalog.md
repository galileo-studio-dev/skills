# Catálogo de piezas de movimiento

Lista cerrada. `motion-director` solo asigna piezas de esta lista.
Cada pieza existe en `kit/components/` y se instala en `src/components/motion/`.

Reglas de uso: `motion-rules.md`.

## Resumen

| Pieza | Tipo | Cuándo usarla | Componente | Sintaxis en Markdown |
|---|---|---|---|---|
| `reveal` | Automática | Siempre. H2 por máscara; H3 y citas suben. | `Reveal` | Ninguna: la aplica el blog |
| `pasos` | Destacada | Un proceso de 3–6 pasos en orden. | `Steps` | `:::pasos` + lista numerada |
| `comparativa` | Destacada | Dos opciones frente a frente (A frente a B). | `Comparison` + `ComparisonColumn` | `::::comparativa` + dos `:::columna[Título]` |
| `cita-destacada` | Destacada | La frase clave de la página. Máximo una. | `PullQuote` | `:::cita-destacada` |

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
2. Si tiene sintaxis Markdown, añade su nombre a `MOTION_CONTAINERS` en `kit/lib/remark-motion.ts`. Añade también el caso en `blog-markdown.patch`.
3. Cumple `motion-rules.md`: solo `transform` y `opacity`, CSS de scroll, movimiento reducido.
4. Añade la pieza a este catálogo.
5. Ejecuta `<py|python3> ${CLAUDE_PLUGIN_ROOT}/skills/motion-director/kit/install_kit.py --root <code_repo_path>` y los `checks` del perfil (por ejemplo, la compilación de la web).
