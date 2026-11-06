// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type RowsProps = {
  /** Un `<dl>` con `<Row>` (TSX) o el `<dl>` que genera `:::filas` en el Markdown. */
  children: ReactNode;
  className?: string;
};

/**
 * Pieza `filas` del catálogo SAU (en prueba; de bloque): 2–6 pares etiqueta + texto.
 * Cada fila sube y el separador que tiene encima se dibuja de izquierda a derecha. Solo CSS.
 */
export function Rows({ children, className }: RowsProps) {
  return (
    <div className={cn("motion-rows", className)} data-motion="filas">
      {children}
    </div>
  );
}

type RowProps = {
  /** Etiqueta corta (hasta 3 palabras). */
  label: ReactNode;
  /** Texto de 1 a 3 frases. */
  children: ReactNode;
};

export function Row({ label, children }: RowProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
