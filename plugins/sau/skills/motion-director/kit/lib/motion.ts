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

/** Desplazamiento vertical de entrada, en píxeles. */
export const RISE_DISTANCE = 24;

/** Opciones de viewport para framer-motion: cada elemento entra una sola vez. */
export const VIEWPORT_ONCE = { once: true, amount: 0.3 } as const;

/** Transición de entrada de marca para framer-motion. */
export const brandTransition = (delay = 0) => ({
  duration: DURATION.base,
  ease: EASE_BRAND,
  delay,
});
