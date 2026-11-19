// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
"use client";

import { useEffect, useRef, type ComponentProps } from "react";

/**
 * Capa del flujo de `esquema` (la usa `Diagram`). Pausa el bucle de los puntos mientras se hace scroll
 * (vuelve 200 ms después de parar) y mientras el esquema está fuera de pantalla: `data-scrolling` y
 * `data-offscreen` ponen `animation-play-state: paused` en motion.css. Un bucle con reloj que corre
 * durante el scroll obliga a Chrome a actualizar en el hilo principal, en cada frame, todas las piezas
 * ligadas al scroll de la página (en /es/legal, de 110 a 46 fps con CPU 4x). Los atributos cambian una
 * vez por gesto, no por evento. Con movimiento reducido el flujo no existe (display: none).
 */
export function DiagramFlow(props: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: number | undefined;
    const onScroll = () => {
      if (timer === undefined) el.setAttribute("data-scrolling", "");
      else window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.removeAttribute("data-scrolling");
        timer = undefined;
      }, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(([entry]) => el.toggleAttribute("data-offscreen", !entry.isIntersecting));
    observer?.observe(el);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);
  return <div ref={ref} {...props} />;
}
