// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Align = "left" | "center";

type SectionKickerProps = {
  /** Número de la sección ("02"), tal cual. */
  index: string;
  /** Etiqueta en mono: texto real. */
  children: string;
  align?: Align;
  className?: string;
};

/**
 * Etiqueta de sección: número mono + línea fina + etiqueta.
 * Dentro de `SectionHeading` se anima con la línea de tiempo del encabezado.
 * Suelta (fuera de un encabezado) se ve estática: es demasiado pequeña para su propia línea de tiempo.
 */
export function SectionKicker({ index, children, align = "left", className }: SectionKickerProps) {
  return (
    <p
      className={cn(
        "motion-kicker flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-primary",
        align === "center" && "justify-center",
        className,
      )}
      data-align={align}
    >
      <span aria-hidden="true" className="motion-kicker-index text-primary/60">
        {index}
      </span>
      <span aria-hidden="true" className="motion-kicker-line" />
      <span className="motion-kicker-label">{children}</span>
    </p>
  );
}

type SectionHeadingProps = {
  /** Número de la sección ("02"), tal cual. */
  index: string;
  /** Etiqueta mono, texto real. */
  eyebrow: string;
  /** Contenido del H2. */
  title: ReactNode;
  /** Párrafo bajo el H2 (cápsula de respuesta, si procede). */
  description?: ReactNode;
  /** Nivel del título. Por defecto, `h2`. */
  as?: "h2" | "h3";
  /** `center` centra el bloque y dibuja la línea desde el centro. */
  align?: Align;
  className?: string;
};

/**
 * Pieza `encabezado-seccion` del catálogo SAU (en prueba). Abre una sección numerada de una
 * página de servicio: número, línea que se dibuja, etiqueta, H2 por máscara y descripción.
 * Solo CSS: todo usa la línea de tiempo del encabezado (`--motion-heading`). Nunca en el hero.
 */
export function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  as: Tag = "h2",
  align = "left",
  className,
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={cn("motion-heading", centered && "mx-auto text-center", className)} data-motion="encabezado-seccion" data-align={align}>
      <SectionKicker index={index} align={align}>
        {eyebrow}
      </SectionKicker>
      <Tag
        className={cn(
          "motion-mask mt-6 max-w-3xl text-balance text-4xl font-medium leading-[1.04] tracking-[-0.04em] text-foreground md:text-5xl",
          centered && "mx-auto",
        )}
      >
        <span className="motion-mask-inner">{title}</span>
      </Tag>
      {description ? (
        <p className={cn("motion-heading-desc mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground", centered && "mx-auto")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
