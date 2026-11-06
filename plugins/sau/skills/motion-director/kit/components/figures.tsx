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

/**
 * Separa la unidad de la cifra («16–24 GB» → «16–24» + «GB»): la unidad va más pequeña y en color de
 * acento. El hueco lo pone el CSS (un único margen), igual para «GB» que para «%»; el espacio sigue en el
 * texto (fino, sin salto, U+202F) para que se lea «16–24 GB», pero no ocupa sitio. Sin espacio, no hay unidad.
 */
export function splitUnit(value: string): { number: string; unit: string | null } {
  const i = value.lastIndexOf(" ");
  if (i <= 0) return { number: value, unit: null };
  return { number: value.slice(0, i).replace(/ /g, "\u202F"), unit: value.slice(i + 1) };
}

export function Figure({ value, label, note }: FigureProps) {
  const { number, unit } = splitUnit(value);
  return (
    <div>
      <dt>{label}</dt>
      <dd className="motion-figure-value">
        <span className="motion-mask-inner">
          {number}
          {unit ? (
            <span className="motion-figure-unit">
              <span className="motion-figure-space">{"\u202F"}</span>
              {unit}
            </span>
          ) : null}
        </span>
      </dd>
      {note ? <dd className="motion-figure-note">{note}</dd> : null}
    </div>
  );
}
