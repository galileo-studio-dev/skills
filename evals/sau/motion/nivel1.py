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


def filas_resumen(catalogo: str, titulo: str = "Resumen") -> list[list[str]]:
    sec = re.search(rf"## {titulo}[^\n]*\n(.*?)(?=\n## |\Z)", catalogo, flags=re.S)
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

    asignables = filas_resumen(catalogo)
    if not asignables:
        anotar("FAIL", "coherencia: tabla «Resumen» del catálogo legible", "no se encontró")
        return
    # «En prueba»: piezas en el kit que motion-director aún no asigna (falta el OK de Pelayo).
    # Cuentan para la coherencia kit <-> catálogo <-> banco igual que las de «Resumen».
    en_prueba = filas_resumen(catalogo, "En prueba")
    nombres_a = {re.sub(r"`", "", f[0]).strip() for f in asignables if f and f[0].strip()}
    nombres_p = {re.sub(r"`", "", f[0]).strip() for f in en_prueba if f and f[0].strip()}
    if nombres_a & nombres_p:
        anotar("FAIL", "coherencia: ninguna pieza está a la vez en «Resumen» y en «En prueba»", ", ".join(sorted(nombres_a & nombres_p)))
    if en_prueba:
        anotar("ok", f"coherencia: {len(nombres_p)} piezas en prueba, separadas de las {len(nombres_a)} asignables")
        skill = director / "SKILL.md"
        if not (skill.exists() and "En prueba" in skill.read_text(encoding="utf-8")):
            anotar("FAIL", "coherencia: SKILL.md de motion-director dice que no asigna las piezas «En prueba»", "falta la mención en SKILL.md")
    filas = asignables + en_prueba
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


# ---------------------------------------------------------------- contratos de las piezas (N1)
# Clase raíz de cada componente: debe estar en la regla `.overflow-x-hidden:has(…)` de motion.css.
CLASE_RAIZ = {
    "reveal.tsx": "motion-reveal",
    "steps.tsx": "motion-steps",
    "comparison.tsx": "motion-compare",
    "pull-quote.tsx": "motion-pull-quote",
    "section-heading.tsx": "motion-heading",
    "bento.tsx": "motion-bento",
    "figures.tsx": "motion-figures",
    "rows.tsx": "motion-rows",
    "diagram.tsx": "motion-diagram",
    "orbit.tsx": "motion-orbit",
}
COLOR_LITERAL = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(")


def _etiqueta_con(src: str, clase: str) -> list[str]:
    """Etiquetas JSX de apertura que contienen `clase` (pueden ocupar varias líneas)."""
    return re.findall(rf"<[a-zA-Z][^<>]*?\b{re.escape(clase)}\b[^<>]*>", src, flags=re.S)


def _sin_not(selector: str) -> str:
    out, i = "", 0
    while i < len(selector):
        if selector.startswith(":not(", i):
            prof, i = 1, i + 5
            while i < len(selector) and prof:
                prof += {"(": 1, ")": -1}.get(selector[i], 0)
                i += 1
        else:
            out += selector[i]
            i += 1
    return out


def _dentro_de_animacion(b: Bloque) -> bool:
    anc = [norm(a) for a in b.ancestros()]
    return any(a.startswith("@supports") and "animation-timeline" in a for a in anc) and any(
        a.startswith("@media") and "prefers-reduced-motion: no-preference" in a for a in anc
    )


def _animaciones(b: Bloque) -> list[str]:
    nombres = []
    for prop, valor in b.decls:
        if prop in ("animation", "animation-name"):
            nombres += re.findall(r"\bmotion-[a-z-]+\b", valor)
    return nombres


def _props_keyframes(bloques: list[Bloque], nombre: str) -> set[str]:
    props: set[str] = set()
    for kf in bloques:
        if kf.preludio.lower().startswith("@keyframes") and kf.preludio.split()[-1] == nombre:
            for fr in kf.hijos:
                props |= {p for p, _ in fr.decls if p != "animation-timing-function"}
    return props


def _decl(b: Bloque, prop: str) -> str | None:
    vals = [v for p, v in b.decls if p == prop]
    return norm(vals[-1]).strip() if vals else None


def comprobar_contratos(director: Path) -> None:
    kit = director / "kit"
    comp = kit / "components"
    css = (kit / "styles" / "motion.css").read_text(encoding="utf-8")
    bloques = list(recorrer(parsear_css(css)))
    install = (kit / "install_kit.py").read_text(encoding="utf-8")
    reglas = [b for b in bloques if b.preludio and not b.preludio.startswith("@") and b.padre is not None
              and not (b.padre.preludio.lower().startswith("@keyframes"))]

    # Todo componente del kit lo instala install_kit.py.
    sin_instalar = sorted(p.name for p in comp.iterdir() if p.suffix in (".tsx", ".ts") and f'"{p.name}"' not in install)
    if sin_instalar:
        anotar("FAIL", "contrato: install_kit.py (FILES) lista cada archivo de kit/components", ", ".join(sin_instalar))
    else:
        anotar("ok", "contrato: install_kit.py (FILES) lista cada archivo de kit/components")

    # La clase raíz de cada pieza está en la regla de contenedor de página.
    has = re.search(r"\.overflow-x-hidden:has\(([^)]*)\)", css)
    en_has = set(re.findall(r"\.(motion-[a-z-]+)", has.group(1))) if has else set()
    faltan = sorted(c for f, c in CLASE_RAIZ.items() if (comp / f).exists() and c not in en_has)
    if faltan:
        anotar("FAIL", "contrato: la clase raíz de cada pieza está en .overflow-x-hidden:has(…)", ", ".join(faltan))
    else:
        anotar("ok", "contrato: la clase raíz de cada pieza está en .overflow-x-hidden:has(…)")

    def fallo_si(cond: bool, nombre: str, detalle: str = "") -> None:
        anotar("FAIL" if cond else "ok", nombre, detalle if cond else "")

    # Ninguna pieza crea un contenedor de scroll dentro de sí (overflow hidden/auto/scroll):
    # view() de sus hijos mediría contra él y la animación no correría (regla 2.8). Usar `clip`.
    scroll = [f"{b.preludio}: {p}: {v}" for b in reglas for p, v in b.decls
              if p in ("overflow", "overflow-x", "overflow-y") and re.search(r"\b(hidden|auto|scroll)\b", v)]
    fallo_si(bool(scroll), "contrato: ninguna pieza usa overflow hidden/auto/scroll (usar clip)", "; ".join(scroll))

    def solo_transform(clase: str) -> list[str]:
        malos = []
        for b in reglas:
            if clase in b.preludio:
                for n in _animaciones(b):
                    extra = _props_keyframes(bloques, n) - {"transform"}
                    if extra:
                        malos.append(f"{b.preludio}: {n} anima {', '.join(sorted(extra))}")
        return malos

    # Líneas y trazos que se dibujan con el scroll (draw-x, draw-y, grow): curva lineal, no la de marca
    # (revisión estética v1, F-4: con expo.out un trazo corto se lee como un salto).
    no_lineal = []
    for b in reglas:
        nombres = set(_animaciones(b)) & {"motion-draw-x", "motion-draw-y", "motion-grow"}
        if nombres:
            tf = _decl(b, "animation-timing-function")
            if tf is not None and tf != "linear":
                no_lineal.append(f"{b.preludio}: {tf}")
    fallo_si(bool(no_lineal), "contrato: las líneas que se dibujan con el scroll van con curva lineal", "; ".join(no_lineal))

    # encabezado-seccion
    f = comp / "section-heading.tsx"
    if f.exists():
        src = sin_comentarios_js(f.read_text(encoding="utf-8"))
        for clase in ("motion-kicker-index", "motion-kicker-line"):
            tags = _etiqueta_con(src, clase)
            fallo_si(not tags or any('aria-hidden="true"' not in t for t in tags),
                     f"contrato encabezado-seccion: «{clase}» lleva aria-hidden=\"true\"", f"{tags or 'no encontrado'}")
        fallo_si(not (re.search(r'as\?:\s*"h2"\s*\|\s*"h3"', src) and re.search(r'as:\s*\w+\s*=\s*"h2"', src)),
                 "contrato encabezado-seccion: el título va en h2 (o h3 con `as`)")
        malos = solo_transform("motion-kicker-line")
        fallo_si(bool(malos) or not any("motion-kicker-line" in b.preludio and _animaciones(b) for b in reglas),
                 "contrato encabezado-seccion: .motion-kicker-line anima solo transform", "; ".join(malos) or "sin animación")
        fallo_si(not any(re.search(r"\.motion-heading\s*$", b.preludio) and "--motion-heading" in (_decl(b, "view-timeline") or "")
                         for b in reglas),
                 "contrato encabezado-seccion: .motion-heading declara view-timeline: --motion-heading")

    # bento
    f = comp / "bento.tsx"
    if f.exists():
        src = sin_comentarios_js(f.read_text(encoding="utf-8"))
        tags = _etiqueta_con(src, "motion-bento-icon")
        fallo_si(not tags or any('aria-hidden="true"' not in t for t in tags), "contrato bento: el icono lleva aria-hidden=\"true\"")
        fallo_si("motion-bento-body" not in src, "contrato bento: BentoItem envuelve el contenido en .motion-bento-body")
        fallo_si(bool(re.search(r"\bindex\b|--motion-index", src)), "contrato bento: sin `index` ni --motion-index (el escalonado es CSS)")
        malos = []
        for b in reglas:
            if not _animaciones(b):
                continue
            for s in b.preludio.split(","):
                s2 = _sin_not(s)
                if "motion-bento" in s2 and re.search(r'data-variant="?grid"?', s2) and re.search(r"\bli\s*$", s2.strip()):
                    malos.append(s.strip())
        fallo_si(bool(malos), "contrato bento: la variante grid no anima la celda (li), solo .motion-bento-body", "; ".join(malos))

    # cifras
    f = comp / "figures.tsx"
    if f.exists():
        src = sin_comentarios_js(f.read_text(encoding="utf-8"))
        fallo_si(bool(re.search(r"requestAnimationFrame|setInterval|setTimeout", src)), "contrato cifras: sin contador (ni requestAnimationFrame ni temporizadores)")
        malos = [b.preludio for b in reglas if "motion-figure-value" in b.preludio
                 and (_decl(b, "overflow") or "").startswith("clip") and not _dentro_de_animacion(b)]
        fallo_si(bool(malos), "contrato cifras: .motion-figure-value solo recorta (overflow: clip) dentro de @supports … no-preference", "; ".join(malos))

    # filas
    f = comp / "rows.tsx"
    if f.exists():
        antes = [b for b in reglas if "motion-rows" in b.preludio and "::before" in b.preludio]
        fallo_si(not any(_decl(b, "content") in ('""', "''") for b in antes), "contrato filas: el separador es ::before con content: \"\"")
        malos = [m for m in solo_transform("motion-rows") if "::before" in m.rsplit(": motion-", 1)[0]]
        fallo_si(bool(malos), "contrato filas: el separador solo anima transform", "; ".join(malos))

    # esquema
    f = comp / "diagram.tsx"
    if f.exists():
        src = sin_comentarios_js(f.read_text(encoding="utf-8"))
        svgs = re.findall(r"<svg\b[^<>]*>", src, flags=re.S)
        fallo_si(not svgs or any('aria-hidden="true"' not in s for s in svgs), "contrato esquema: el svg de conectores lleva aria-hidden=\"true\"")
        fallo_si(bool(re.search(r"stroke-dash(offset|array)", quitar_comentarios(css))),
                 "contrato esquema: motion.css no usa stroke-dashoffset ni stroke-dasharray")
        fallo_si(not re.search(r"\bcaption:\s*string", src), "contrato esquema: `caption` es obligatorio en el tipo")
        fallo_si(not re.search(r"nodes\.length\s*<\s*3\s*\|\|\s*nodes\.length\s*>\s*7", src) or "throw new Error" not in src,
                 "contrato esquema: el componente rechaza menos de 3 o más de 7 nodos")
        fallo_si("<figcaption" not in src, "contrato esquema: lleva figcaption")
        # Revisión estética F-2: el conector va a la par con su nodo destino (paso del destino − 0,6),
        # y los cortados o discontinuos entran con fundido (nunca escalan: el patrón de guiones se deformaría).
        fallo_si(not re.search(r"step\.get\(e\.to\)!?\s*-\s*0\.6", src),
                 "contrato esquema: el paso de cada conector es el de su nodo destino − 0,6")
        fallo_si(not any('data-kind="wire"' in b.preludio and "motion-grow" in _animaciones(b) for b in reglas)
                 or any("line" in b.preludio and 'data-kind="wire"' not in b.preludio and "motion-grow" in _animaciones(b) for b in reglas),
                 "contrato esquema: solo los cables normales crecen; cortados y discontinuos entran con fundido")

    # órbita
    f = comp / "orbit.tsx"
    if f.exists():
        src_raw = f.read_text(encoding="utf-8")
        src = sin_comentarios_js(src_raw)
        fallo_si(bool(re.search(r"animateMotion|requestAnimationFrame|framer-motion", src)),
                 "contrato órbita: sin animateMotion, requestAnimationFrame ni framer-motion")
        orb = [b for b in reglas if "motion-orbit" in b.preludio]
        malos = []
        for b in orb:
            for prop, valor in b.decls:
                v = valor.lower()
                if prop.startswith("animation") and ("infinite" in v or (prop in ("animation", "animation-duration") and re.search(r"\b\d*\.?\d+m?s\b", v))):
                    malos.append(f"{b.preludio}: {prop}: {valor}")
        fallo_si(bool(malos), "contrato órbita: sin infinite ni duración en segundos (todo con animation-timeline)", "; ".join(malos))

        def firma(nombre: str) -> set[tuple]:
            out = set()
            for b in orb:
                if nombre in _animaciones(b):
                    anim = _decl(b, "animation") or ""
                    tf = _decl(b, "animation-timing-function") or ("linear" if re.search(r"\blinear\b", anim) else "?")
                    out.add((_decl(b, "animation-timeline"), _decl(b, "animation-range"), tf))
            return out
        s1, s2 = firma("motion-orbit-spin"), firma("motion-orbit-counter")
        fallo_si(not s1 or s1 != s2, "contrato órbita: spin y counter con la misma línea de tiempo, rango y curva",
                 f"spin {sorted(map(str, s1))} / counter {sorted(map(str, s2))}")
        tags = _etiqueta_con(src, "motion-orbit-stage")
        fallo_si(not tags or any('aria-hidden="true"' not in t for t in tags) or "<figcaption" not in src,
                 "contrato órbita: el escenario lleva aria-hidden=\"true\" y hay figcaption")
        fallo_si(not re.search(r"\bcaption:\s*string", src), "contrato órbita: `caption` es obligatorio en el tipo")
        fallo_si(not re.search(r"outer\.length\s*<\s*1\s*\|\|\s*outer\.length\s*>\s*4", src) or "throw new Error" not in src,
                 "contrato órbita: el componente exige de 1 a 4 nodos exteriores")
        lit = [b.preludio for b in orb if any(COLOR_LITERAL.search(v) for _, v in b.decls)]
        lit += ["orbit.tsx"] if COLOR_LITERAL.search(src) else []
        fallo_si(bool(lit), "contrato órbita: sin colores literales (#…, rgb(…)) en orbit.tsx ni en .motion-orbit*", "; ".join(lit))


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
    comprobar_contratos(director)

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
