#!/usr/bin/env python3
"""Nivel 2 (instalador): install_kit.py sobre una web Next.js mínima de prueba.

Copia fixtures/web-minima/ a una carpeta temporal y comprueba:
  1. --check antes de instalar: sale con 1 (falta el kit).
  2. instalar: sale con 0 y copia todos los archivos de FILES (cada archivo del kit) + el import en globals.css.
     Si falta un componente en la web, --check lo informa como FALTA.
  3. --check después: sale con 0.
  4. segunda instalación: no copia ni edita nada y no cambia ni un byte (idempotente).
  5. un archivo copiado y alterado se detecta (--check sale con 1) y se repara al reinstalar.
  6. --blog-file: sin conectar da 1; con el marcador blogRemarkPlugins da 0.
La fixture ya declara remark-directive, así que no hace falta red ni npm.
"""
from __future__ import annotations

import hashlib
import importlib.util
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
FIXTURE = AQUI / "fixtures" / "web-minima"
INSTALL = AQUI.parents[2] / "plugins" / "sau" / "skills" / "motion-director" / "kit" / "install_kit.py"
fallos = 0


def archivos_del_kit() -> dict:
    """La lista FILES de install_kit.py (origen en el kit -> destino en la web)."""
    spec = importlib.util.spec_from_file_location("install_kit", INSTALL)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.FILES


def run(*args: str) -> tuple[int, str]:
    r = subprocess.run([sys.executable, "-I", "-X", "utf8", str(INSTALL), *args], capture_output=True, text=True, encoding="utf-8")
    return r.returncode, r.stdout + r.stderr


def huella(root: Path) -> dict[str, str]:
    return {
        str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(root.rglob("*")) if p.is_file()
    }


def comprobar(nombre: str, cond: bool, detalle: str = "") -> None:
    global fallos
    if cond:
        print(f"  ok   {nombre}")
    else:
        fallos += 1
        print(f"  FAIL {nombre}" + (f"\n       {detalle}" if detalle else ""))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    tmp = Path(tempfile.mkdtemp(prefix="motion-web-"))
    try:
        root = tmp / "web"
        shutil.copytree(FIXTURE, root)
        r = str(root)

        c, o = run("--root", r, "--check")
        comprobar("--check antes de instalar sale con 1", c == 1 and "FALTA" in o, o)

        c, o = run("--root", r)
        copiados = o.count("copiado")
        comprobar("instalar sale con 0", c == 0, o)
        files = archivos_del_kit()
        comp_kit = sorted(p.name for p in (INSTALL.parent / "components").iterdir() if p.suffix in (".ts", ".tsx"))
        en_files = sorted(Path(s).name for s in files if Path(s).parent.name == "components")
        comprobar("FILES de install_kit.py lista todos los componentes del kit", comp_kit == en_files,
                  f"kit: {comp_kit}\n       FILES: {en_files}")
        comprobar(f"instalar copia los {len(files)} archivos del kit", copiados == len(files), f"copiados: {copiados}\n{o}")
        css = (root / "src/app/globals.css").read_text(encoding="utf-8")
        comprobar("globals.css importa motion.css una vez", css.count('@import "./motion.css";') == 1, css)
        comprobar("motion.css instalado es idéntico al del kit",
                  (root / "src/app/motion.css").read_bytes() == (INSTALL.parent / "styles" / "motion.css").read_bytes())

        c, o = run("--root", r, "--check")
        comprobar("--check después de instalar sale con 0", c == 0 and "Kit al día" in o, o)

        antes = huella(root)
        c, o = run("--root", r)
        despues = huella(root)
        comprobar("segunda instalación sale con 0", c == 0, o)
        comprobar("segunda instalación no copia ni edita", "copiado" not in o and "editado" not in o, o)
        comprobar("segunda instalación no cambia ni un byte", antes == despues,
                  str({k for k in set(antes) | set(despues) if antes.get(k) != despues.get(k)}))

        (root / "src/components/motion/steps.tsx").write_text("// alterado\n", encoding="utf-8")
        c, o = run("--root", r, "--check")
        comprobar("--check detecta un archivo alterado", c == 1 and "DESACTUALIZADO" in o, o)
        c, o = run("--root", r)
        c2, o2 = run("--root", r, "--check")
        comprobar("reinstalar repara el archivo alterado", c == 0 and c2 == 0, o + o2)

        nuevo = "src/components/motion/section-heading.tsx"
        (root / nuevo).unlink()
        c, o = run("--root", r, "--check")
        comprobar("--check informa FALTA si falta un componente", c == 1 and f"[FALTA] {nuevo}" in o, o)
        c, o = run("--root", r)
        comprobar("reinstalar copia el componente que faltaba", c == 0 and (root / nuevo).exists(), o)

        blog = root / "src/components/blog.tsx"
        blog.write_text("export const x = 1;\n", encoding="utf-8")
        c, o = run("--root", r, "--check", "--blog-file", "src/components/blog.tsx")
        comprobar("--blog-file sin conectar sale con 1", c == 1 and "blog sin conectar" in o, o)
        blog.write_text("const blogRemarkPlugins = [];\n", encoding="utf-8")
        c, o = run("--root", r, "--check", "--blog-file", "src/components/blog.tsx")
        comprobar("--blog-file conectado sale con 0", c == 0, o)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"nivel 2 (instalador): {fallos} fallos")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
