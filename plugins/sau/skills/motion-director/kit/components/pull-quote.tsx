// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PullQuoteProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Pieza `cita-destacada` del catálogo SAU: una frase clave, grande, que sube
 * al entrar en pantalla. Solo CSS. Una por página como máximo.
 */
export function PullQuote({ children, className }: PullQuoteProps) {
  return (
    <figure
      className={cn(
        "motion-pull-quote my-12 border-l-2 border-primary pl-6 text-2xl font-semibold leading-snug text-foreground md:text-3xl [&_p]:mb-0 [&_p]:text-2xl [&_p]:font-semibold [&_p]:leading-snug [&_p]:text-foreground md:[&_p]:text-3xl",
        className,
      )}
      data-motion="cita-destacada"
    >
      {children}
    </figure>
  );
}
