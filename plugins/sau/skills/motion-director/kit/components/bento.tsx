// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BentoProps = {
  /** Columnas desde 64rem. Por defecto 3. Por debajo: 1 (móvil) y 2 (desde 40rem). */
  columns?: 2 | 3 | 4;
  /** `grid`: tarjetas pegadas con separadores de 1 px. Solo TSX (necesita `BentoItem`). */
  variant?: "cards" | "grid";
  /** Añade "01", "02"… arriba a la izquierda (contador CSS, no se lee). */
  numbered?: boolean;
  className?: string;
  /** Un `<ul>` con `<BentoItem>` (TSX) o el `<ul>` que genera `:::bento` en el Markdown. */
  children: ReactNode;
};

/**
 * Pieza `bento` del catálogo SAU (de bloque): rejilla de 2–8 tarjetas que suben
 * escalonadas por columna. El escalonado sale de la posición en la rejilla (CSS), sin `index`.
 */
export function Bento({ columns = 3, variant = "cards", numbered = false, className, children }: BentoProps) {
  return (
    <div
      className={cn("motion-bento", className)}
      data-motion="bento"
      data-columns={columns}
      data-variant={variant}
      data-numbered={numbered ? "" : undefined}
    >
      {children}
    </div>
  );
}

type BentoItemProps = {
  /** Título de la tarjeta. */
  title: ReactNode;
  /** Icono decorativo (se oculta a lectores de pantalla). */
  icon?: ReactNode;
  /** Etiqueta del título. Por defecto `h3`: debe haber un H2 encima. */
  headingLevel?: "h3" | "p";
  /** Borde discontinuo y sin fondo (p. ej. la tarjeta «frente a la nube»). */
  muted?: boolean;
  /** Descripción. */
  children?: ReactNode;
};

export function BentoItem({ title, icon, headingLevel: Heading = "h3", muted = false, children }: BentoItemProps) {
  return (
    <li data-muted={muted ? "" : undefined}>
      <div className="motion-bento-body">
        {icon ? (
          <span aria-hidden="true" className="motion-bento-icon">
            {icon}
          </span>
        ) : null}
        <Heading className="motion-bento-title">{title}</Heading>
        {children ? <div className="motion-bento-text">{children}</div> : null}
      </div>
    </li>
  );
}
