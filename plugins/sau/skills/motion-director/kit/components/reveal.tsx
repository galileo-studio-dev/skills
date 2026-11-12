// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  /** Etiqueta HTML del contenedor. Por defecto, `div`. */
  as?: ElementType;
  /**
   * - `rise`: sube y aparece al entrar en pantalla (bloques, párrafos, tarjetas).
   * - `mask`: el texto sube recortado por una máscara (títulos de una o dos líneas).
   */
  variant?: "rise" | "mask";
  className?: string;
  /**
   * Posición dentro de un grupo (0, 1, 2…). Escalona la entrada de elementos que
   * entran a la vez, como las tarjetas de una fila. Máximo útil: 5.
   */
  index?: number;
  children: ReactNode;
};

/**
 * Entrada de marca al hacer scroll. Pieza `reveal` del catálogo SAU.
 * Solo CSS (sin JavaScript). No usar en el H1 ni en el elemento LCP.
 */
export function Reveal({ as: Tag = "div", variant = "rise", className, index, children }: RevealProps) {
  const style = index ? ({ "--motion-index": Math.min(index, 5) } as CSSProperties) : undefined;
  if (variant === "mask") {
    return (
      <Tag className={cn("motion-mask", className)} style={style}>
        <span className="motion-mask-inner">{children}</span>
      </Tag>
    );
  }
  return (
    <Tag className={cn("motion-reveal", className)} style={style}>
      {children}
    </Tag>
  );
}
