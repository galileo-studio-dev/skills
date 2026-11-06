// Nivel 2 (remark): cada fixtures/markdown/*.md pasa por el plugin real del kit
// (kit/lib/remark-motion.ts) y su HTML debe ser igual a *.expected.html.
// Con --escribir regenera los .expected.html (revisarlos a mano antes de commitear).
// Requiere Node >= 22.6 (quita los tipos de .ts sin dependencias) y `npm install` en banco-web.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const aqui = dirname(fileURLToPath(import.meta.url));
const motion = resolve(aqui, "..", "..");
const fixtures = join(motion, "fixtures", "markdown");
const director = process.env.MOTION_DIRECTOR || resolve(motion, "..", "..", "..", "plugins", "sau", "skills", "motion-director");
const { remarkMotion, MOTION_CONTAINERS } = await import(
  pathToFileURL(join(director, "kit", "lib", "remark-motion.ts")).href
);

const escribir = process.argv.includes("--escribir");
const procesador = unified()
  .use(remarkParse)
  .use(remarkDirective)
  .use(remarkMotion)
  .use(remarkRehype)
  .use(rehypeStringify);

const normalizar = (s) => s.replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
let fallos = 0;
let n = 0;

for (const f of readdirSync(fixtures).filter((x) => x.endsWith(".md")).sort()) {
  const html = String(await procesador.process(readFileSync(join(fixtures, f), "utf8")));
  const esperado = join(fixtures, f.replace(/\.md$/, ".expected.html"));
  if (escribir) {
    let previo = null;
    try { previo = readFileSync(esperado, "utf8"); } catch { /* nuevo */ }
    if (previo !== null && normalizar(previo) === normalizar(html)) continue; // sin cambios: no tocar
    writeFileSync(esperado, html);
    console.log(`  escrito ${f.replace(/\.md$/, ".expected.html")}`);
    continue;
  }
  n++;
  let esperadoTxt;
  try {
    esperadoTxt = readFileSync(esperado, "utf8");
  } catch {
    console.log(`  FAIL ${f}: falta ${esperado}`);
    fallos++;
    continue;
  }
  if (normalizar(html) === normalizar(esperadoTxt)) {
    console.log(`  ok   ${f}`);
  } else {
    fallos++;
    console.log(`  FAIL ${f}\n       esperado: ${normalizar(esperadoTxt)}\n       obtenido: ${normalizar(html)}`);
  }
}

// Comprobaciones semánticas que no dependen de la forma exacta del HTML.
if (!escribir) {
  const leer = async (f) => String(await procesador.process(readFileSync(join(fixtures, f), "utf8")));
  const reglas = [
    ["bloque desconocido: sin data-motion", !(await leer("bloque-desconocido.md")).includes("data-motion")],
    ["bloque desconocido: el contenido sigue", (await leer("bloque-desconocido.md")).includes("Este contenido debe verse igualmente")],
    ["directivas de texto: «Nota:importante» se conserva", (await leer("directivas-de-texto.md")).includes("Nota:importante")],
    ["directivas de texto: sin data-motion", !(await leer("directivas-de-texto.md")).includes("data-motion")],
    ["cada contenedor de MOTION_CONTAINERS tiene fixture o es columna", MOTION_CONTAINERS.every((c) => c === "columna" || existe(c))],
  ];
  // Contratos N2 de las piezas en prueba (solo si su contenedor ya existe en el kit).
  const cuenta = (s, re) => (s.match(re) || []).length;
  if (MOTION_CONTAINERS.includes("bento")) {
    const b = await leer("bento.md");
    const m = await leer("bento-atributos.md");
    reglas.push(
      ["bento: div[data-motion=bento][data-columns=3][data-numbered] con ul de 3 li",
        /<div data-motion="bento" data-columns="3" data-numbered="">\s*<ul>/.test(b) && cuenta(b, /<li>/g) === 3],
      ["bento: columnas=9 y color=rojo no producen atributos", !/data-columns|data-color|color=/.test(m) && cuenta(m, /data-motion="bento"/g) === 2],
      ["bento: con atributos malos el contenido sigue", m.includes("Atributo desconocido.") && m.includes("Columnas fuera de rango.")],
    );
  }
  if (MOTION_CONTAINERS.includes("cifras")) {
    const f = await leer("cifras.md");
    const c = await leer("cifras-casos.md");
    const valores = [...f.matchAll(/<dd class="motion-figure-value"><span class="motion-mask-inner">(.*?)<\/dd>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, ""));
    reglas.push(["cifras: la unidad va en span.motion-figure-unit («GB», «%»)",
      cuenta(f, /<span class="motion-figure-unit"> (GB|%)<\/span>/g) === 2]);
    const negritas = [...readFileSync(join(fixtures, "cifras.md"), "utf8").matchAll(/^- \*\*([^*]+)\*\*/gm)].map((m) => m[1]);
    reglas.push(
      ["cifras: dl > div ×3, cada uno con dt y dd.motion-figure-value > span.motion-mask-inner",
        f.includes("<dl>") && cuenta(f, /<div>\s*<dt>[^<]+<\/dt>\s*<dd class="motion-figure-value"><span class="motion-mask-inner">/g) === 3],
      ["cifras: el texto de cada negrita es idéntico al original (salvo espacios finos U+202F)", valores.length === 3 && valores.join("|").replace(/\u202F/g, " ") === negritas.join("|")],
      ["cifras: los espacios de la cifra pasan a espacio fino sin salto (U+202F)", valores.some((v) => v.includes("\u202F")) && valores.every((v) => !v.includes(" "))],
      ["cifras: un elemento sin negrita no lleva .motion-figure-value y la página sigue",
        cuenta(c, /motion-figure-value/g) === 1 && c.includes("<dt>Elemento sin negrita: se queda como texto, sin máscara.</dt>")],
    );
  }
  if (MOTION_CONTAINERS.includes("filas")) {
    const f = await leer("filas.md");
    const c = await leer("filas-casos.md");
    reglas.push(
      ["filas: dl con 3 div > dt + dd", cuenta(f, /<div>\s*<dt>[^<]+<\/dt>\s*<dd>/g) === 3 && f.includes("<dl>")],
      ["filas: la etiqueta pierde el punto final", f.includes("<dt>RGPD</dt>")],
      ["filas: un enlace del texto queda dentro de dd", /<dd>[^]*?<a href="\/ia-onpremise">[^]*?<\/dd>/.test(c)],
      ["filas: un elemento sin negrita produce solo dd", /<div>\s*<dd>Fila sin negrita: solo texto\.<\/dd>\s*<\/div>/.test(c)],
    );
  }
  function existe(c) {
    return readdirSync(fixtures).some((x) => x === `${c}.md`);
  }
  for (const [nombre, ok] of reglas) {
    n++;
    if (ok) console.log(`  ok   ${nombre}`);
    else { fallos++; console.log(`  FAIL ${nombre}`); }
  }
  console.log(`nivel 2 (remark): ${n - fallos} ok, ${fallos} fallos`);
}
process.exit(fallos ? 1 : 0);
