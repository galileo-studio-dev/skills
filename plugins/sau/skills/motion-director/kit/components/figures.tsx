// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FiguresProps = {
  /** Un `<dl>` con `<Figure>` (TSX) o el `<dl>` que genera `:::cifras` en el Markdown. */
  children: ReactNode;
  className?: string;
};

/**
 * Pieza `cifras` del catálogo SAU (en prueba; de bloque, una por página): de 2 a 4 cifras
 * clave. El número sube por máscara y su explicación detrás. Sin contador: el número final
 * está siempre en el HTML. Nunca una cifra sin fuente.
 */
export function Figures({ children, className }: FiguresProps) {
  return (
    <div className={cn("motion-figures", className)} data-motion="cifras">
      {children}
    </div>
  );
}

type FigureProps = {
  /** Texto final de la cifra, corto (hasta 8 caracteres): "0 €", "100 %", "24/7". */
  value: string;
  /** Explicación, una frase. En el DOM va antes que el número: se lee «explicación: cifra». */
  label: ReactNode;
  /** Fuente o matiz, pequeño. */
  note?: ReactNode;
};

export function Figure({ value, label, note }: FigureProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="motion-figure-value">
        <span className="motion-mask-inner">{value}</span>
      </dd>
      {note ? <dd className="motion-figure-note">{note}</dd> : null}
    </div>
  );
}
