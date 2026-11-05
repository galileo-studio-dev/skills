---
description: SAU, estado. Tabla de páginas o tandas con su último paso, el siguiente y la puerta pendiente. Solo lectura. Atajo del modo estado de la skill sau:running-sau.
argument-hint: "[sitio]"
disable-model-invocation: true
---

Modo `estado` de la skill `sau:running-sau`, con estos argumentos: $ARGUMENTS

Desde la raíz git de la sesión, ejecuta con `py` o `python3` (el que exista):

```bash
py "${CLAUDE_PLUGIN_ROOT}/skills/running-sau/scripts/state.py" --format table
```

Si los argumentos traen un sitio, añade `--site <sitio>`. Enseña la tabla tal cual, con sus avisos, y una línea con el siguiente paso que propondrías. Si el script falla o encuentra varios perfiles, enséñalo y para.

Es solo lectura: no escribas nada, no ejecutes pasos y no despaches agentes.
