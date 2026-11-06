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
