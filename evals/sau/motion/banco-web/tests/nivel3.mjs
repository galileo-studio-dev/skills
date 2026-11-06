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
            // Igual que en Chromium: posición de diseño (sin la escala de la propia animación).
            await colocarBase(page, await posicionBase(page, h), VIEW.height * 0.15);
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
  // 1280 (nombres de siempre, <id>-<fase>.png) y los anchos del revisor estético: 1440 y 390 (<id>-<ancho>-<fase>).
  // Las de 1440 y 390 van en JPEG (calidad 75) para que el total no pase de unos 2 MB.
  const anchos = [
    { vp: VIEW, sufijo: "", tipo: "png" },
    { vp: { width: 1440, height: 900 }, sufijo: "-1440", tipo: "jpeg" },
    { vp: { width: 390, height: 844 }, sufijo: "-390", tipo: "jpeg" },
  ];
  let n = 0;
  for (const { vp, sufijo, tipo } of anchos) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    for (const e of registro) {
      const sec = await page.locator(sel(e.id)).first().elementHandle();
      const h = await sec.evaluate((el) => el.getBoundingClientRect().height);
      const base = await posicionBase(page, sec);
      // p = fracción de la pieza ya dentro del viewport desde abajo; la última toma la deja entera y centrada.
      for (const [nombre, p] of [["inicio", 0.1], ["mitad", 0.5], ["final", null]]) {
        const top = p === null ? Math.max(40, (vp.height - h) / 2) : vp.height - Math.min(p * h, vp.height - 40);
        await colocarBase(page, base, top);
        const y0 = Math.max(0, Math.floor(top - 70));
        const y1 = Math.min(vp.height, Math.ceil(top + h + 70));
        const clip = { x: 0, y: y0, width: vp.width, height: Math.max(120, y1 - y0) };
        const ext = tipo === "png" ? "png" : "jpg";
        await page.screenshot({
          path: join(capturasDir, `${e.id}${sufijo}-${nombre}.${ext}`), type: tipo, ...(tipo === "jpeg" ? { quality: 75 } : {}),
          clip: { ...clip, height: Math.min(clip.height, vp.height - clip.y) },
        });
        n++;
      }
    }
    await ctx.close();
  }
  const total = readdirSync(capturasDir).filter((f) => /\.(png|jpg)$/.test(f)).reduce((s, f) => s + statSync(join(capturasDir, f)).size, 0);
  ok(`${n} capturas de inicio/mitad/final a 1280, 1440 y 390 px en evals/sau/motion/capturas/ (${(total / 1024).toFixed(0)} KB en total)`);
}

// ---------------------------------------------------------------- contratos de las piezas en prueba
// Cada pieza nueva trae su contrato de navegador (propuestas/2026-11-06-piezas-nuevas.md). Se
// ejecutan solo si su sección está en el muestrario.
const parseMatriz = (t) => {
  if (!t || t === "none") return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const n = t.match(/-?[\d.e+-]+/g).map(Number);
  return { a: n[0], b: n[1], c: n[2], d: n[3], e: n[4], f: n[5] };
};
const esc = (t) => { const m = parseMatriz(t); return { x: Math.hypot(m.a, m.b), y: Math.hypot(m.c, m.d) }; };
const contratos = [];

/** Desplaza para que la sección tenga su borde superior de diseño en `top`. */
async function colocarSeccion(page, id, top) {
  const h = await page.locator(sel(id)).first().elementHandle();
  await colocarBase(page, await posicionBase(page, h), top);
  return h;
}

contratos.push(["encabezado-seccion", async (browser) => {
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const linea = page.locator(`${sel("encabezado-seccion")} .motion-kicker-line`);
  const cab = page.locator(`${sel("encabezado-seccion")} .motion-heading`);
  const alto = await cab.evaluate((e) => e.getBoundingClientRect().height);
  const base = await posicionBase(page, await cab.elementHandle());
  // La línea va de entry 0 % a entry 70 % del encabezado, con curva lineal (revisión estética F-4).
  const curva = await linea.evaluate((e) => getComputedStyle(e).animationTimingFunction);
  check(curva === "linear", `encabezado-seccion: la línea usa curva lineal (${curva})`);
  const medidas = [];
  for (const p of [0.15, 0.3, 0.45, 0.6]) {
    await colocarBase(page, base, VIEW.height - alto * p);
    medidas.push(esc(await linea.evaluate((e) => getComputedStyle(e).transform)).x);
  }
  const recorrido = alto * 0.7;
  check(medidas.every((s, i) => s > 0 && s < 1 && (i === 0 || s > medidas[i - 1] + 0.1)) && recorrido >= 100,
    `encabezado-seccion: la línea se dibuja a lo largo de ${recorrido.toFixed(0)} px de scroll, sin saltos (scaleX ${medidas.map((s) => s.toFixed(2)).join(" → ")})`);
  await ctx.close();
  const red = await browser.newContext({ viewport: VIEW, reducedMotion: "reduce" });
  const pr = await red.newPage();
  await pr.goto(URL, { waitUntil: "networkidle" });
  await colocarSeccion(pr, "encabezado-seccion", VIEW.height * 0.5);
  const r = await pr.locator(`${sel("encabezado-seccion")}`).evaluate((s) =>
    [".motion-kicker-line", ".motion-mask-inner"].map((q) => { const cs = getComputedStyle(s.querySelector(q)); return [cs.animationName, cs.transform]; }));
  check(r.every(([n, t]) => n === "none" && t === "none"), "encabezado-seccion: con reduce, línea y máscara con animation-name none y transform none", JSON.stringify(r));
  await red.close();
}]);

contratos.push(["filas", async (browser) => {
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const fila = (await page.locator(`${sel("filas")} .motion-rows > dl > div`).elementHandles())[1];
  const alto = await fila.evaluate((e) => e.getBoundingClientRect().height);
  const base = await posicionBase(page, fila);
  // El separador (lineal, entry 0–60 %) empieza antes que el texto (entry 5 %) y se dibuja a lo largo
  // del recorrido: a entry 3 % ya crece y el texto sigue oculto; luego crece de forma continua.
  const medir = async (p) => {
    await colocarBase(page, base, VIEW.height - alto * p);
    return fila.evaluate((e) => ({ sep: getComputedStyle(e, "::before").transform, op: parseFloat(getComputedStyle(e).opacity),
      curva: getComputedStyle(e, "::before").animationTimingFunction }));
  };
  const r0 = await medir(0.03);
  const seps = [];
  for (const p of [0.15, 0.3, 0.45]) seps.push(esc((await medir(p)).sep).x);
  check(esc(r0.sep).x > 0 && r0.op === 0, `filas: el separador empieza antes que el texto (separador ${esc(r0.sep).x.toFixed(2)} / texto ${r0.op})`);
  check(r0.curva === "linear" && seps.every((s, i) => s < 1 && (i === 0 || s > seps[i - 1] + 0.1)),
    `filas: el separador se dibuja lineal con el scroll (${seps.map((s) => s.toFixed(2)).join(" → ")})`);
  await ctx.close();
  const red = await browser.newContext({ viewport: VIEW, reducedMotion: "reduce" });
  const pr = await red.newPage();
  await pr.goto(URL, { waitUntil: "networkidle" });
  await colocarSeccion(pr, "filas", VIEW.height * 0.5);
  const r = await pr.locator(`${sel("filas")} .motion-rows > dl > div + div`).evaluateAll((els) =>
    els.map((e) => [getComputedStyle(e, "::before").transform, getComputedStyle(e).transform, e.getBoundingClientRect().width,
      parseFloat(getComputedStyle(e, "::before").width)]));
  check(r.length === 2 && r.every(([s, t, w, ws]) => s === "none" && t === "none" && Math.abs(w - ws) < 1),
    "filas: con reduce, separadores a ancho completo y transform none", JSON.stringify(r));
  await red.close();
}]);

contratos.push(["bento-rejilla", async (browser) => {
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const cuerpos = page.locator(`${sel("bento-rejilla")} .motion-bento-body`);
  const celdas = page.locator(`${sel("bento-rejilla")} .motion-bento > ul > li`);
  const fila = await celdas.first().elementHandle();
  const alto = await fila.evaluate((e) => e.getBoundingClientRect().height);
  const base = await posicionBase(page, fila);
  // Al principio de la entrada: celdas opacas y sin animar; cuerpos aún ocultos.
  await colocarBase(page, base, VIEW.height - alto * 0.05);
  const ini = await celdas.evaluateAll((els) => els.map((e) => {
    const cs = getComputedStyle(e);
    const a = cs.backgroundColor.match(/rgba\([^)]*,\s*([\d.]+)\)/);
    return { op: parseFloat(cs.opacity), alfa: a ? parseFloat(a[1]) : 1, anim: cs.animationName, cuerpo: parseFloat(getComputedStyle(e.firstElementChild).opacity) };
  }));
  check(ini.every((c) => c.op === 1 && c.alfa === 1 && c.anim === "none") && ini.some((c) => c.cuerpo < 1),
    "bento grid: al empezar, la celda es opaca y no se anima (solo el cuerpo)", JSON.stringify(ini));
  // Columnas por consulta de contenedor: 4 en la sección ancha (> 60rem), 2 × 2 en la estrecha (unos 53rem).
  const columnas = async (id) => page.locator(`${sel(id)} .motion-bento > ul`).evaluate((u) => getComputedStyle(u).gridTemplateColumns.split(" ").length);
  const cAncha = await columnas("bento-rejilla"), cEstrecha = await columnas("bento-tarjetas");
  check(cAncha === 4 && cEstrecha === 2, `bento: columnas según el contenedor (sección ancha ${cAncha}, estrecha ${cEstrecha}; ambas piden 4)`);
  // A 1280 px con 4 columnas: misma posición de scroll, opacidad decreciente de la 1 a la 4.
  await colocarBase(page, base, VIEW.height - alto * 0.3);
  const ops = await cuerpos.evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).opacity)));
  check(ops.length === 4 && ops[0] > ops[1] && ops[1] > ops[2] && ops[2] > ops[3],
    `bento: a 1280 px, escalonado por columna (opacidades ${ops.map((o) => o.toFixed(2)).join(" > ")})`);
  await ctx.close();

  // A 768 px (2 columnas): la tarjeta 3 abre la fila 2 y empieza igual que la 1.
  const c2 = await browser.newContext({ viewport: { width: 768, height: 800 }, reducedMotion: "no-preference" });
  const p2 = await c2.newPage();
  await p2.goto(URL, { waitUntil: "networkidle" });
  const cel2 = await p2.locator(`${sel("bento-rejilla")} .motion-bento > ul > li`).elementHandles();
  const cols = await Promise.all(cel2.map((e) => e.evaluate((x) => getComputedStyle(x).getPropertyValue("--motion-col").trim())));
  const medir = async (h) => {
    const a = await h.evaluate((e) => e.getBoundingClientRect().height);
    await colocarBase(p2, await posicionBase(p2, h), 800 - a * 0.3);
    return h.evaluate((e) => parseFloat(getComputedStyle(e.firstElementChild).opacity));
  };
  const o1 = await medir(cel2[0]); const o3 = await medir(cel2[2]);
  check(cols.join() === "0,1,0,1" && Math.abs(o1 - o3) < 0.03,
    `bento: a 768 px la fila 2 empieza como la 1 (--motion-col ${cols.join()}; opacidad ${o1.toFixed(2)} / ${o3.toFixed(2)})`);
  await c2.close();

  // A 375 px (1 columna): todas con --motion-col 0.
  const c3 = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const p3 = await c3.newPage();
  await p3.goto(URL, { waitUntil: "networkidle" });
  const todas = await p3.locator(".motion-bento > ul > li").evaluateAll((els) => els.map((e) => getComputedStyle(e).getPropertyValue("--motion-col").trim()));
  check(todas.length > 0 && todas.every((c) => c === "0"), `bento: a 375 px todas las tarjetas con --motion-col 0 (${todas.length})`);
  await c3.close();

  const red = await browser.newContext({ viewport: VIEW, reducedMotion: "reduce" });
  const pr = await red.newPage();
  await pr.goto(URL, { waitUntil: "networkidle" });
  await colocarSeccion(pr, "bento-rejilla", VIEW.height * 0.5);
  const tr = await pr.locator(".motion-bento li, .motion-bento-body").evaluateAll((els) => els.map((e) => getComputedStyle(e).transform));
  check(tr.every((t) => t === "none"), "bento: con reduce, transform none en celdas y cuerpos");
  await red.close();
}]);

contratos.push(["cifras", async (browser) => {
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const valores = page.locator(`${sel("cifras")} .motion-figure-value`);
  const leer = () => valores.evaluateAll((els) => els.map((e) => e.textContent));
  await colocarSeccion(page, "cifras", VIEW.height - 5);
  const ini = await leer();
  await colocarSeccion(page, "cifras", VIEW.height * 0.5);
  const mitad = await leer();
  await colocarSeccion(page, "cifras", 50);
  const fin = await leer();
  check(ini.join("|").replace(/\u202F/g, " ") === "4|16–24 GB|4 %" && ini.join() === mitad.join() && mitad.join() === fin.join(),
    `cifras: los valores no cambian con el scroll (sin contador): ${fin.join(" · ")}`);
  // Revisión v2 (P2-7): el mismo hueco antes de la unidad en todas las cifras.
  const huecos = await page.locator(`${sel("cifras")} .motion-figure-unit`).evaluateAll((us) => us.map((u) => {
    const num = u.previousSibling; const r = document.createRange(); r.selectNodeContents(num);
    const finNum = r.getBoundingClientRect().right;
    const txt = [...u.childNodes].find((n) => n.nodeType === 3); const r2 = document.createRange(); r2.selectNodeContents(txt);
    return { u: txt.textContent, hueco: r2.getBoundingClientRect().left - finNum };
  }));
  check(huecos.length === 2 && huecos.every((h) => h.hueco > 0) && Math.abs(huecos[0].hueco - huecos[1].hueco) <= 1.5,
    `cifras: mismo hueco antes de la unidad (${huecos.map((h) => `${h.u} ${h.hueco.toFixed(1)} px`).join(", ")})`);
  const arbol = await page.locator(`${sel("cifras")} dl`).ariaSnapshot();
  const iLabel = arbol.indexOf("capas, todas dentro"), iValor = arbol.indexOf("16–24 GB");
  const iPrimerValor = arbol.search(/:\s*"?4"?\s*$/m);
  check(iLabel >= 0 && iValor > iLabel && (iPrimerValor === -1 || iPrimerValor > iLabel),
    "cifras: orden de lectura explicación → valor", arbol.split("\n").slice(0, 6).join(" / "));
  await ctx.close();
  // Revisión v2 (P2-8): sin viudas (última línea de una sola palabra) en explicaciones y notas a 390 px.
  {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const pm = await m.newPage();
    await pm.goto(URL, { waitUntil: "networkidle" });
    const viudas = await pm.locator(`${sel("cifras")} dt, ${sel("cifras")} .motion-figure-note`).evaluateAll((els) => els.flatMap((e) => {
      const tn = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); const palabras = [];
      for (let n = tn.nextNode(); n; n = tn.nextNode()) {
        for (const m of n.textContent.matchAll(/\S+/g)) {
          const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
          palabras.push({ w: m[0], top: Math.round(r.getBoundingClientRect().top) });
        }
      }
      const ultima = Math.max(...palabras.map((p) => p.top));
      const enUltima = palabras.filter((p) => p.top === ultima);
      const lineas = new Set(palabras.map((p) => p.top)).size;
      return lineas > 1 && enUltima.length < 2 ? [`«${enUltima.map((p) => p.w).join(" ")}» en «${e.textContent.trim().slice(0, 40)}…»`] : [];
    }));
    check(viudas.length === 0, "cifras: sin viudas en explicaciones y notas a 390 px", viudas.join("; "));
    await m.close();
  }

  const red = await browser.newContext({ viewport: VIEW, reducedMotion: "reduce" });
  const pr = await red.newPage();
  await pr.goto(URL, { waitUntil: "networkidle" });
  await colocarSeccion(pr, "cifras", VIEW.height * 0.5);
  const r = await pr.locator(`${sel("cifras")} .motion-mask-inner, ${sel("cifras")} dt, ${sel("cifras")} .motion-figure-value`).evaluateAll((els) =>
    els.map((e) => [getComputedStyle(e).transform, getComputedStyle(e).overflow]));
  check(r.every(([t]) => t === "none") && r.every(([, o]) => o !== "clip"),
    "cifras: con reduce, transform none y sin recorte (overflow: clip solo con movimiento)", JSON.stringify(r));
  await red.close();
}]);

/** Coloca la sección para que su línea de tiempo `cover` vaya por `p` (0 = asoma por abajo, 1 = sale por arriba). */
async function colocarCover(page, handle, p, alto = VIEW.height) {
  const base = await posicionBase(page, handle);
  const h = await handle.evaluate((e) => e.getBoundingClientRect().height);
  await desplazarA(page, base - alto + p * (alto + h));
}

/** Rectángulos que se pisan (con margen negativo de `holgura` px). */
function solapes(rects, holgura = 0) {
  const out = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.l + holgura < b.r && b.l + holgura < a.r && a.t + holgura < b.b && b.t + holgura < a.b) out.push(`${a.n} / ${b.n}`);
  }
  return out;
}

/** Capturas extra de una sección a otro ancho (inicio, mitad y final del cruce). */
async function capturasAncho(browser, id, ancho, etiqueta = `${ancho}`) {
  if (process.env.BANCO_CAPTURAS === "0") return;
  const vp = { width: ancho, height: 800 };
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const sec = await page.locator(sel(id)).first().elementHandle();
  const h = await sec.evaluate((e) => e.getBoundingClientRect().height);
  const base = await posicionBase(page, sec);
  for (const [nombre, top] of [["inicio", vp.height - h * 0.15], ["mitad", vp.height - h * 0.6], ["final", Math.max(20, (vp.height - h) / 2)]]) {
    await colocarBase(page, base, top);
    const y0 = Math.max(0, Math.floor(top - 40));
    await page.screenshot({ path: join(capturasDir, `${id}-${etiqueta}-${nombre}.png`), clip: { x: 0, y: y0, width: vp.width, height: Math.min(vp.height - y0, Math.ceil(h + 80)) } });
  }
  await ctx.close();
}

/** Estado de cada nodo y su conector en una posición de scroll (sirve para las dos disposiciones). */
async function estadoEsquema(fig) {
  return fig.evaluate((f) => {
    const escala = (t) => { if (t === "none") return 1; const n = t.match(/-?[\d.e+-]+/g).map(Number); return Math.hypot(n[0], n[1]); };
    const fila = f.dataset.layout === "row";
    const nodos = [...f.querySelectorAll(fila ? ".motion-diagram-row > li" : ".motion-diagram-nodes > li")].map((li, k) => ({
      id: k, paso: parseFloat(li.style.getPropertyValue("--motion-step")), op: parseFloat(getComputedStyle(li.querySelector(".motion-diagram-node")).opacity),
      // En fila, el conector es el ::before del nodo (excepto el primero).
      conector: fila && k > 0 ? escala(getComputedStyle(li, "::before").transform) : null,
      pasoConector: fila && k > 0 ? parseFloat(li.style.getPropertyValue("--motion-step")) - 0.6 : null,
    }));
    const pasoDe = new Map([...f.querySelectorAll(".motion-diagram-nodes > li")].map((li, k) => [k, parseFloat(li.style.getPropertyValue("--motion-step"))]));
    const lineas = [...f.querySelectorAll("line")].map((l) => ({
      tipo: l.dataset.kind, paso: parseFloat(l.style.getPropertyValue("--motion-step")), pasoOrigen: parseFloat(l.dataset.fromStep),
      escala: escala(getComputedStyle(l).transform), op: parseFloat(getComputedStyle(l).opacity),
      animacion: getComputedStyle(l).animationName, a: l.dataset.to,
    }));
    return { fila, nodos, lineas, pasoDe: [...pasoDe.values()] };
  });
}

async function contratoEsquema(browser, id) {
  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const fig = await page.locator(`${sel(id)} .motion-diagram`).elementHandle();

  // F-2 (revisión estética): cada conector va a la par con su nodo destino. Recorre el cruce y exige:
  // ningún nodo se ve antes de que su conector lleve la mitad, y el conector no empieza antes que
  // el paso de su nodo − 0,6. Los cortados y discontinuos entran los últimos, con un fundido.
  const malos = new Set();
  let visto = false;
  const estructura = await estadoEsquema(fig);
  const fila = estructura.fila;
  const pasoNodo = (s, idDestino) => s.nodos.find((n) => n.paso === idDestino);
  for (let p = 0.1; p <= 0.6; p += 0.01) {
    await colocarCover(page, fig, p);
    const s = await estadoEsquema(fig);
    if (fila) {
      for (const n of s.nodos.slice(1)) {
        if (n.op > 0.05 && n.conector < 0.5) malos.add(`nodo ${n.id} visible (${n.op.toFixed(2)}) con su conector a ${n.conector.toFixed(2)}`);
        if (n.conector > 0) visto = true;
      }
    } else {
      // El destino de cada cable: el nodo cuyo paso es el del cable + 0,6.
      for (const l of s.lineas.filter((x) => x.tipo === "wire")) {
        const destino = s.nodos.find((n) => Math.abs(n.paso - (l.paso + 0.6)) < 0.01);
        if (!destino) { malos.add(`cable con paso ${l.paso} sin nodo destino en paso ${l.paso + 0.6}`); continue; }
        if (destino.op > 0.05 && l.escala < 0.5) malos.add(`nodo ${destino.paso} visible (${destino.op.toFixed(2)}) con su cable a ${l.escala.toFixed(2)}`);
        if (l.escala > 0) visto = true;
      }
    }
  }
  check(visto && malos.size === 0, `${id}: cada conector «lleva» a su nodo (paso del conector = paso del nodo − 0,6; el nodo no se ve antes que su línea)`,
    [...malos].slice(0, 4).join("; "));
  if (!fila) {
    const cables = estructura.lineas.filter((l) => l.tipo === "wire");
    const otros = estructura.lineas.filter((l) => l.tipo !== "wire");
    check(otros.every((o) => cables.every((c) => o.paso > c.paso) && o.animacion === "motion-fade"),
      `${id}: las conexiones cortadas entran las últimas y con fundido (no escalan)`, JSON.stringify(otros));
    // Revisión v2 (P2-1): el cable no sale antes de que su origen se vea (paso ≥ paso del origen + 1).
    check(cables.every((c) => c.paso >= c.pasoOrigen + 1 - 1e-6),
      `${id}: cada cable sale cuando su nodo de origen ya está (paso ≥ origen + 1)`, JSON.stringify(cables.map((c) => [c.pasoOrigen, c.paso])));
  } else {
    const pasos = await fig.evaluate((f) => [...f.querySelectorAll(".motion-diagram-row > li")].map((li) => [
      parseFloat(li.style.getPropertyValue("--motion-step")), parseFloat(li.style.getPropertyValue("--motion-edge-step"))]));
    check(pasos.slice(1).every(([n, e], k) => e >= pasos[k][0] + 1 - 1e-6 && Math.abs(n - (e + 0.6)) < 1e-6),
      `${id}: cada conector de la fila sale cuando el nodo anterior ya está y lleva a su nodo (${pasos.map(([n, e]) => `${e}→${n}`).join(", ")})`);
  }

  // Orden del recorrido: a mitad, el nodo 0 se ve antes que el 3.
  await colocarCover(page, fig, 0.3);
  const r = await estadoEsquema(fig);
  // Por orden de entrada (los pasos ya no son enteros: un destino puede retrasarse para esperar a su cable).
  const porPaso = [...r.nodos].sort((x, y) => x.paso - y.paso);
  const n0 = porPaso[0], n3 = porPaso[3];
  check(n0 && n3 && n0.op > n3.op && n0.op > 0.3, `${id}: a mitad, el nodo 0 se ve antes que el 3 (${n0?.op.toFixed(2)} > ${n3?.op.toFixed(2)})`);

  // Al final, cada conector llega al centro del icono de su nodo (±4 px).
  await colocarCover(page, fig, 0.7);
  const fin = await fig.evaluate((f) => {
    const centro = (e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
    if (f.dataset.layout === "row") {
      const lis = [...f.querySelectorAll(".motion-diagram-row > li")];
      return lis.slice(1).map((li, k) => {
        // El ::before no tiene getBoundingClientRect: se calcula con su caja computada.
        const cs = getComputedStyle(li, "::before");
        const b = li.getBoundingClientRect();
        const horizontal = parseFloat(cs.height) <= 1.5;
        const fin = horizontal
          ? { x: b.left + parseFloat(cs.left) + parseFloat(cs.width), y: b.top + parseFloat(cs.top) }
          : { x: b.left + parseFloat(cs.left), y: b.top + parseFloat(cs.top) + parseFloat(cs.height) };
        const ini = horizontal ? { x: b.left + parseFloat(cs.left), y: fin.y } : { x: fin.x, y: b.top + parseFloat(cs.top) };
        const c1 = centro(lis[k].querySelector(".motion-diagram-icon")), c2 = centro(li.querySelector(".motion-diagram-icon"));
        // Horizontal: del centro del icono anterior al de este. Vertical: del borde inferior del anterior al superior de este.
        if (horizontal) return Math.max(Math.hypot(ini.x - c1.x, ini.y - c1.y), Math.hypot(fin.x - c2.x, fin.y - c2.y));
        const i1 = lis[k].querySelector(".motion-diagram-icon").getBoundingClientRect(), i2 = li.querySelector(".motion-diagram-icon").getBoundingClientRect();
        return Math.max(Math.abs(ini.y - i1.bottom), Math.abs(fin.y - i2.top), Math.abs(fin.x - c2.x));
      });
    }
    const centros = [...f.querySelectorAll(".motion-diagram-icon")].map(centro);
    const stage = f.querySelector(".motion-diagram-stage").getBoundingClientRect();
    return [...f.querySelectorAll("line")].map((l) => {
      const b = l.getBoundingClientRect();
      const x1 = +l.getAttribute("x1"), y1 = +l.getAttribute("y1"), x2 = +l.getAttribute("x2"), y2 = +l.getAttribute("y2");
      const fx = x2 >= x1 ? b.right : b.left, fy = y2 >= y1 ? b.bottom : b.top;
      const dx = stage.left + (x2 / 100) * stage.width, dy = stage.top + (y2 / 100) * stage.height;
      const destino = centros.reduce((m, c) => (Math.hypot(c.x - dx, c.y - dy) < Math.hypot(m.x - dx, m.y - dy) ? c : m));
      return Math.hypot(fx - destino.x, fy - destino.y);
    });
  });
  check(fin.length > 0 && fin.every((d) => d <= 4), `${id}: al final cada conector llega a su nodo (desvío máx. ${Math.max(...fin).toFixed(1)} px)`);
  await ctx.close();

  // A 1280 y 390 px, ninguna etiqueta se pisa con otra y todo cabe; en fila, sin escenario vacío.
  for (const ancho of [1280, 390]) {
    const c = await browser.newContext({ viewport: { width: ancho, height: 844 }, reducedMotion: "reduce" });
    const p = await c.newPage();
    await p.goto(URL, { waitUntil: "networkidle" });
    const rects = await p.locator(`${sel(id)} .motion-diagram-node, ${sel(id)} .motion-diagram-cut, ${sel(id)} .motion-diagram-perimeter-label`).evaluateAll((els) => els.map((e) => {
      const b = e.getBoundingClientRect(); return { n: e.textContent.trim() || e.className, l: b.left, r: b.right, t: b.top, b: b.bottom };
    }));
    const s = solapes(rects);
    check(s.length === 0, `${id}: a ${ancho} px ninguna etiqueta se pisa con otra`, s.join("; "));
    const holgura = await p.locator(`${sel(id)} .motion-diagram`).evaluate((f) => {
      const st = f.querySelector(".motion-diagram-stage");
      if (!st) return null;
      const S = st.getBoundingClientRect();
      const tiles = [...f.querySelectorAll(".motion-diagram-nodes > li")].map((li) => li.querySelector(".motion-diagram-icon").getBoundingClientRect());
      let min = Infinity, peor = "";
      const lis = [...f.querySelectorAll(".motion-diagram-nodes > li")];
      const li2txt = (r) => lis.find((li) => { const q = li.querySelector(".motion-diagram-icon").getBoundingClientRect(); return q.left === r.left && q.top === r.top; })?.textContent.trim() ?? "?";
      for (const l of f.querySelectorAll("line")) {
        const x1 = S.left + (+l.getAttribute("x1") / 100) * S.width, y1 = S.top + (+l.getAttribute("y1") / 100) * S.height;
        const x2 = S.left + (+l.getAttribute("x2") / 100) * S.width, y2 = S.top + (+l.getAttribute("y2") / 100) * S.height;
        for (const r of tiles) {
          const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
          // Los nodos de los extremos del cable no cuentan.
          if (Math.hypot(cx - x1, cy - y1) < 2 || Math.hypot(cx - x2, cy - y2) < 2) continue;
          // Distancia del segmento al rectángulo (muestreo fino del segmento).
          for (let k = 0; k <= 200; k++) {
            const x = x1 + ((x2 - x1) * k) / 200, y = y1 + ((y2 - y1) * k) / 200;
            const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
            const d = Math.hypot(dx, dy);
            if (d < min) { min = d; peor = `cable a ${l.dataset.to} (${x1.toFixed(0)},${y1.toFixed(0)})→(${x2.toFixed(0)},${y2.toFixed(0)}) junto al tile ${li2txt(r)} [${r.left.toFixed(0)},${r.top.toFixed(0)} ${r.width.toFixed(0)}px]`; }
          }
        }
      }
      return { min, peor };
    });
    const marco = await p.locator(`${sel(id)} .motion-diagram`).evaluate((f) => {
      const per = f.querySelector(".motion-diagram-perimeter");
      if (!per) return null;
      const P = per.getBoundingClientRect();
      // Distancia de cada nodo (icono + etiqueta) a la línea del perímetro, por dentro o por fuera.
      const nodos = [...f.querySelectorAll(".motion-diagram-nodes > li")].map((li) => {
        const r = li.querySelector(".motion-diagram-node").getBoundingClientRect();
        const lab = li.querySelector(".motion-diagram-label").getBoundingClientRect();
        const R = { left: Math.min(r.left, lab.left), right: Math.max(r.right, lab.right), top: Math.min(r.top, lab.top), bottom: Math.max(r.bottom, lab.bottom) };
        const dentro = R.left >= P.left && R.right <= P.right && R.top >= P.top && R.bottom <= P.bottom;
        const d = dentro
          ? Math.min(R.left - P.left, P.right - R.right, R.top - P.top, P.bottom - R.bottom)
          : (R.right < P.left || R.left > P.right || R.bottom < P.top || R.top > P.bottom)
            ? Math.hypot(Math.max(P.left - R.right, 0, R.left - P.right), Math.max(P.top - R.bottom, 0, R.top - P.bottom))
            : 0;
        return { n: li.textContent.trim(), d };
      });
      const peor = nodos.reduce((m, x) => (x.d < m.d ? x : m));
      // La marca de corte, sobre el borde (±3 px de alguno de los cuatro lados).
      const cortes = [...f.querySelectorAll(".motion-diagram-cut")].map((c) => {
        const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        return Math.min(Math.abs(cx - P.left), Math.abs(cx - P.right), Math.abs(cy - P.top), Math.abs(cy - P.bottom));
      });
      return { peor, cortes };
    });
    if (marco) {
      check(marco.peor.d >= 12, `${id}: a ${ancho} px ningún nodo roza el perímetro (mín. ${marco.peor.d.toFixed(0)} px, ${marco.peor.n})`);
      check(marco.cortes.length > 0 && marco.cortes.every((d) => d <= 3), `${id}: a ${ancho} px la marca de corte cae en el borde del perímetro (${marco.cortes.map((d) => d.toFixed(1)).join(", ")} px)`);
    }
    if (holgura !== null) check(holgura.min >= 12, `${id}: a ${ancho} px ningún cable pasa pegado a un nodo que no es suyo (mín. ${holgura.min === Infinity ? "—" : holgura.min.toFixed(0)} px)`, holgura.peor);
    const fuera = rects.filter((q) => q.l < 0 || q.r > ancho);
    check(fuera.length === 0, `${id}: a ${ancho} px todos los nodos caben en la pantalla`, fuera.map((q) => q.n).join(", "));
    if (fila) {
      const g = await p.locator(`${sel(id)} .motion-diagram-row`).evaluate((ol) => {
        const caja = ol.getBoundingClientRect();
        const nodos = [...ol.querySelectorAll(".motion-diagram-node")].map((n) => n.getBoundingClientRect());
        const ocupado = Math.max(...nodos.map((n) => n.bottom)) - Math.min(...nodos.map((n) => n.top));
        return { alto: caja.height, ocupado, columna: getComputedStyle(ol).flexDirection };
      });
      check(g.alto <= g.ocupado + 2 && g.columna === (ancho < 768 ? "column" : "row"),
        `${id}: a ${ancho} px la fila no deja escenario vacío (${g.alto.toFixed(0)} px de alto para ${g.ocupado.toFixed(0)} px de nodos; ${g.columna})`);
    }
    await c.close();
  }

  const red = await browser.newContext({ viewport: VIEW, reducedMotion: "reduce" });
  const pr = await red.newPage();
  await pr.goto(URL, { waitUntil: "networkidle" });
  const tr = await pr.locator(`${sel(id)} line, ${sel(id)} .motion-diagram-node, ${sel(id)} .motion-diagram-cut, ${sel(id)} .motion-diagram-perimeter`)
    .evaluateAll((els) => els.map((e) => getComputedStyle(e).transform));
  const trFila = await pr.locator(`${sel(id)} .motion-diagram-row > li`).evaluateAll((els) => els.map((e) => getComputedStyle(e, "::before").transform));
  check([...tr, ...trFila].every((t) => t === "none"), `${id}: con reduce, nodos y conectores dibujados sin transformar`);
  await red.close();
  await capturasAncho(browser, id, 375);
}

contratos.push(["esquema-radial", async (browser) => {
  await contratoEsquema(browser, "esquema-radial");
  // Detalle para revisar a ojo (densidad 2×): conexión cortada con su marca y el núcleo.
  if (process.env.BANCO_CAPTURAS !== "0") {
    const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference", deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    const fig = await page.locator(`${sel("esquema-radial")} .motion-diagram`).elementHandle();
    for (const [nombre, p] of [["detalle-mitad", 0.3], ["detalle-final", 0.6]]) {
      await colocarCover(page, fig, p);
      const b = await page.locator(`${sel("esquema-radial")} .motion-diagram-stage`).boundingBox();
      const y = Math.max(0, b.y);
      await page.screenshot({ path: join(capturasDir, `esquema-radial-${nombre}.png`),
        clip: { x: b.x + b.width * 0.3, y, width: b.width * 0.7, height: Math.min(b.height * 0.6, VIEW.height - y) } });
    }
    await ctx.close();
  }
}]);
contratos.push(["esquema-capas", (browser) => contratoEsquema(browser, "esquema-capas")]);

/** Geometría de la órbita: centro, radios y ángulo «desaplastado» de cada nodo. */
async function geometriaOrbita(page) {
  return page.locator(`${sel("orbita")} .motion-orbit-stage`).evaluate((st) => {
    const R = { outer: 46, middle: 32, inner: 19 };
    const s = st.getBoundingClientRect();
    const squash = parseFloat(getComputedStyle(st).getPropertyValue("--motion-orbit-squash"));
    const cx = s.left + s.width / 2, cy = s.top + s.height / 2;
    const nc = st.querySelector(".motion-orbit-core").getBoundingClientRect();
    return {
      squash, alto: s.height, top: s.top,
      nucleo: { id: "núcleo", l: nc.left, r: nc.right, t: nc.top, b: nc.bottom },
      nodos: [...st.querySelectorAll(".motion-orbit-spin")].flatMap((spin) => [...spin.querySelectorAll(".motion-orbit-chip")].map((ch, i) => {
        const b = ch.getBoundingClientRect();
        const dx = b.left + b.width / 2 - cx, dy = b.top + b.height / 2 - cy;
        const rx = (R[spin.dataset.ring] / 100) * s.width, ry = rx * squash;
        return {
          id: `${spin.dataset.ring}${i}`, anillo: spin.dataset.ring, tipo: ch.dataset.kind,
          inicio: parseFloat(ch.closest(".motion-orbit-arm").dataset.angle),
          ang: (Math.atan2(dy / squash, dx) * 180) / Math.PI, elipse: (dx / rx) ** 2 + (dy / ry) ** 2,
          w: b.width, h: b.height, l: b.left, r: b.right, t: b.top, b: b.bottom,
        };
      })),
    };
  });
}
const difAng = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

contratos.push(["orbita", async (browser) => {
  // No está en la primera pantalla (1280×800 y 375×800).
  for (const vp of [VIEW, { width: 375, height: 800 }]) {
    const c = await browser.newContext({ viewport: vp });
    const p = await c.newPage();
    await p.goto(URL, { waitUntil: "networkidle" });
    const top = await p.locator(`${sel("orbita")} .motion-orbit`).evaluate((e) => e.getBoundingClientRect().top);
    check(top >= vp.height, `orbita: fuera de la primera pantalla a ${vp.width}×${vp.height} (empieza en ${Math.round(top)} px)`);
    await c.close();
  }

  const ctx = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const stage = await page.locator(`${sel("orbita")} .motion-orbit-stage`).elementHandle();
  await colocarCover(page, stage, 0.5);
  const tl = await stage.evaluate((st) => st.closest(".motion-orbit").getAnimations({ subtree: true }).map((a) => a.timeline?.constructor?.name));
  check(tl.length > 0 && tl.every((n) => n === "ViewTimeline"), `orbita: sus ${tl.length} animaciones van con ViewTimeline (ninguna con reloj)`, tl.join(","));

  // Si el scroll para, la órbita para: dos capturas separadas 1 s, idénticas.
  const caja = await stage.boundingBox();
  const clip = { x: caja.x, y: Math.max(0, caja.y), width: caja.width, height: Math.min(caja.height, VIEW.height - Math.max(0, caja.y)) };
  const a = await page.screenshot({ clip });
  await page.waitForTimeout(1000);
  const b = await page.screenshot({ clip });
  check(Buffer.compare(a, b) === 0, "orbita: sin scroll no se mueve (dos capturas a 1 s, iguales píxel a píxel)");

  // Avanza con el scroll: exterior ≈ +24° y medio ≈ −36° a lo largo del cruce; etiquetas rectas y sobre la elipse.
  const pos = [0.02, 0.5, 0.98];
  const g = [];
  for (const p of pos) { await colocarCover(page, stage, p); g.push(await geometriaOrbita(page)); }
  const tramo = (id) => difAng(g[0].nodos.find((n) => n.id === id).ang, g[2].nodos.find((n) => n.id === id).ang);
  const k = pos[2] - pos[0];
  const ext = tramo("outer0"), med = tramo("middle0"), int = tramo("inner0");
  check(Math.abs(ext - 24 * k) <= 3, `orbita: el nodo exterior avanza ${ext.toFixed(1)}° (esperado ${(24 * k).toFixed(1)}° ±3)`);
  check(Math.abs(med + 36 * k) <= 3, `orbita: el nodo medio avanza ${med.toFixed(1)}° en sentido contrario (esperado ${(-36 * k).toFixed(1)}° ±3)`);
  check(Math.abs(int - 52 * k) <= 3, `orbita: el punto interior avanza ${int.toFixed(1)}° (esperado ${(52 * k).toFixed(1)}° ±3)`);
  const chips = g.map((x) => x.nodos.filter((n) => n.tipo === "chip"));
  const rectos = chips[0].every((c0, i) => chips.every((cs) => Math.abs(cs[i].w - c0.w) <= 1 && Math.abs(cs[i].h - c0.h) <= 1));
  check(rectos, "orbita: los chips no giran ni se deforman (mismo ancho y alto ±1 px al inicio, a mitad y al final)",
    chips.map((cs) => cs.map((c) => `${c.w.toFixed(1)}×${c.h.toFixed(1)}`).join(" ")).join(" | "));
  const fueraElipse = g.flatMap((x) => x.nodos.filter((n) => Math.abs(n.elipse - 1) > 0.05).map((n) => `${n.id}=${n.elipse.toFixed(3)}`));
  check(fueraElipse.length === 0, "orbita: cada nodo está sobre su elipse ((dx/rx)²+(dy/ry)² = 1 ±0,05)", fueraElipse.join(" "));
  await ctx.close();

  // Ningún chip se pisa con otro nodo, a 1280, 768 y 375 px, al inicio, a mitad y al final.
  for (const ancho of [1280, 768, 375]) {
    const c = await browser.newContext({ viewport: { width: ancho, height: 800 }, reducedMotion: "no-preference" });
    const p = await c.newPage();
    await p.goto(URL, { waitUntil: "networkidle" });
    const st = await p.locator(`${sel("orbita")} .motion-orbit-stage`).elementHandle();
    const malos = [];
    for (const q of [0.02, 0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86, 0.98]) {
      await colocarCover(p, st, q, 800);
      const gg = await geometriaOrbita(p);
      for (const ch of gg.nodos.filter((n) => n.tipo !== "dot")) {
        for (const o of [...gg.nodos, gg.nucleo]) {
          if (o === ch) continue;
          if (ch.l < o.r && o.l < ch.r && ch.t < o.b && o.t < ch.b) malos.push(`${q}: ${ch.id}/${o.id}`);
        }
      }
    }
    check(malos.length === 0, `orbita: a ${ancho} px ningún chip se pisa con otro nodo ni con el núcleo (9 posiciones del cruce)`, [...new Set(malos)].join("; "));
    await c.close();
    await capturasAncho(browser, "orbita", ancho);
  }

  // Revisión estética v1 (F-9, MJ-1, MJ-3, F-12).
  {
    const c = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference" });
    const p = await c.newPage();
    await p.goto(URL, { waitUntil: "networkidle" });
    const st = await p.locator(`${sel("orbita")} .motion-orbit-stage`).elementHandle();
    const nucleo = await st.evaluate((s) => {
      const icono = { width: s.querySelector(".motion-orbit-core-icon").offsetWidth }; // sin la escala de su entrada
      const plano = s.querySelector(".motion-orbit-plane");
      const pos = s.querySelector(".motion-orbit-core-pos");
      const opaco = [".motion-orbit-core-text"].map((q) => {
        const bg = getComputedStyle(s.querySelector(q)).backgroundColor;
        const m = bg.match(/rgba?\(([^)]*)\)/); const v = m ? m[1].split(",").map(Number) : [0, 0, 0, 0];
        return v.length === 3 || v[3] === 1;
      });
      return { ancho: icono.width, ancho_escenario: s.getBoundingClientRect().width,
        encima: !!(plano.compareDocumentPosition(pos) & Node.DOCUMENT_POSITION_FOLLOWING), opaco };
    });
    check(nucleo.ancho >= 90, `orbita: núcleo grande (${nucleo.ancho.toFixed(0)} px de ${nucleo.ancho_escenario.toFixed(0)}; antes 72)`);
    check(nucleo.encima && nucleo.opaco.every(Boolean),
      "orbita: las etiquetas del núcleo van encima de los anillos y con fondo opaco (el anillo interior pasa por detrás)", JSON.stringify(nucleo));
    // Los chips se leen enteros cuando el escenario acaba de entrar (antes, solo con la figura centrada).
    const h = await st.evaluate((e) => e.getBoundingClientRect().height);
    await colocarBase(p, await posicionBase(p, st), VIEW.height - h * 0.92);
    const ops = await p.locator(`${sel("orbita")} .motion-orbit-chip[data-kind="chip"]`).evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).opacity)));
    check(ops.every((o) => o === 1), `orbita: los chips están enteros al terminar de entrar el escenario (${ops.map((o) => o.toFixed(2)).join(", ")})`);
    await c.close();

    const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pm = await m.newPage();
    await pm.goto(URL, { waitUntil: "networkidle" });
    const ley = await pm.locator(`${sel("orbita")} .motion-orbit-legend > li`).evaluateAll((els) =>
      els.map((e) => ({ t: e.textContent.trim(), anillo: e.dataset.ring, borde: getComputedStyle(e).borderTopStyle, visible: e.getBoundingClientRect().width > 0 })));
    const esperados = ["Documentos", "Datos", "Equipo", "Accesos", "Auditoría"];
    check(esperados.every((x) => ley.some((l) => l.t === x && l.visible)) && ley.filter((l) => l.anillo === "middle").every((l) => l.borde === "dashed"),
      "orbita: a 390 px la leyenda nombra también los iconos del anillo medio (en estilo secundario)", JSON.stringify(ley));
    await m.close();
  }

  // Revisión v2 (P2-5, P2-6): una sola pastilla en el núcleo, y la sombra de los chips no llega al pie.
  for (const ancho of [1440, 1280, 768]) {
    const c = await browser.newContext({ viewport: { width: ancho, height: 800 }, reducedMotion: "no-preference" });
    const p = await c.newPage();
    await p.goto(URL, { waitUntil: "networkidle" });
    const st = await p.locator(`${sel("orbita")} .motion-orbit-stage`).elementHandle();
    let minimo = Infinity;
    for (const q of [0.02, 0.26, 0.5, 0.74, 0.98]) {
      await colocarCover(p, st, q, 800);
      const d = await p.locator(`${sel("orbita")} .motion-orbit`).evaluate((f) => {
        const pie = f.querySelector("figcaption").getBoundingClientRect().top;
        return Math.min(...[...f.querySelectorAll('.motion-orbit-chip[data-kind="chip"], .motion-orbit-chip[data-kind="icon"]')].map((ch) => {
          const r = ch.getBoundingClientRect();
          const sombra = getComputedStyle(ch).boxShadow.match(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px/);
          const alcance = sombra ? parseFloat(sombra[2]) + parseFloat(sombra[3]) : 0; // desplazamiento + difuminado
          return pie - (r.bottom + alcance);
        }));
      });
      minimo = Math.min(minimo, d);
    }
    const pastilla = await p.locator(`${sel("orbita")} .motion-orbit-core-text`).evaluate((e) => ({
      hijos: e.children.length, bg: getComputedStyle(e).backgroundColor }));
    check(minimo >= 0, `orbita: a ${ancho} px la sombra de los chips no llega al pie (margen mín. ${minimo.toFixed(0)} px)`);
    check(pastilla.hijos === 2 && !/rgba\([^)]*, 0\)/.test(pastilla.bg), `orbita: a ${ancho} px etiqueta y sublabel del núcleo en una sola pastilla opaca`);
    await c.close();
  }

  // Movimiento reducido: nada se mueve y cada nodo está en su ángulo de partida.
  const red = await browser.newContext({ viewport: VIEW, reducedMotion: "reduce" });
  const pr = await red.newPage();
  await pr.goto(URL, { waitUntil: "networkidle" });
  await colocarCover(pr, await pr.locator(`${sel("orbita")} .motion-orbit-stage`).elementHandle(), 0.5);
  const gr = await geometriaOrbita(pr);
  const n = await pr.locator(`${sel("orbita")}`).evaluate((s) => s.getAnimations({ subtree: true }).length);
  const desv = gr.nodos.map((x) => Math.abs(difAng(x.inicio, x.ang)));
  check(n === 0 && Math.max(...desv) <= 1, `orbita: con reduce, sin animaciones y nodos en su ángulo de partida (desvío máx. ${Math.max(...desv).toFixed(2)}°)`);
  await red.close();

  // Nitidez de las etiquetas a mitad de giro (para revisar a ojo; densidad 2×).
  if (process.env.BANCO_CAPTURAS !== "0") {
    const c = await browser.newContext({ viewport: VIEW, reducedMotion: "no-preference", deviceScaleFactor: 2 });
    const p = await c.newPage();
    await p.goto(URL, { waitUntil: "networkidle" });
    await colocarCover(p, await p.locator(`${sel("orbita")} .motion-orbit-stage`).elementHandle(), 0.5);
    const chip = p.locator(`${sel("orbita")} .motion-orbit-chip[data-kind="chip"]`).first();
    const bb = await chip.boundingBox();
    await p.screenshot({ path: join(capturasDir, "orbita-nitidez-chip.png"), clip: { x: bb.x - 12, y: bb.y - 12, width: bb.width + 24, height: bb.height + 24 } });
    await c.close();
  }
}]);

/** Las capturas llevan la tipografía de Galileo: Geist (texto) y Geist Mono (etiquetas y cifras). */
async function tipografia(browser) {
  console.log("\n[tipografía] el muestrario usa Geist y Geist Mono, como galileo-studio-web");
  const ctx = await browser.newContext({ viewport: VIEW });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const fam = (q) => { const e = document.querySelector(q); return e ? getComputedStyle(e).fontFamily : null; };
    const cargadas = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
    return {
      cargadas,
      sans: [fam("h1"), fam(".motion-heading h2"), fam(".motion-bento-title"), fam(".motion-figure-value")],
      mono: [fam(".motion-kicker"), fam(".motion-rows dt"), fam(".motion-diagram-sublabel")],
    };
  });
  const esSans = (f) => !!f && /geist/i.test(f.split(",")[0]) && !/mono/i.test(f.split(",")[0]);
  const esMono = (f) => !!f && /geist.*mono|mono.*geist/i.test(f.split(",")[0]);
  check(r.cargadas.some((f) => /geist/i.test(f) && !/mono/i.test(f)) && r.cargadas.some((f) => /geist.*mono|mono.*geist/i.test(f)),
    "Geist y Geist Mono cargadas (document.fonts)", r.cargadas.join(", "));
  check(r.sans.every(esSans), "texto, títulos y cifras en Geist", r.sans.join(" | "));
  check(r.mono.filter(Boolean).every(esMono) && r.mono.some(Boolean), "etiquetas mono en Geist Mono", r.mono.join(" | "));
  await ctx.close();
}

/** Revisión v2 (F-14): ninguna pieza queda recortada, ni por el viewport ni por un contenedor con overflow. */
async function sinRecortes(browser) {
  console.log("\n[recortes] ninguna pieza queda cortada por la ventana ni por un contenedor (1280, 1440, 390)");
  for (const vp of [VIEW, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    const malos = await page.evaluate((ancho) => {
      const out = [];
      for (const sec of document.querySelectorAll("section[data-pieza]")) {
        // Elementos con caja de cada pieza (sin decorado que se sale a propósito: halos).
        const els = [sec, ...sec.querySelectorAll("[class*='motion-'], [data-motion], li, dt, dd, h2, h3, p, figcaption")]
          .filter((e) => !/motion-orbit-halo|motion-diagram-node::before/.test(e.className?.baseVal ?? e.className ?? ""));
        for (const e of els) {
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < -1 || r.right > ancho + 1) { out.push(`${sec.dataset.pieza}: ${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).split(" ")[0]} fuera de la ventana (${r.left.toFixed(0)}–${r.right.toFixed(0)})`); continue; }
          for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
            const cs = getComputedStyle(a);
            if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
            const c = a.getBoundingClientRect();
            if (r.left < c.left - 1 || r.right > c.right + 1) {
              out.push(`${sec.dataset.pieza}: ${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).split(" ")[0]} recortado por ${a.tagName.toLowerCase()}.${String(a.className).split(" ")[0]} (overflow-x ${cs.overflowX})`);
              break;
            }
          }
        }
      }
      return [...new Set(out)];
    }, vp.width);
    check(malos.length === 0, `a ${vp.width} px ninguna pieza queda recortada`, malos.slice(0, 6).join("; "));
    await ctx.close();
  }
}

async function ejecutarContratos(browser) {
  console.log("\n[contratos] comprobaciones propias de cada pieza en prueba");
  const ids = new Set(registro.map((e) => e.id));
  for (const [id, fn] of contratos) {
    if (!ids.has(id)) continue;
    try { await fn(browser); } catch (err) { bad(`${id}: el contrato no se pudo ejecutar`, err.message.split("\n")[0]); }
  }
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
    await tipografia(navegador);
    await sinRecortes(navegador);
    await ejecutarContratos(navegador);
    await capturas(navegador);
    console.log(`\nnivel 3: ${oks} ok, ${fallos} fallos`);
    process.exitCode = fallos ? 1 : 0;
  }
} finally {
  if (navegador) await navegador.close();
  servidor.matar();
}
