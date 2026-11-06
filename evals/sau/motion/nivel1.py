#!/usr/bin/env python3
"""Nivel 1 del banco de motion: reglas estáticas del kit (sin navegador, sin red).

Uso:
    python nivel1.py                       # comprueba el kit real del plugin sau
    python nivel1.py --director <carpeta>  # otra carpeta con la misma forma que motion-director
                                           # (kit/, motion-catalog.md); la usa autoprueba.py

Salida: una línea `ok`/`FAIL`/`aviso` por comprobación. Código 0 si no hay FAIL.
Solo usa la biblioteca estándar de Python 3.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
DIRECTOR_REAL = AQUI.parents[2] / "plugins" / "sau" / "skills" / "motion-director"

# Propiedades permitidas dentro de @keyframes.
PERMITIDAS = {"transform", "opacity", "animation-timing-function"}
# Propiedades que se avisan pero no fallan (decisión de diseño pendiente).
AVISO = {"offset-path", "offset-distance", "offset-rotate", "offset-anchor", "offset"}

resultados: list[tuple[str, str, str]] = []  # (estado, comprobación, detalle)


def anotar(estado: str, nombre: str, detalle: str = "") -> None:
    resultados.append((estado, nombre, detalle))


# ---------------------------------------------------------------- CSS
class Bloque:
    def __init__(self, preludio: str, padre: "Bloque | None"):
        self.preludio = preludio.strip()
        self.padre = padre
        self.decls: list[tuple[str, str]] = []
        self.hijos: list["Bloque"] = []

    def ancestros(self) -> list[str]:
        out, b = [], self.padre
        while b is not None and b.padre is not None:
            out.append(b.preludio)
            b = b.padre
        return out


def quitar_comentarios(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def parsear_css(css: str) -> Bloque:
    """Parser mínimo de CSS con anidamiento de at-rules. Respeta paréntesis y comillas."""
    css = quitar_comentarios(css)
    raiz = Bloque("", None)
    actual = raiz
    buf: list[str] = []
    paren = 0
    comilla = ""
    for ch in css:
        if comilla:
            buf.append(ch)
            if ch == comilla:
                comilla = ""
            continue
        if ch in "\"'":
            comilla = ch
            buf.append(ch)
        elif ch == "(":
            paren += 1
            buf.append(ch)
        elif ch == ")":
            paren -= 1
            buf.append(ch)
        elif ch == "{" and paren == 0:
            nuevo = Bloque("".join(buf), actual)
            actual.hijos.append(nuevo)
            actual = nuevo
            buf = []
        elif ch == "}" and paren == 0:
            _volcar_decl(actual, "".join(buf))
            buf = []
            if actual.padre is not None:
                actual = actual.padre
        elif ch == ";" and paren == 0:
            _volcar_decl(actual, "".join(buf))
            buf = []
        else:
            buf.append(ch)
    return raiz


def _volcar_decl(bloque: Bloque, texto: str) -> None:
    texto = texto.strip()
    if not texto or ":" not in texto or texto.startswith("@"):
        return
    prop, _, valor = texto.partition(":")
    bloque.decls.append((prop.strip().lower(), valor.strip()))


def recorrer(b: Bloque):
    yield b
    for h in b.hijos:
        yield from recorrer(h)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower())


def comprobar_css(css_path: Path) -> None:
    css = css_path.read_text(encoding="utf-8")
    raiz = parsear_css(css)
    bloques = list(recorrer(raiz))

    # 1. @keyframes: solo transform y opacity
    keyframes = [b for b in bloques if b.preludio.lower().startswith("@keyframes")]
    if not keyframes:
        anotar("FAIL", "css: hay @keyframes", f"ninguno en {css_path.name}")
    malos, avisos = [], []
    for kf in keyframes:
        nombre = kf.preludio.split(None, 1)[1] if " " in kf.preludio else kf.preludio
        for frame in kf.hijos:
            for prop, _ in frame.decls:
                if prop in AVISO:
                    avisos.append(f"{nombre}/{frame.preludio}: {prop}")
                elif prop not in PERMITIDAS:
                    malos.append(f"{nombre}/{frame.preludio}: {prop}")
    if malos:
        anotar("FAIL", "css: @keyframes solo anima transform y opacity", "; ".join(malos))
    else:
        anotar("ok", f"css: {len(keyframes)} @keyframes solo animan transform y opacity")
    for a in avisos:
        anotar("aviso", "css: @keyframes usa propiedad de trayectoria (decidir en el diseño)", a)

    # 2. sin bucles ni iteration-count > 1
    bucles = []
    for b in bloques:
        for prop, valor in b.decls:
            if prop == "animation-iteration-count" or prop == "animation":
                v = re.sub(r"(var|calc)\([^)]*\)", " ", valor.lower())
                tokens = re.split(r"[\s,]+", v.strip())
                if "infinite" in tokens:
                    bucles.append(f"{b.preludio or 'raíz'}: {prop}: {valor} (infinite)")
                for t in tokens:
                    if re.fullmatch(r"\d+(\.\d+)?", t) and float(t) > 1:
                        bucles.append(f"{b.preludio or 'raíz'}: {prop}: {valor} (repeticiones {t})")
    if bucles:
        anotar("FAIL", "css: ninguna animación en bucle ni con más de 1 repetición", "; ".join(bucles))
    else:
        anotar("ok", "css: ninguna animación en bucle ni con más de 1 repetición")

    # 3. toda regla que aplica animación va dentro de @supports(animation-timeline: view())
    #    y de @media (prefers-reduced-motion: no-preference). `animation: none` no anima y se exime.
    fuera = []
    n_anim = 0
    for b in bloques:
        for prop, valor in b.decls:
            if not prop.startswith("animation"):
                continue
            if prop == "animation" and valor.strip().lower() == "none":
                continue
            if prop == "animation-name" and valor.strip().lower() == "none":
                continue
            if b.padre is not None and b.padre.preludio.lower().startswith("@keyframes"):
                continue  # animation-timing-function dentro de un fotograma
            if b.preludio.lower().startswith("@keyframes") or (
                b.padre and b.padre.padre and b.padre.preludio.lower().startswith("@keyframes")
            ):
                continue
            n_anim += 1
            anc = [norm(a) for a in b.ancestros()]
            tiene_supports = any(
                a.startswith("@supports") and re.search(r"animation-timeline:\s*view\(\)", a)
                for a in anc
            )
            tiene_media = any(
                a.startswith("@media") and "prefers-reduced-motion: no-preference" in a for a in anc
            )
            if not (tiene_supports and tiene_media):
                falta = []
                if not tiene_supports:
                    falta.append("@supports (animation-timeline: view())")
                if not tiene_media:
                    falta.append("@media (prefers-reduced-motion: no-preference)")
                fuera.append(f"`{b.preludio}` {prop} sin {' ni '.join(falta)}")
    if fuera:
        anotar("FAIL", "css: animaciones solo dentro de @supports(view()) y reduced-motion: no-preference", "; ".join(sorted(set(fuera))))
    elif n_anim == 0:
        anotar("FAIL", "css: hay reglas con animación", "no se encontró ninguna declaración animation*")
    else:
        anotar("ok", f"css: {n_anim} declaraciones de animación, todas bajo @supports(view()) y no-preference")


# ---------------------------------------------------------------- componentes
PROHIBIDO_TSX = [
    (r"""["']use client["']""", '"use client"'),
    (r"\buse(State|Effect|LayoutEffect|Ref|Reducer|InsertionEffect)\b", "hook de estado/efecto/ref"),
    (r"""from\s+["'](framer-motion|motion|motion/react)["']""", "framer-motion / motion"),
    (r"""import\(\s*["'](framer-motion|motion)""", "import dinámico de framer-motion"),
    (r"\b(window|document)\.", "acceso a window/document"),
]


def sin_comentarios_js(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"(?m)^\s*//.*$", "", src)


def comprobar_componentes(comp_dir: Path) -> list[Path]:
    archivos = sorted(p for p in comp_dir.iterdir() if p.suffix in (".tsx", ".ts", ".jsx", ".js"))
    if not archivos:
        anotar("FAIL", "componentes: hay archivos", f"carpeta vacía: {comp_dir}")
    malos = []
    for p in archivos:
        src = sin_comentarios_js(p.read_text(encoding="utf-8"))
        for patron, nombre in PROHIBIDO_TSX:
            if re.search(patron, src):
                malos.append(f"{p.name}: {nombre}")
    if malos:
        anotar("FAIL", "componentes: sin JavaScript de navegador", "; ".join(malos))
    else:
        anotar("ok", f"componentes: {len(archivos)} archivos sin use client, hooks ni framer-motion")
    return archivos


# ---------------------------------------------------------------- coherencia
def nombres_exportados(index_ts: str) -> set[str]:
    nombres: set[str] = set()
    for m in re.finditer(r"export\s*\{([^}]*)\}", index_ts):
        for n in m.group(1).split(","):
            n = n.strip().split(" as ")[-1].strip()
            if n:
                nombres.add(n)
    return nombres


def nombres_definidos(archivos: list[Path]) -> set[str]:
    out: set[str] = set()
    for p in archivos:
        if p.name.startswith("index."):
            continue
        for m in re.finditer(r"export\s+(?:function|const)\s+([A-Z]\w*)", p.read_text(encoding="utf-8")):
            out.add(m.group(1))
    return out


def filas_resumen(catalogo: str) -> list[list[str]]:
    sec = re.search(r"## Resumen\n(.*?)(?=\n## )", catalogo, flags=re.S)
    filas = []
    if not sec:
        return filas
    for linea in sec.group(1).splitlines():
        if linea.startswith("|") and not re.match(r"\|[\s\-|]+\|?$", linea):
            celdas = [c.strip() for c in linea.strip().strip("|").split("|")]
            filas.append(celdas)
    return filas[1:]  # sin cabecera


def comprobar_coherencia(director: Path, archivos_comp: list[Path]) -> None:
    catalogo = (director / "motion-catalog.md").read_text(encoding="utf-8")
    index_ts = (director / "kit" / "components" / "index.ts").read_text(encoding="utf-8")
    remark_ts = (director / "kit" / "lib" / "remark-motion.ts").read_text(encoding="utf-8")

    filas = filas_resumen(catalogo)
    if not filas:
        anotar("FAIL", "coherencia: tabla «Resumen» del catálogo legible", "no se encontró")
        return
    exportados = nombres_exportados(index_ts)
    definidos = nombres_definidos(archivos_comp)

    # componentes del catálogo (columna 4) -> definidos y exportados
    del_catalogo: set[str] = set()
    for f in filas:
        if len(f) >= 4:
            del_catalogo |= set(re.findall(r"`(\w+)`", f[3]))
    sin_def = sorted(n for n in del_catalogo if n not in definidos)
    sin_exp = sorted(n for n in del_catalogo if n not in exportados)
    if sin_def:
        anotar("FAIL", "coherencia: cada componente del catálogo existe en kit/components", ", ".join(sin_def))
    else:
        anotar("ok", f"coherencia: los {len(del_catalogo)} componentes del catálogo existen en kit/components")
    if sin_exp:
        anotar("FAIL", "coherencia: cada componente del catálogo se exporta en index.ts", ", ".join(sin_exp))
    else:
        anotar("ok", "coherencia: todos los componentes del catálogo se exportan en index.ts")

    # a la inversa: lo exportado debe estar en el catálogo
    huerfanos = sorted(n for n in exportados if n not in del_catalogo)
    if huerfanos:
        anotar("FAIL", "coherencia: todo componente exportado está en el catálogo", ", ".join(huerfanos))
    else:
        anotar("ok", "coherencia: todo componente exportado está en el catálogo")

    # cada pieza del catálogo (columna 1) con su sintaxis
    # contenedores Markdown del catálogo (columna 5) <-> MOTION_CONTAINERS
    del_md: set[str] = set()
    for f in filas:
        if len(f) >= 5:
            del_md |= set(re.findall(r":{3,}([a-z][a-z-]*)", f[4]))
    m = re.search(r"MOTION_CONTAINERS\s*=\s*\[([^\]]*)\]", remark_ts)
    en_codigo = set(re.findall(r"""["']([a-z][a-z-]*)["']""", m.group(1))) if m else set()
    if not m:
        anotar("FAIL", "coherencia: MOTION_CONTAINERS legible en remark-motion.ts", "no se encontró")
        return
    solo_cat = sorted(del_md - en_codigo)
    solo_cod = sorted(en_codigo - del_md)
    if solo_cat or solo_cod:
        anotar(
            "FAIL",
            "coherencia: contenedores Markdown del catálogo == MOTION_CONTAINERS",
            f"solo en catálogo: {solo_cat or '-'}; solo en remark-motion.ts: {solo_cod or '-'}",
        )
    else:
        anotar("ok", f"coherencia: contenedores Markdown del catálogo == MOTION_CONTAINERS ({', '.join(sorted(en_codigo))})")


    # el registro del banco (piezas.json) cubre cada pieza del catálogo y sus fixtures existen
    import json
    registro = json.loads((AQUI / "piezas.json").read_text(encoding="utf-8"))["piezas"]
    cubiertas = {e["pieza"] for e in registro}
    piezas_cat = {re.sub(r"`", "", f[0]).strip() for f in filas if f and f[0].strip()}
    sin_registro = sorted(piezas_cat - cubiertas)
    if sin_registro:
        anotar("FAIL", "registro: cada pieza del catálogo está en evals/sau/motion/piezas.json", ", ".join(sin_registro))
    else:
        anotar("ok", f"registro: las {len(piezas_cat)} piezas del catálogo están en piezas.json ({len(registro)} casos)")
    faltan_md = sorted(
        e["markdown"] for e in registro
        if e.get("markdown") and not ((AQUI / "fixtures" / "markdown" / e["markdown"]).exists()
                                     and (AQUI / "fixtures" / "markdown" / e["markdown"].replace(".md", ".expected.html")).exists())
    )
    if faltan_md:
        anotar("FAIL", "registro: cada fixture Markdown y su .expected.html existen", ", ".join(faltan_md))
    else:
        anotar("ok", "registro: los fixtures Markdown registrados y sus .expected.html existen")
    # cada contenedor Markdown de nivel superior tiene fixture (columna es parte de comparativa)
    sin_fixture = sorted(c for c in (en_codigo - {"columna"}) if not any(e.get("markdown") == f"{c}.md" for e in registro))
    if sin_fixture:
        anotar("FAIL", "registro: cada contenedor Markdown tiene fixture registrado", ", ".join(sin_fixture))

    # el catálogo menciona cada contenedor con su ejemplo ```markdown
    # (avisar si una pieza de la tabla no tiene sección propia)
    for f in filas:
        pieza = re.sub(r"`", "", f[0]).strip()
        if pieza and not re.search(rf"^## `{re.escape(pieza)}`", catalogo, flags=re.M):
            anotar("FAIL", "coherencia: cada pieza de la tabla tiene su sección", pieza)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--director", default=str(DIRECTOR_REAL), help="carpeta con forma de motion-director")
    args = ap.parse_args()
    director = Path(args.director)

    css = director / "kit" / "styles" / "motion.css"
    comp = director / "kit" / "components"
    for ruta in (css, comp, director / "motion-catalog.md", director / "kit" / "lib" / "remark-motion.ts"):
        if not ruta.exists():
            print(f"FAIL  falta {ruta}")
            return 2

    comprobar_css(css)
    archivos = comprobar_componentes(comp)
    comprobar_coherencia(director, archivos)

    fallos = 0
    for estado, nombre, detalle in resultados:
        etiqueta = {"ok": "  ok   ", "FAIL": "  FAIL ", "aviso": "  aviso"}[estado]
        print(f"{etiqueta} {nombre}" + (f"  -> {detalle}" if detalle else ""))
        fallos += estado == "FAIL"
    n_ok = sum(1 for e, _, _ in resultados if e == "ok")
    n_av = sum(1 for e, _, _ in resultados if e == "aviso")
    print(f"nivel 1: {n_ok} ok, {fallos} fallos, {n_av} avisos")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
