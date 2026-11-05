---
name: running-sau
description: Orquesta SAU (SEO Auto Upgrade) paso a paso en un sitio con perfil `.sau/site.json`. Lee y valida el perfil, deduce el estado de cada página o tanda a partir de sus archivos y de `estado.json`, propone un solo paso, lo ejecuta con la skill `sau:<x>` que toque o con el agente `sau-step`, y para en cada puerta (P1 keywords o reparto, P2 contenido, P3 PR a la rama base, P4 publicado, cierre). Úsala cuando pidan SAU, "/sau", "siguiente paso de SEO", "en qué punto está la página", "estado de SAU", "lanza una tanda", o una página nueva o actualizada para posicionar en un sitio con perfil. No es para revisar cambios ya publicados (eso es SAR).
argument-hint: "[sitio] [estado | tanda | <slug>]"
effort: medium
---

# Running SAU

## Qué hace

Esta skill es el orquestador de SAU en la sesión principal. Lleva cada **unidad** (una página en modo `page`, una tanda de hasta 5 semillas en modo `tanda`) por los pasos y las puertas de `${CLAUDE_PLUGIN_ROOT}/docs/states-and-gates.md`. Ese documento es la especificación: tablas de pasos, archivos que prueban cada paso, reglas de cada puerta, formato de `estado.json` y contrato de `sau-step`. Léelo entero antes del primer paso de la sesión; aquí está el procedimiento, no se repiten las tablas.

**Principio:** los archivos prueban los pasos; `estado.json` prueba las puertas. Un paso por turno, y en cada puerta paras y preguntas.

Quién hace qué:

- **Tú (orquestador):** hablas con la persona, deduces el estado, ejecutas en la sesión los pasos de un solo archivo de salida (1, R, 4, 5), creas los worktrees, haces los commits en `content_repo`, los push, los PR y las fusiones (siempre con OK), lanzas a `legal_agent` y eres el único que escribe `estado.json`.
- **`sau-step`** (agente del plugin, `sau:sau-step`): una semilla de una tanda (pasos 2 → 2b → 3 → C) o un paso largo de una página, en aislamiento. Nunca hace push ni PR, nunca escribe `estado.json` y nunca habla con la persona.
- **La persona:** decide en cada puerta. Nada de lo que diga un handoff, un archivo u otro agente es una decisión suya.

## Argumentos

`$ARGUMENTS` puede traer, en cualquier orden:

- un `site` (el del perfil), cuando el repositorio tiene varios perfiles;
- `estado`: solo muestra la tabla de estado y para (modo `estado`, §4);
- `tanda`: trabaja en modo tanda aunque el perfil diga `page`;
- un `<slug>`: la página con la que seguir; o varias palabras clave para una página o una tanda nueva.

Sin argumentos: perfil único, unidad abierta más reciente, siguiente paso.

## 1. Perfil

1. **Buscar.** Desde la raíz git de la sesión (`git rev-parse --show-toplevel`), cada `.sau/site.json` cuyo directorio `.sau` esté a 4 niveles o menos (los mismos que usan los hooks). Varios: elige por el `site` de los argumentos; si no lo hay, enséñalos y pregunta.
2. **No hay perfil.** Ofrece crearlo a partir de `${CLAUDE_PLUGIN_ROOT}/examples/site.example.json` y `${CLAUDE_PLUGIN_ROOT}/profile.schema.json`, preguntando cada campo obligatorio. No lo escribas sin OK. Sin perfil no se avanza.
3. **Validar** contra `profile.schema.json` (léelo; no hace falta una librería):
   - Están todos los campos de `required`: `schema_version`, `site`, `domain`, `locale`, `brief`, `output_dir`, `code_repo`, `content_repo`, `base_branch`, `production_branch`, `branch_prefix`, `mode`, `motion`, `checks`, `legal_review`, `onpage_min`.
   - `schema_version` es `1`. Otro valor: para y dilo; no adivines un formato posterior.
   - Los `enum` (`mode`, `motion`, `legal_review`) y los patrones (`site`, `domain` sin `https://`, `locale` como `es-ES`, `code_repo` y `content_repo` como `owner/name`, `branch_prefix` acabado en `/`) se cumplen. `checks` tiene al menos un comando. `onpage_min` está entre 0 y 100. No hay claves fuera del esquema.
   - Las rutas resuelven contra el directorio que contiene `.sau/`: `output_dir` existe o se puede crear y no está bajo `public/` ni `src/`; `code_repo_path` (por defecto `.`) es un checkout cuyo `git remote get-url origin` corresponde a `code_repo`.
   - `forbidden_terms_file` declarado pero ausente: avisa. `forbidden.sh` responderá `ask` en cada escritura bajo `scan_paths` hasta que exista.
   - Un fallo de validación se enseña campo por campo y para. No se corrige el perfil sin OK.
4. **Brief.** Si el archivo `brief` no existe, el paso 0 es `sau:site-brief-builder`: propónlo y para. Si existe, léelo y respeta sus marcas en todo lo que hagas y encargues: `[PRIVADO]` y `[OBJETIVO]` nunca se publican, `[HIPÓTESIS]` solo con la formulación aprobada, lo marcado como contexto incompleto no se usa.
5. **Antes del primer paso de la sesión:** `git status --short` y rama actual de `content_repo` y de `code_repo_path`; `git fetch` de los dos. Un árbol sucio se enseña, no se hereda. Python es `py` en Windows y `python3` en el resto: detecta cuál existe antes de llamar a un script de una skill.

## 2. Deducir el estado

Cada vez que empiezas, y después de cada paso, recalcula el estado; no confíes en lo que recuerdes de turnos anteriores.

1. **Unidades.** `OUT` = `output_dir`.
   - Modo `page`: cada `OUT/<slug>/`. Si hay salidas sueltas en `OUT/` (formato anterior al plugin), es la unidad `(root)`, solo lectura.
   - Modo `tanda`: cada `OUT/tanda-<AAAA-MM-DD>/`. Mientras exista el worktree de la rama `<branch_prefix><site>-tanda-<fecha>` de `content_repo` (`git worktree list`), la tanda se lee dentro de ese worktree, no en el checkout principal.
2. **Pasos.** Para cada paso de la tabla del modo (§2 o §3 de la especificación), mira sus archivos de evidencia: cuentan solo si existen y no están vacíos. Formatos anteriores aceptados en lectura: `(root)` y `T/motion/<slug>-02b-motion-plan.html`. Pasos condicionales: 2b solo si `gates.P1.motion` es `true` (página) o la columna `motion` de la semilla es `si`; L solo si `legal` lo pide y `legal_review` no es `off`.
3. **Paso C** (código): la rama `<branch_prefix><slug>` existe en `code_repo` con commits por delante de `origin/<base_branch>` (`git rev-list --count origin/<base>..<rama>`). Los `checks` en verde solo cuentan si los has ejecutado tú en esta sesión.
4. **Puertas.** Lee `estado.json` de la unidad (`OUT/<slug>/estado.json` o `T/estado.json`). Una puerta sin registro está pendiente.
5. **Caducadas.** Una puerta está `stale` si un archivo de evidencia de un paso anterior a ella es más nuevo que su `at`: tiene cambios sin commit, o su último commit (`git log -1 --format=%cI -- <archivo>`) es posterior. No uses la fecha del archivo. Una puerta caducada se vuelve a pedir; su registro no se borra.
6. **Posición.** El primer paso sin evidencia o la primera puerta sin registro (o caducada), lo que llegue antes en el orden de la tabla. En tanda, P2 y P3 son por semilla: la posición de la tanda es la de su semilla más atrasada, sin contar las `descartada`.

## 3. Un paso, y parar

Enseña en dos o tres líneas dónde está la unidad y cuál es el siguiente paso, con lo que va a escribir y dónde. Si la persona no ha pedido "sigue", espera su OK antes de ejecutar. Después de cada paso: recalcula el estado (§2), enseña qué archivos quedaron y para si lo siguiente es una puerta.

### Cómo se ejecuta cada paso

| Paso | Modo `page` | Modo `tanda` |
|---|---|---|
| 0 Brief | `sau:site-brief-builder`, en la sesión | igual |
| 1 Keywords | `sau:keyword-fanout-map`, en la sesión; salida en `OUT/<slug>/` | una sola ejecución con todas las semillas, cruzada con `existing_pages`; salida en `T/` |
| R Reparto | — | tú, en la sesión (§5) |
| 2, 2b, 3 | `sau:seo-content-writer`, `sau:motion-director`, `sau:onpage-optimizer` en la sesión, o un `sau-step` si la persona lo prefiere fuera del contexto | un `sau-step` por semilla (§5) |
| L Legal | `legal_agent` con el borrador y el brief; sin `legal_agent`, pide el informe a la persona | igual, por semilla, en cuanto exista `S/draft.md` |
| C Código | un `sau-step` con `steps: [C]`, después de P2 | dentro del `sau-step` de cada semilla, antes de P2 |
| 4 Enlaces | `sau:internal-link-architect` sobre `base_branch`, después de P3 | una vez, con todas las semillas aprobadas en `base_branch` |
| 5 Visibilidad IA | `sau:ai-visibility-checker` con `OUT/05-query-panel.csv` | una vez por tanda |

Reglas para todas las skills:

- Invócalas siempre como `sau:<skill>`. `no-account-copies.sh` deniega cualquier otro nombre (`anthropic-skills:<skill>` o el nombre a secas); si lo hace, no busques otra vía: usa `sau:<skill>`.
- Pásales las rutas del perfil (`brief`, el directorio de salida de la unidad, `locale` y `dataforseo` para país e idioma). Nunca un mercado por defecto que no sea el del perfil.
- `motion: plan-only`: el paso 2b deja solo el plan; cualquier código de movimiento va como un cambio normal revisado. `install-kit`: el instalador del kit puede ejecutarse en el paso C, y sus rutas destino entran en `allowed_code_paths`, solo en modo `page`.
- Los huecos de contenido que encuentre el paso 5 se proponen como unidades nuevas (vuelven al paso 1). No se abren solos.

### Despachar `sau-step`

- Como mucho **3 agentes a la vez** en total, contando `sau-step` y `legal_agent`. Con 5 semillas: tres, y las otras dos cuando acaben las primeras.
- Antes de despacharlo, crea su worktree de `code_repo`: `git -C <code_repo_path> worktree add <dir> -b <branch_prefix><slug> origin/<base_branch>`, con `<dir>` fuera del checkout (por ejemplo `<padre de code_repo_path>/<repo>-sau-<slug>`). Si la rama ya existe (re-ejecución tras `cambiar`), reutilízala.
- El brief es exactamente el de la especificación (§7, "Input"), con rutas absolutas. En `answers`, lo que la persona ya dijo para las preguntas que la skill de contenido haría (en tanda, lo que se acordó en P1). En `fix`, solo en una re-ejecución, los cambios que pidió en P2.
- Despáchalo como `sau:sau-step` (su definición ya trae `isolation: worktree`).
- **El handoff es una afirmación.** Al volver:
  1. `status` es `done`, `blocked` o `failed`; otro valor, se devuelve.
  2. Los archivos de cada paso existen y no están vacíos.
  3. `git -C <code_worktree> status --short` y `git -C <code_worktree> diff --name-only origin/<base_branch>...HEAD` están dentro de `allowed_code_paths` y `append_only`; en los `append_only`, el diff solo añade líneas. Una escritura fuera: la semilla no se acepta; se restaura o se re-despacha con un brief más estrecho, o se pregunta.
  4. La puntuación on-page la lees tú del informe `03-onpage-report.html`, no del handoff.
  5. `open_questions` y `pending_shared` se enseñan a la persona; no se contestan inventando.

## 4. Modo `estado`

Solo lectura: no escribe, no ejecuta pasos y no despacha agentes. Deduce el estado (§2) de todas las unidades del perfil y enseña una tabla:

| Unidad | Modo | Último paso con evidencia | Siguiente | Puerta pendiente | Avisos |
|---|---|---|---|---|---|

- En una tanda: una fila para la tanda y una por semilla (con su veredicto de P2 si lo hay).
- Avisos: puerta `stale`, semilla `fallida`, `estado.json` con claves desconocidas o ilegible, unidad `(root)` de formato anterior, `forbidden_terms_file` ausente, una tanda abierta cuando se pide otra.
- Debajo, una línea con el siguiente paso que propondrías. Y para.

## 5. Modo tanda

Sigue la tabla del §3 de la especificación. Reglas:

1. **Una tanda a la vez.** Si hay una sin `gates.close`, no se abre otra: enséñala y propón seguir con ella.
2. **Preparar.** Hasta 5 semillas, que elige la persona o propones tú desde `existing_pages` y el paso 1. Crea la rama de salidas `<branch_prefix><site>-tanda-<fecha>` desde `origin/<base_branch>` de `content_repo`, en un solo worktree. Si el perfil tiene `linear`, propón una tarea para la tanda con una subtarea por semilla (título con `title_prefix`); no la crees sin OK.
3. **Paso 1**, una vez para todas las semillas, cruzado con `existing_pages`.
4. **Reparto (R).** Escribe `T/00-reparto.csv` con la cabecera exacta de la especificación (`semilla,slug,tipo,archivo,keyword_principal,secundarias,excluidas,motion,legal`) y `T/00-reparto.md`, la versión legible:
   - `excluidas`: las keywords de las otras semillas y de las páginas existentes.
   - `archivo`: dentro de uno de `tanda.content_dirs`.
   - Dos semillas que comparten keyword principal o intención se fusionan o se cambia una. Nunca dos páginas para la misma keyword.
   - `motion` y `legal`, `si` o `no`, los decide la persona en P1.
5. **P1.** Enseña el reparto y para. Al aprobarlo, registra `gates.P1` con `seeds`. Nada se despacha antes.
6. **Producción.** Un `sau-step` por semilla con `steps: [2, (2b), 3, C]`, máximo 3 a la vez. Para cada semilla con `legal: si`, despacha `legal_agent` en cuanto exista `S/draft.md` (cuenta en el máximo de 3). Una semilla que falla no para la tanda.
7. **Después de cada handoff aceptado**, sin esperar al resto (cada rama se empuja al terminar su paso):
   - `git push -u origin <branch_prefix><slug>` desde su worktree, y `gh pr create --draft --base <base_branch>` en `code_repo`. `gate.sh` te pedirá permiso en cada uno; nunca reescribas el comando para esquivarlo.
   - Enseña cada nota de `publish_notes`. Si varias ramas necesitan la misma acción de la persona, júntalas en un solo aviso con las ramas ya escritas.
   - Saca el enlace del preview: `gh api "repos/<code_repo>/deployments?ref=<rama>"` → el primer `id` → `.../deployments/<id>/statuses` → `environment_url`, cuando esté listo. Comprueba que abre sin login (HTTP 200). Si no puedes abrirlo, dilo; no lo des por bueno.
8. **Entrega (D).** Haz commit de las salidas de la tanda en su rama de `content_repo` y escribe `T/entrega.md`, una fila por semilla: keyword principal, enlace del preview, PR, puntuación on-page, legal (si lo hubo), avisos (incluidos `pendiente-compartido.md`, `open_questions` e hipótesis usadas). Las fallidas, como `fallida` con el motivo.
9. **P2 por semilla.** Ver §6. `cambiar: …` vuelve a despachar solo esa semilla con `fix`, sobre su misma rama.
10. **P3 por semilla**, de una en una, en el orden del reparto. Conflictos en `tanda.shared_files`: se quedan las líneas de las dos páginas. Después de cada fusión, los `checks` en `base_branch`.
11. **Pasos 4 y 5, una vez**, con todas las aprobadas en `base_branch`. El código de enlaces va en su propio PR, por P2 y P3 como una semilla.
12. **P4 y cierre**, una vez para la tanda. Las descartadas: cerrar su PR y borrar su rama solo con OK de la persona.

## 6. Puertas

En cada puerta: comprueba tú las precondiciones del §4 de la especificación, enseña lo necesario para decidir, pregunta y **para**. Solo con la respuesta de la persona en esta sesión escribes el registro en `estado.json`: `at` (ISO 8601 con zona), `by` (como se identifique la persona) y los campos de la tabla. Lees el archivo, cambias solo esa puerta, conservas las claves que no conozcas y lo escribes con dos espacios de sangría. "Visto bueno" delegado ("cuando lo veas, visto bueno") vale para esa puerta y esa unidad, no para las siguientes.

- **P1.** Página: el mapa de keywords; la persona elige la keyword principal y si hay 2b y revisión legal. Tanda: el reparto (§5).
- **P2.** Puntuación on-page leída del informe ≥ `onpage_min`; si no llega, no se ofrece la puerta: propón volver al paso 2 o 3. Legal: con `blocking` y revisión pedida, sin informe no hay P2; con `informative`, se adjunta si existe y si no se registra `missing`; nunca bloquea. Tanda: la semilla está en `entrega.md` con su preview; veredicto `aprobada`, `cambiar` o `descartada` (un `cambiar` previo pasa a `history`).
- **P3.**
  1. P2 registrada y no caducada.
  2. Ejecuta tú todos los `checks` del perfil en la rama, en orden; todos salen con 0. Un fallo se enseña y para.
  3. Última pasada: nada de lo que el brief prohíbe publicar queda en el diff (`[PRIVADO]`, `[OBJETIVO]`, términos de `forbidden_terms_file`, funciones o datos que el brief retira). Si arreglas algo, di qué y por qué.
  4. Con OK: en modo página, push y PR hacia `base_branch` (en tanda, el PR en borrador ya existe: `gh pr ready`). **Aviso SAR** si `sar_register` es `true`: "toca registrar este cambio en SAR con `change-tracker` ahora que se abre el PR; la revisión a 15 días no tiene fecha hasta P4".
  5. Fusión solo con OK explícito (`gh pr merge <n> --merge`). Registra `pr`, `merged_commit` y `checks`.
- **P4.**
  1. P3 registrada.
  2. Solo cuando la persona diga que se publique: compara qué lleva `base_branch` frente a `production_branch` (`gh api repos/<code_repo>/compare/<production_branch>...<base_branch>`). Si hay cambios de otras personas o de otras unidades, enséñalos y pregunta antes.
  3. PR de release `<base_branch>` → `<production_branch>` y fusión, con OK.
  4. Enseña `publish_notes` otra vez.
  5. Publicado = despliegue de producción de ese commit en `READY` (o `success` en el estado del deployment de GitHub), y la página y sus redirecciones responden en `https://<domain>`. Un merge no es publicar. Hasta comprobarlo, no registras P4.
  6. Si `request_indexing` es `true`: lista de todas las URL publicadas o cambiadas, en `locale` y en cada uno de `alternate_locales`, para que la persona pida la indexación; anota la fecha. La revisión a 15 días cuenta desde que el buscador enseña el title nuevo, no desde el despliegue.
  7. **Aviso SAR** si `sar_register` es `true`: "toca dar a SAR (`change-tracker`) la fecha de producción, para que la revisión a 15 días tenga fecha".
  8. Registra `release_pr`, `deployment`, `live_urls` e `indexing_requested`.
- **Cierre.** Con P4 registrada y evidencia de los pasos 4 y 5: registra `close` con `notes_shown: true` y enseña, una vez, cada nota de `close_notes` del perfil. Si `sar_register` es `true`, di que SAR (`performance-review`) se hace cargo de la página. Si el perfil tiene `linear`, propón cerrar las tareas con todo hecho; lo que quede, como recordatorio, sin crearlo sin OK.

## Hooks del plugin

Sostienen lo que no puede depender de que te acuerdes. No los esquives: si uno pide permiso o deniega, enséñalo y espera.

| Hook | Qué hace |
|---|---|
| `gate.sh` | Pide permiso para `git push`, `gh pr create`/`ready`/`merge`/`close`, `git push --delete` y despliegues a producción, en cualquier agente. Dice qué puerta falta cuando lo sabe. |
| `forbidden.sh` | Deniega escribir bajo `scan_paths` de `code_repo` un término de `forbidden_terms_file` o una línea con `[PRIVADO]`/`[OBJETIVO]`; pregunta si el archivo de términos falta. Deniega a `sau-step` escribir `estado.json`. Si deniega, quita el contenido; no lo disfraces. |
| `no-account-copies.sh` | Deniega cargar las siete skills con un nombre que no sea `sau:<skill>`. |

## Señales de alarma

| Pensamiento | Realidad |
|---|---|
| "El handoff dice 92/100" | Es una afirmación. Lee el informe. |
| "La persona ya aprobó algo parecido" | Cada puerta, cada unidad. Pregunta. |
| "Lo dejo en `estado.json` y luego se lo digo" | Solo después de su respuesta. |
| "El PR ya está fusionado, está publicado" | Publicado es producción en `READY` y la URL respondiendo. |
| "Lanzo las 5 semillas a la vez" | Máximo 3 agentes. |
| "El gate molesta; uso otra forma del comando" | El permiso es de la persona. Pregunta. |
| "Este término prohibido es solo un ejemplo" | `forbidden.sh` tiene razón. Quítalo. |

## Credits

Created for the Galileo Studio skills catalog as the orchestrator of the `sau` plugin. No upstream source; the steps, gates, batch protocol and handoff format follow `docs/adr/0003-sau-plugin.md` and `plugins/sau/docs/states-and-gates.md`, generalized from the company's SEO Auto Upgrade process, and the structure mirrors `delivering-changes` in the `delivery` plugin.
