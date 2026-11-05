// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ComparisonProps = {
  /** Dos `ComparisonColumn`. */
  children: ReactNode;
  className?: string;
};

/**
 * Pieza `comparativa` del catálogo SAU: dos columnas que entran por turno.
 * Solo CSS.
 */
export function Comparison({ children, className }: ComparisonProps) {
  return (
    <div
      className={cn("motion-compare mb-8 grid gap-4 md:grid-cols-2", className)}
      data-motion="comparativa"
    >
      {children}
    </div>
  );
}

type ComparisonColumnProps = {
  title?: ReactNode;
  /** `true` marca la columna recomendada con el color de acento. */
  highlight?: boolean;
  children: ReactNode;
};

export function ComparisonColumn({ title, highlight = false, children }: ComparisonColumnProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-6 [&>*:last-child]:mb-0",
        highlight
          ? "border-primary/50 bg-primary/10"
          : "border-border bg-muted/40",
      )}
    >
      {title ? <p className="mb-4 text-xl font-semibold text-foreground">{title}</p> : null}
      {children}
    </div>
  );
}
