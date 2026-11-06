#!/usr/bin/env bash
# Banco de pruebas del kit de motion del plugin sau.
#   run.sh [--nivel 1|2|3|autoprueba|todo]      (por defecto: todo)
#
# Nivel 1  reglas estáticas del kit (CSS, componentes, coherencia con el catálogo). Rápido, sin red.
# Nivel 2  Markdown (remark-motion) e instalador (install_kit.py). Necesita Node >= 22.6 y banco-web/node_modules.
# Nivel 3  navegador: Playwright contra el muestrario de banco-web. Necesita red la primera vez (npm + navegadores).
# autoprueba  demuestra que el nivel 1 (y el remark del nivel 2) FALLAN con fixtures rotos.
# todo = 1 + 2 + 3 + autoprueba.
#
# Salida: 0 todo en verde; 1 algo falla; 2 nada falla pero algo no se pudo ejecutar (no cuenta como pasado).
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
web="$here/banco-web"
nivel=todo
while [ $# -gt 0 ]; do
  case "$1" in
    --nivel) nivel="${2:-}"; shift 2 ;;
    --nivel=*) nivel="${1#--nivel=}"; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "uso: run.sh [--nivel 1|2|3|autoprueba|todo]"; exit 64 ;;
  esac
done
case "$nivel" in 1|2|3|autoprueba|todo) ;; *) echo "nivel desconocido: $nivel (1, 2, 3, autoprueba o todo)"; exit 64 ;; esac

PY=""; for c in py python3 python; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(sys.version_info[0] != 3)' >/dev/null 2>&1; then PY=$c; break; fi
done
[ -n "$PY" ] || { echo "run.sh: no hay Python 3 (py, python3 o python)"; exit 2; }
export PYTHONUTF8=1

declare -a nombres estados
anotar() { nombres+=("$1"); estados+=("$2"); }   # PASA | FALLA | NO EJECUTADO (motivo)

correr() {  # correr <nombre> <comando...>
  local nombre=$1; shift
  echo; echo "=== $nombre ==="
  "$@"; local rc=$?
  if   [ $rc -eq 0 ]; then anotar "$nombre" "PASA"
  elif [ $rc -eq 2 ]; then anotar "$nombre" "NO EJECUTADO (ver mensaje de arriba)"
  else anotar "$nombre" "FALLA"; fi
}

node_listo() {  # deja banco-web/node_modules instalado; 0 si se puede usar Node
  command -v node >/dev/null 2>&1 || { echo "  NO EJECUTADO: no hay Node en el PATH"; return 1; }
  if [ ! -d "$web/node_modules/remark-directive" ] || [ ! -d "$web/node_modules/playwright" ]; then
    echo "  instalando dependencias de banco-web (npm ci) ..."
    ( cd "$web" && npm ci --no-audit --no-fund ) || { echo "  NO EJECUTADO: npm ci falló (¿sin red?)"; return 1; }
  fi
  return 0
}

n2_remark() { node_listo || return 2; ( cd "$web" && node tests/nivel2-remark.mjs ); }
n2_instalador() { "$PY" "$here/nivel2_instalador.py"; }
n3() {
  node_listo || return 2
  ( cd "$web" && npm run --silent test:motion ); local rc=$?
  if [ $rc -eq 2 ]; then
    echo "  intentando instalar los navegadores de Playwright (npx playwright install chromium firefox) ..."
    ( cd "$web" && npx playwright install chromium firefox ) && ( cd "$web" && npm run --silent test:motion ); rc=$?
  fi
  return $rc
}

if [ "$nivel" = 1 ] || [ "$nivel" = todo ]; then correr "nivel 1: reglas estáticas" "$PY" "$here/nivel1.py"; fi
if [ "$nivel" = 2 ] || [ "$nivel" = todo ]; then
  correr "nivel 2a: Markdown (remark-motion)" n2_remark
  correr "nivel 2b: instalador (install_kit.py)" n2_instalador
fi
if [ "$nivel" = 3 ] || [ "$nivel" = todo ]; then correr "nivel 3: navegador" n3; fi
if [ "$nivel" = autoprueba ] || [ "$nivel" = todo ]; then correr "autoprueba: fixtures rotos" "$PY" "$here/autoprueba.py"; fi

echo; echo "=================== RESUMEN ==================="
rc=0; fallo=0; noej=0
for i in "${!nombres[@]}"; do
  printf '%-42s %s\n' "${nombres[$i]}" "${estados[$i]}"
  case "${estados[$i]}" in FALLA) fallo=1 ;; NO*) noej=1 ;; esac
done
if [ $fallo -eq 1 ]; then echo "RESULTADO: FALLA"; rc=1
elif [ $noej -eq 1 ]; then echo "RESULTADO: INCOMPLETO (algo no se pudo ejecutar; no cuenta como pasado)"; rc=2
else echo "RESULTADO: EN VERDE"; fi
exit $rc
