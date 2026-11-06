#!/usr/bin/env python3
"""Instala o comprueba el kit de movimiento de SAU en el código de una web.

El kit vive en ${CLAUDE_PLUGIN_ROOT}/skills/motion-director/kit/. Este script lo copia
a src/ del checkout indicado con --root (el `code_repo_path` del perfil .sau/site.json).
El plugin es la única fuente: los archivos de src/ son copias generadas.

Uso (desde cualquier carpeta; `py` o `python3`, el que exista):
    <py|python3> install_kit.py --root <code_repo_path> --check   # solo informa
    <py|python3> install_kit.py --root <code_repo_path>           # instala o sincroniza
    Opcional: --blog-file <ruta relativa a --root del componente que renderiza el
    Markdown del blog>. Con él, el script comprueba que el blog está conectado.

Qué hace al instalar (webs Next.js con Tailwind y la carpeta src/):
    1. Copia componentes a src/components/motion/ y librerías a src/lib/.
    2. Copia los estilos a src/app/motion.css y los importa en src/app/globals.css.
    3. Añade la dependencia remark-directive (npm install) si falta.
    4. NO conecta el blog: es código propio de cada web. Si pasas --blog-file y no
       está conectado, el script lo dice y remite a "Conectar el blog a mano" del
       README.md de motion-director.

Es idempotente: si algo ya está instalado y al día, no lo toca.
Código de salida de --check: 0 si todo está al día, 1 si falta algo.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent
BLOG_MARKER = "blogRemarkPlugins"
CSS_IMPORT = '@import "./motion.css";'
TAILWIND_IMPORT = '@import "tailwindcss";'
DEPENDENCY = ("remark-directive", "^4.0.0")

# origen en el kit -> destino relativo a --root
FILES = {
    KIT / "components" / "reveal.tsx": "src/components/motion/reveal.tsx",
    KIT / "components" / "steps.tsx": "src/components/motion/steps.tsx",
    KIT / "components" / "comparison.tsx": "src/components/motion/comparison.tsx",
    KIT / "components" / "pull-quote.tsx": "src/components/motion/pull-quote.tsx",
    KIT / "components" / "section-heading.tsx": "src/components/motion/section-heading.tsx",
    KIT / "components" / "rows.tsx": "src/components/motion/rows.tsx",
    KIT / "components" / "bento.tsx": "src/components/motion/bento.tsx",
    KIT / "components" / "index.ts": "src/components/motion/index.ts",
    KIT / "lib" / "motion.ts": "src/lib/motion.ts",
    KIT / "lib" / "remark-motion.ts": "src/lib/remark-motion.ts",
    KIT / "styles" / "motion.css": "src/app/motion.css",
}
GLOBALS_REL = "src/app/globals.css"


def status(root: Path, blog_file: Path | None) -> dict[str, list[str]]:
    report: dict[str, list[str]] = {"ok": [], "missing": [], "outdated": []}
    for src, rel in FILES.items():
        dst = root / rel
        if not dst.exists():
            report["missing"].append(rel)
        elif dst.read_bytes() != src.read_bytes():
            report["outdated"].append(rel)
        else:
            report["ok"].append(rel)

    globals_css = root / GLOBALS_REL
    if globals_css.exists() and CSS_IMPORT in globals_css.read_text(encoding="utf-8"):
        report["ok"].append("globals.css importa motion.css")
    else:
        report["missing"].append("globals.css: import de motion.css")

    package = root / "package.json"
    deps = json.loads(package.read_text(encoding="utf-8")).get("dependencies", {}) if package.exists() else {}
    if DEPENDENCY[0] in deps:
        report["ok"].append(f"dependencia {DEPENDENCY[0]}")
    else:
        report["missing"].append(f"dependencia {DEPENDENCY[0]}")

    if blog_file is not None:
        if blog_file.exists() and BLOG_MARKER in blog_file.read_text(encoding="utf-8"):
            report["ok"].append("blog conectado al catálogo")
        else:
            report["missing"].append(
                "blog sin conectar: sigue 'Conectar el blog a mano' en el README.md de motion-director"
            )
    return report


def install(root: Path) -> None:
    for src, rel in FILES.items():
        dst = root / rel
        if not dst.exists() or dst.read_bytes() != src.read_bytes():
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())
            print(f"copiado   {rel}")

    globals_css = root / GLOBALS_REL
    if not globals_css.exists():
        sys.exit(f"ERROR: no existe {GLOBALS_REL}. Añade {CSS_IMPORT} a la hoja de estilos global a mano.")
    css = globals_css.read_text(encoding="utf-8")
    if CSS_IMPORT not in css:
        if TAILWIND_IMPORT not in css:
            sys.exit(f"ERROR: no encuentro {TAILWIND_IMPORT} en {GLOBALS_REL}. Añade {CSS_IMPORT} a mano.")
        css = css.replace(TAILWIND_IMPORT, f"{TAILWIND_IMPORT}\n{CSS_IMPORT}", 1)
        globals_css.write_text(css, encoding="utf-8")
        print(f"editado   {GLOBALS_REL} (import de motion.css)")

    package = root / "package.json"
    if not package.exists():
        sys.exit(f"ERROR: no existe {package}. ¿Es --root el checkout del código?")
    deps = json.loads(package.read_text(encoding="utf-8")).get("dependencies", {})
    if DEPENDENCY[0] not in deps:
        print(f"instalando {DEPENDENCY[0]}@{DEPENDENCY[1]} ...")
        subprocess.run(
            ["npm", "install", "--no-audit", "--no-fund", f"{DEPENDENCY[0]}@{DEPENDENCY[1]}"],
            cwd=root,
            check=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", required=True, help="checkout del código de la web (code_repo_path del perfil)")
    parser.add_argument("--blog-file", help="componente del blog que renderiza el Markdown, relativo a --root")
    parser.add_argument("--check", action="store_true", help="solo informa; no cambia nada")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    blog_file = (root / args.blog_file) if args.blog_file else None

    if not args.check:
        install(root)

    report = status(root, blog_file)
    for key, label in (("ok", "OK"), ("outdated", "DESACTUALIZADO"), ("missing", "FALTA")):
        for item in report[key]:
            print(f"[{label}] {item}")
    pending = report["missing"] or report["outdated"]
    if args.check:
        print("\nKit al día." if not pending else "\nKit pendiente: ejecuta install_kit.py sin --check.")
        sys.exit(1 if pending else 0)
    if pending:
        sys.exit("\nERROR: la instalación quedó incompleta. Revisa los mensajes anteriores.")
    print("\nKit instalado. Siguiente paso: los `checks` del perfil.")


if __name__ == "__main__":
    main()
