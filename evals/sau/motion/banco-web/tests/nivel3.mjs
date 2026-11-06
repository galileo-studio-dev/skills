// Nivel 3 (navegador): Playwright contra el muestrario (`next start` sobre el build de banco-web).
// Antes: `node scripts/preparar.mjs && next build` (lo hace `npm run test:motion`).
// Salida: 0 todo en verde, 1 hay fallos, 2 no se pudo ejecutar (sin navegador / sin servidor).
// Variables: BANCO_PUERTO (3917), BANCO_SIN_FIREFOX=1 (no probar Firefox), BANCO_CAPTURAS=0 (sin capturas).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox } from "playwright";

const aqui = dirname(fileURLToPath(import.meta.url));
const web = resolve(aqui, "..");
const motion = resolve(web, "..");
const capturasDir = join(motion, "capturas");
const registro = JSON.parse(readFileSync(join(motion, "piezas.json"), "utf8")).piezas;
const PUERTO = process.env.BANCO_PUERTO || "3917";
const URL = `http://127.0.0.1:${PUERTO}/`;
const VIEW = { width: 1280, height: 800 };

let fallos = 0;
let oks = 0;
const ok = (m) => { oks++; console.log(`  ok   ${m}`); };
const bad = (m, d = "") => { fallos++; console.log(`  FAIL ${m}${d ? `\n       ${d}` : ""}`); };
const aviso = (m) => console.log(`  aviso ${m}`);
const check = (cond, m, d) => (cond ? ok(m) : bad(m, d));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- servidor
async function arrancarServidor() {
  if (!existsSync(join(web, ".next", "BUILD_ID"))) {
    console.log("  NO EJECUTADO: falta el build (.next). Ejecuta `npm run test:motion` en banco-web.");
    process.exit(2);
  }
  const hijo = spawn(process.execPath, [join(web, "node_modules", "next", "dist", "bin", "next"), "start", "-p", PUERTO, "-H", "127.0.0.1"], {
    cwd: web, stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  hijo.stdout.on("data", (d) => (log += d));
  hijo.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return { hijo, matar: () => matarArbol(hijo) };
    } catch { /* aún no */ }
    await esperar(500);
  }
  matarArbol(hijo);
  console.log(`  NO EJECUTADO: el servidor no arrancó en 60 s.\n${log}`);
  process.exit(2);
}

function matarArbol(hijo) {
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(hijo.pid), "/T", "/F"], { stdio: "ignore" });
    else hijo.kill("SIGKILL");
  } catch { /* ya terminado */ }
}

// ---------------------------------------------------------------- utilidades de página
const sel = (id) => `[data-pieza="${id}"]`;

async function desplazarA(page, y) {
  await page.evaluate((v) => window.scrollTo(0, v), Math.max(0, Math.round(y)));
  // Dos fotogramas: Chromium resuelve la línea de tiempo de scroll en el fotograma siguiente.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(120);
}

/** Desplaza la página para que el elemento quede con su borde superior a `top` px del viewport. */
async function colocar(page, handle, top) {
  const y = await handle.evaluate((el, t) => el.getBoundingClientRect().top + window.scrollY - t, top);
  await desplazarA(page, y);
}

/** Posición de diseño del elemento, sin la transformación de la animación (offsetTop no la incluye). */
async function posicionBase(page, handle) {
  return handle.evaluate((el) => {
    let y = 0;
    for (let e = el; e; e = e.offsetParent) y += e.offsetTop;
    return y;
  });
}

/** Coloca el elemento con su borde superior de DISEÑO a `top` px del viewport. */
async function colocarBase(page, base, top) {
  await desplazarA(page, base - top);
}

async function estado(handle) {
  return handle.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { opacity: parseFloat(cs.opacity), transform: cs.transform, anim: cs.animationName };
  });
}

const identidad = (t) => t === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t);

async function recorrerPagina(page, paso = 300) {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < alto; y += paso) await desplazarA(page, y);
  await desplazarA(page, alto);
}

// ---------------------------------------------------------------- comprobaciones
async function sinJavaScript(browser) {
  console.log("\n[sin JavaScript] todo el texto está en el HTML");
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: VIEW });
  const page = await ctx.newPage();
  await page.goto(URL);
  const texto = (await page.evaluate(() => document.body.textContent)).replace(/\s+/g, " ");
  for (const e of registro) {
    const hay = await page.locator(sel(e.id)).count();
    if (!hay) { bad(`${e.id}: existe <section data-pieza="${e.id}"> en el muestrario`); continue; }
    const faltan = e.textos.filter((t) => !texto.includes(t));
    check(faltan.length === 0, `${e.id}: ${e.textos.length} textos presentes con JS desactivado`, `faltan: ${faltan.join(" | ")}`);
  }
  const html = await (await fetch(URL)).text();
  check(!/<script[^>]*>[^<]*framer/i.test(html), "el HTML no arrastra framer-motion");
  await ctx.close();
}

async function h1YCls(browser) {
  console.log("\n[H1 y CLS] el H1 no se anima y no hay saltos de diseño");
  const ctx = await browser.newContext({ viewport: VIEW });
  await ctx.addInitScript(() => {
    window.__cls = 0;
    window.__shifts = [];
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) {
        if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push(e.value); }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const h1s = await page.locator("h1").count();
  check(h1s === 1, `hay exactamente un H1 (hay ${h1s})`);
  const alCargar = await page.locator("h1").evaluate((el) => ({
    nombre: getComputedStyle(el).animationName, n: el.getAnimations({ subtree: true }).length,
    dentro: !!el.closest("[class*=motion-], [data-motion]"),
  }));
  check(alCargar.nombre === "none" && alCargar.n === 0, "H1 sin animación al cargar", JSON.stringify(alCargar));
  check(!alCargar.dentro, "H1 fuera de cualquier pieza de motion");
  await recorrerPagina(page);
  const tras = await page.locator("h1").evaluate((el) => el.getAnimations({ subtree: true }).length);
  check(tras === 0, "H1 sin animación tras recorrer la página");
  await recorrerPagina(page, 150);
  const cls = await page.evaluate(() => ({ v: window.__cls, n: window.__shifts.length }));
  check(cls.v === 0, `CLS = 0 al hacer scroll (medido ${cls.v}, ${cls.n} desplazamientos)`);
  await ctx.close();
}

async function estadosInicialYFinal(browser) {
  console.log("\n[Chromium, movimiento normal] cada elemento animado entra y termina visible");
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const soporta = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
  if (!soporta) { bad("control: este Chromium no soporta animation-timeline; la prueba no vale"); await ctx.close(); return; }

  for (const e of registro) {
    for (const s of e.animados) {
      const els = await page.locator(`${sel(e.id)} ${s}`).elementHandles();
      if (!els.length) { bad(`${e.id}: «${s}» no encuentra elementos en el muestrario`); continue; }
      let inicioOk = true, finalOk = true, detalle = "";
      for (const [i, h] of els.entries()) {
        const base = await posicionBase(page, h);
        await colocarBase(page, base, VIEW.height - 1);
        const a = await estado(h);
        if (!(a.opacity < 1 || !identidad(a.transform))) { inicioOk = false; detalle += ` [${i}] inicio ${JSON.stringify(a)}`; }
        await colocarBase(page, base, VIEW.height * 0.15);
        const b = await estado(h);
        if (!(b.opacity === 1 && identidad(b.transform))) { finalOk = false; detalle += ` [${i}] final ${JSON.stringify(b)}`; }
      }
      check(inicioOk, `${e.id} «${s}» (${els.length}): empieza oculto o desplazado`, detalle);
      check(finalOk, `${e.id} «${s}» (${els.length}): termina con opacidad 1 y sin transformar`, detalle);
    }
  }
  await ctx.close();
}

async function movimientoReducido(browser) {
  console.log("\n[Chromium, prefers-reduced-motion: reduce] ninguna animación activa");
  // Control: con movimiento normal sí hay animaciones activas en mitad de una pieza.
  const normal = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  const pn = await normal.newPage();
  await pn.goto(URL, { waitUntil: "networkidle" });
  const h = await pn.locator(`${sel("pasos")} .motion-steps > ol > li`).first().elementHandle();
  await colocar(pn, h, VIEW.height * 0.5);
  const conMov = await pn.evaluate(() => document.getAnimations().length);
  check(conMov > 0, `control: con movimiento normal hay animaciones (${conMov})`);
  await normal.close();

  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  let maxAnim = 0, opacidadMin = 1;
  for (let y = 0; y <= alto; y += 250) {
    await desplazarA(page, y);
    const r = await page.evaluate(() => ({
      n: document.getAnimations().length,
      op: Math.min(...[...document.querySelectorAll("section[data-pieza] *")].map((e) => parseFloat(getComputedStyle(e).opacity))),
    }));
    maxAnim = Math.max(maxAnim, r.n);
    opacidadMin = Math.min(opacidadMin, r.op);
  }
  check(maxAnim === 0, `con reduce: 0 animaciones activas en todo el recorrido (máx. ${maxAnim})`);
  check(opacidadMin === 1, `con reduce: todo a opacidad 1 (mín. ${opacidadMin})`);
  const nombres = await page.evaluate(() =>
    [...document.querySelectorAll("[class*=motion-]")].map((e) => getComputedStyle(e).animationName).filter((n) => n !== "none").length);
  check(nombres === 0, "con reduce: animation-name computado = none en todas las piezas", `${nombres} con animación`);
  await ctx.close();
}

async function sinSoporteEmulado(browser) {
  console.log("\n[Chromium, sin animation-timeline emulado] todo visible y estático");
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  let reescritas = 0;
  await ctx.route("**/*.css", async (route) => {
    const resp = await route.fetch();
    let cuerpo = await resp.text();
    const antes = cuerpo;
    cuerpo = cuerpo.replace(/animation-timeline:\s*view\(\)\)/g, () => "animation-timeline:view-no-existe())");
    if (cuerpo !== antes) reescritas++;
    await route.fulfill({ response: resp, body: cuerpo });
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  check(reescritas > 0, "control: se reescribió la condición @supports del CSS servido");
  await verificarEstatico(page, "Chromium sin soporte");
  await ctx.close();
}

async function verificarEstatico(page, etiqueta) {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  let maxAnim = 0, peor = 1;
  for (let y = 0; y <= alto; y += 300) {
    await desplazarA(page, y);
    const r = await page.evaluate(() => ({
      n: document.getAnimations().length,
      op: Math.min(...[...document.querySelectorAll("section[data-pieza] *")].map((e) => parseFloat(getComputedStyle(e).opacity))),
    }));
    maxAnim = Math.max(maxAnim, r.n);
    peor = Math.min(peor, r.op);
  }
  check(maxAnim === 0, `${etiqueta}: 0 animaciones (máx. ${maxAnim})`);
  check(peor === 1, `${etiqueta}: todo el contenido a opacidad 1 (mín. ${peor})`);
  for (const e of registro) {
    const visible = await page.locator(sel(e.id)).first().evaluate((s) => {
      const r = s.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    check(visible, `${etiqueta}: ${e.id} ocupa espacio y es visible`);
  }
}

async function firefoxReal() {
  console.log("\n[Firefox] sin animation-timeline todo visible y con opacidad 1");
  if (process.env.BANCO_SIN_FIREFOX === "1") { aviso("omitido por BANCO_SIN_FIREFOX=1"); return; }
  if (!existsSync(firefox.executablePath())) {
    aviso("Firefox no instalado (`npx playwright install firefox`): NO EJECUTADO; queda la emulación en Chromium");
    return;
  }
  const br = await firefox.launch();
  try {
    const ctx = await br.newContext({ viewport: VIEW });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    const soporta = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
    if (soporta) {
      aviso("este Firefox sí soporta animation-timeline: se comprueba el estado final en lugar de la ausencia");
      for (const e of registro) {
        for (const s of e.animados) {
          for (const h of await page.locator(`${sel(e.id)} ${s}`).elementHandles()) {
            await colocar(page, h, VIEW.height * 0.15);
            const b = await estado(h);
            check(b.opacity === 1 && identidad(b.transform), `Firefox ${e.id} «${s}»: termina visible`, JSON.stringify(b));
          }
        }
      }
    } else {
      ok("Firefox no soporta animation-timeline: view() (caso real)");
      await verificarEstatico(page, "Firefox");
    }
    await ctx.close();
  } finally {
    await br.close();
  }
}

async function capturas(browser) {
  console.log("\n[capturas] inicio, mitad y final del recorrido de cada pieza");
  if (process.env.BANCO_CAPTURAS === "0") { aviso("omitidas por BANCO_CAPTURAS=0"); return; }
  mkdirSync(capturasDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  for (const e of registro) {
    const sec = await page.locator(sel(e.id)).first().elementHandle();
    const h = await sec.evaluate((el) => el.getBoundingClientRect().height);
    const base = await posicionBase(page, sec);
    // p = fracción de la pieza ya dentro del viewport desde abajo; la última toma la deja entera y centrada.
    for (const [nombre, p] of [["inicio", 0.1], ["mitad", 0.5], ["final", null]]) {
      const top = p === null ? Math.max(40, (VIEW.height - h) / 2) : VIEW.height - Math.min(p * h, VIEW.height - 40);
      await colocarBase(page, base, top);
      const y0 = Math.max(0, Math.floor(top - 70));
      const y1 = Math.min(VIEW.height, Math.ceil(top + h + 70));
      const clip = { x: 0, y: y0, width: VIEW.width, height: Math.max(120, y1 - y0) };
      await page.screenshot({ path: join(capturasDir, `${e.id}-${nombre}.png`), clip: { ...clip, height: Math.min(clip.height, VIEW.height - clip.y) } });
    }
  }
  await ctx.close();
  const total = readdirSync(capturasDir).filter((f) => f.endsWith(".png")).reduce((s, f) => s + statSync(join(capturasDir, f)).size, 0);
  ok(`${registro.length * 3} capturas en evals/sau/motion/capturas/ (${(total / 1024).toFixed(0)} KB)`);
}

// ---------------------------------------------------------------- principal
const servidor = await arrancarServidor();
let navegador = null;
try {
  try {
    navegador = await chromium.launch();
  } catch (err) {
    console.log(`  NO EJECUTADO: no se pudo lanzar Chromium (¿falta \`npx playwright install chromium\`?)\n${err.message.split("\n")[0]}`);
    process.exitCode = 2;
  }
  if (navegador) {
    await sinJavaScript(navegador);
    await h1YCls(navegador);
    await estadosInicialYFinal(navegador);
    await movimientoReducido(navegador);
    await sinSoporteEmulado(navegador);
    await firefoxReal();
    await capturas(navegador);
    console.log(`\nnivel 3: ${oks} ok, ${fallos} fallos`);
    process.exitCode = fallos ? 1 : 0;
  }
} finally {
  if (navegador) await navegador.close();
  servidor.matar();
}
