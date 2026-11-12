// Prepara el banco-web: instala el kit del plugin en src/ (install_kit.py, idempotente)
// y comprueba que quedó al día. Usado por `npm run test:motion` y por run.sh.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const web = resolve(aqui, "..");
const instalador = resolve(web, "..", "..", "..", "..", "plugins", "sau", "skills", "motion-director", "kit", "install_kit.py");

let py = null;
for (const c of ["py", "python3", "python"]) {
  const r = spawnSync(c, ["-c", "import sys; sys.exit(sys.version_info[0] != 3)"], { stdio: "ignore" });
  if (r.status === 0) { py = c; break; }
}
if (!py) { console.error("No hay Python 3 (py, python3 o python)."); process.exit(2); }

const env = { ...process.env, PYTHONUTF8: "1" };
for (const extra of [[], ["--check"]]) {
  const r = spawnSync(py, [instalador, "--root", web, ...extra], { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
