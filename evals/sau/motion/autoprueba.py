#!/usr/bin/env python3
"""Autoprueba del banco: demuestra que el nivel 1 FALLA con fixtures rotos.

Copia el motion-director real a una carpeta temporal, le aplica un defecto de
`fixtures/rotos/` y ejecuta nivel1.py. Cada caso pasa si nivel1.py sale con código 1
y su salida menciona el fallo esperado. Antes comprueba el control: la copia sin
defecto debe salir en verde (si no, la autoprueba no vale).
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ROTOS = AQUI / "fixtures" / "rotos"
REAL = AQUI.parents[2] / "plugins" / "sau" / "skills" / "motion-director"
NIVEL1 = AQUI / "nivel1.py"


def ejecutar(director: Path) -> tuple[int, str]:
    r = subprocess.run(
        [sys.executable, "-I", str(NIVEL1), "--director", str(director)],
        capture_output=True, text=True, encoding="utf-8",
    )
    return r.returncode, r.stdout + r.stderr


def copia() -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="motion-roto-"))
    dst = tmp / "motion-director"
    shutil.copytree(REAL, dst, ignore=shutil.ignore_patterns("propuestas"))
    return dst


def anadir_css(nombre: str):
    def f(d: Path) -> None:
        css = d / "kit" / "styles" / "motion.css"
        css.write_text(css.read_text(encoding="utf-8") + "\n" + (ROTOS / nombre).read_text(encoding="utf-8"), encoding="utf-8")
    return f


def anadir_componente(nombre: str):
    def f(d: Path) -> None:
        shutil.copy(ROTOS / nombre, d / "kit" / "components" / "roto.tsx")
    return f


def fila_sin_componente(d: Path) -> None:
    cat = d / "motion-catalog.md"
    lineas = cat.read_text(encoding="utf-8").splitlines()
    ultimo = max(i for i, l in enumerate(lineas[:20]) if l.startswith("|"))
    lineas.insert(ultimo + 1, (ROTOS / "catalogo-fila-sin-componente.txt").read_text(encoding="utf-8").strip())
    cat.write_text("\n".join(lineas) + "\n", encoding="utf-8")


def contenedor_fantasma(d: Path) -> None:
    f = d / "kit" / "lib" / "remark-motion.ts"
    t = f.read_text(encoding="utf-8")
    assert "MOTION_CONTAINERS = [" in t
    f.write_text(t.replace("MOTION_CONTAINERS = [", 'MOTION_CONTAINERS = ["fantasma", ', 1), encoding="utf-8")


def reemplazar(ruta: str, viejo: str, nuevo: str):
    """Defecto que cambia un texto exacto de un archivo del kit (el texto debe existir)."""
    def f(d: Path) -> None:
        p = d / ruta
        t = p.read_text(encoding="utf-8")
        assert viejo in t, f"autoprueba desfasada: no encuentro {viejo!r} en {ruta}"
        p.write_text(t.replace(viejo, nuevo, 1), encoding="utf-8")
    return f


def sin_export(d: Path) -> None:
    f = d / "kit" / "components" / "index.ts"
    f.write_text(f.read_text(encoding="utf-8").replace('export { PullQuote } from "./pull-quote";\n', ""), encoding="utf-8")


def pieza_que_cambia_a_width(d: Path) -> None:
    css = d / "kit" / "styles" / "motion.css"
    t = css.read_text(encoding="utf-8")
    css.write_text(t.replace("transform: scaleY(1);", "height: 100%;", 1), encoding="utf-8")


CASOS = [
    ("css con infinite", anadir_css("css-infinite.css"), "ni con más de 1 repetición"),
    ("css con 3 iteraciones", anadir_css("css-iteraciones.css"), "repeticiones 3"),
    ("css con @keyframes width", anadir_css("css-width.css"), "motion-grow/from: width"),
    ("css animación sin @supports", anadir_css("css-sin-supports.css"), "sin @supports"),
    ("css animación sin reduced-motion", anadir_css("css-sin-reduced-motion.css"), "sin @media (prefers-reduced-motion: no-preference)"),
    ("css: keyframe real cambiado a height", pieza_que_cambia_a_width, "height"),
    ("componente con use client", anadir_componente("comp-use-client.tsx"), '"use client"'),
    ("componente con useState", anadir_componente("comp-usestate.tsx"), "hook de estado/efecto/ref"),
    ("componente con framer-motion", anadir_componente("comp-framer.tsx"), "framer-motion"),
    ("pieza en catálogo sin componente", fila_sin_componente, "Holograma"),
    ("contenedor en remark-motion sin catálogo", contenedor_fantasma, "solo en remark-motion.ts: ['fantasma']"),
    ("componente sin exportar en index.ts", sin_export, "PullQuote"),
    # Piezas en prueba (2026-11): un defecto propio de cada contrato.
    ("encabezado: línea sin aria-hidden",
     reemplazar("kit/components/section-heading.tsx", '<span aria-hidden="true" className="motion-kicker-line" />', '<span className="motion-kicker-line" />'),
     "«motion-kicker-line» lleva aria-hidden"),
    ("componente sin instalar en FILES",
     reemplazar("kit/install_kit.py", '    KIT / "components" / "section-heading.tsx": "src/components/motion/section-heading.tsx",\n', ""),
     "section-heading.tsx"),
    ("pieza en la tabla «En prueba» y en «Resumen» a la vez",
     reemplazar("motion-catalog.md", "| `cita-destacada` | Destacada |", "| `encabezado-seccion` | Automática | x | `SectionHeading` | Solo TSX |\n| `cita-destacada` | Destacada |"),
     "a la vez en «Resumen» y en «En prueba»"),
    ("filas fuera del contenedor de página :has()",
     reemplazar("kit/styles/motion.css", "    .motion-rows,\n", ""),
     "motion-rows"),
    ("filas: separador sin content",
     reemplazar("kit/styles/motion.css", '  .motion-rows > dl > div + div::before {\n    content: "";\n', "  .motion-rows > dl > div + div::before {\n"),
     "el separador es ::before con content"),
    ("SKILL.md sin la regla de «En prueba»",
     reemplazar("SKILL.md", "Las de «En prueba»", "Las de la otra tabla"),
     "SKILL.md de motion-director dice que no asigna"),
]


def remark_roto() -> int:
    """Nivel 2 (remark) debe fallar si un contenedor del catálogo sale de MOTION_CONTAINERS."""
    web = AQUI / "banco-web"
    if not (web / "node_modules" / "remark-directive").exists():
        print("  aviso autoprueba del nivel 2 (remark) NO EJECUTADA: falta banco-web/node_modules")
        return 0
    d = copia()
    try:
        f = d / "kit" / "lib" / "remark-motion.ts"
        t = f.read_text(encoding="utf-8")
        f.write_text(t.replace('"pasos", ', "", 1), encoding="utf-8")
        env = {**os.environ, "MOTION_DIRECTOR": str(d)}
        r = subprocess.run(["node", "tests/nivel2-remark.mjs"], cwd=web, env=env, capture_output=True, text=True, encoding="utf-8")
    finally:
        shutil.rmtree(d.parent, ignore_errors=True)
    if r.returncode == 1 and "FAIL pasos.md" in r.stdout:
        print("  ok   el nivel 2 (remark) falla con: «pasos» fuera de MOTION_CONTAINERS")
        return 0
    print(f"  FAIL el nivel 2 (remark) NO detectó «pasos» fuera de MOTION_CONTAINERS (código {r.returncode})" + chr(10) + r.stdout + r.stderr)
    return 1


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    fallos = 0
    control = copia()
    try:
        codigo, salida = ejecutar(control)
        if codigo != 0:
            print("  FAIL control: el kit sin defectos debería pasar el nivel 1\n" + salida)
            return 1
        print("  ok   control: el kit sin defectos pasa el nivel 1")
    finally:
        shutil.rmtree(control.parent, ignore_errors=True)

    for nombre, mutar, esperado in CASOS:
        d = copia()
        try:
            mutar(d)
            codigo, salida = ejecutar(d)
        finally:
            shutil.rmtree(d.parent, ignore_errors=True)
        if codigo == 1 and esperado in salida:
            print(f"  ok   el nivel 1 falla con: {nombre}")
        else:
            fallos += 1
            print(f"  FAIL el nivel 1 NO detectó: {nombre} (código {codigo}, esperaba «{esperado}»)")
            print("       " + salida.replace("\n", "\n       "))
    fallos += remark_roto()
    print(f"autoprueba: {len(CASOS) + 1} defectos, {fallos} sin detectar")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
