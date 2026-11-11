// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
/**
 * Tokens de movimiento de marca ("entrar con intención, sostener, salir limpio").
 * Las mismas cifras existen como variables CSS en motion.css.
 * Reglas completas y catálogo de piezas: skill motion-director del plugin sau.
 */

/** Curva de marca para entradas. Equivale a GSAP `expo.out`. */
export const EASE_BRAND = [0.16, 1, 0.3, 1] as const;

/** Curva para salidas. Equivale a GSAP `power3.in`. */
export const EASE_EXIT = [0.32, 0, 0.67, 0] as const;

/** Duraciones en segundos. */
export const DURATION = {
  fast: 0.4,
  base: 0.7,
  slow: 1,
} as const;

/** Retardo entre elementos de un grupo, en segundos (rango de marca: 0,02–0,12). */
export const STAGGER = {
  tight: 0.04,
  base: 0.08,
  loose: 0.12,
} as const;

/** Desplazamiento vertical de entrada, en píxeles (bloques y títulos; los detalles pequeños, 16). */
export const RISE_DISTANCE = 40;

/** Escala de entrada de las piezas de bloque (tarjetas, columnas, cita). */
export const SCALE_BLOCK = 0.96;

/**
 * Rangos de las entradas con el scroll (`animation-range: cover <inicio> cover <fin>`). Espejo de las
 * variables `--motion-range-*` y `--motion-stagger-*` de motion.css: empiezan cuando la pieza asoma por
 * abajo y terminan con su borde superior a media pantalla. El escalonado retrasa más el inicio que el final.
 */
export const SCROLL_RANGE = {
  start: "8svh",
  end: "50svh",
  staggerStart: "6svh",
  staggerEnd: "3svh",
} as const;

/** Curva de las entradas ligadas al scroll (ease-out cuadrática). EASE_BRAND queda para entradas por tiempo. */
export const EASE_SCROLL = [0.5, 1, 0.89, 1] as const;

/** @deprecated Los rangos ya no son porcentajes: usa SCROLL_RANGE. Se mantiene para no romper importaciones. */
export const SCROLL_STAGGER_STEP = 0.07;

/**
 * Órbita: aplastado de la elipse y tramo que avanza cada anillo al cruzar la sección.
 * Espejo de las variables `--motion-orbit-*` de motion.css. Los fija el kit para que no haya solapes.
 */
export const ORBIT = {
  squash: 0.55,
  squashCompact: 0.85,
  sweepDeg: { outer: 24, middle: 36, inner: 52 },
  radii: { outer: 46, middle: 32, inner: 19 }, // % del ancho del escenario
  maxNodes: { outer: 4, middle: 3, inner: 2 },
} as const;

/** Opciones de viewport para framer-motion: cada elemento entra una sola vez. */
export const VIEWPORT_ONCE = { once: true, amount: 0.3 } as const;

/** Transición de entrada de marca para framer-motion. */
export const brandTransition = (delay = 0) => ({
  duration: DURATION.base,
  ease: EASE_BRAND,
  delay,
});
