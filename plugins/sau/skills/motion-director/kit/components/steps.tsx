// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StepsProps = {
  /** Una lista ordenada (`<ol>`). Cada `<li>` es un paso. */
  children: ReactNode;
  className?: string;
};

/**
 * Pieza `pasos` del catálogo SAU: numera los pasos, los hace entrar uno a uno
 * y traza la línea que los une al hacer scroll. Solo CSS.
 */
export function Steps({ children, className }: StepsProps) {
  return (
    <div className={cn("motion-steps mb-6", className)} data-motion="pasos">
      <span aria-hidden="true" className="motion-steps-line" />
      {children}
    </div>
  );
}
