// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { CSSProperties, ReactNode } from "react";
import { ORBIT } from "@/lib/motion";
import { cn } from "@/lib/utils";

type OrbitNode = {
  /** Hasta 2 palabras. */
  label: string;
  icon?: ReactNode;
};

type RingName = "outer" | "middle" | "inner";

type OrbitProps = {
  /** Obligatorio: la idea en una frase (figcaption, texto real). El dibujo es decorativo. */
  caption: string;
  core: { label: string; sublabel?: string; icon?: ReactNode };
  /** De 1 a 4 nodos con etiqueta (chips). */
  outer: OrbitNode[];
  /** De 0 a 3 nodos, solo icono. */
  middle?: OrbitNode[];
  /** De 0 a 2 puntos sin contenido. */
  inner?: number;
  /** Anillos discontinuos. Por defecto, el exterior y el interior. */
  dashed?: RingName[];
  /** `false`: el figcaption queda solo para lectores de pantalla. */
  showCaption?: boolean;
  className?: string;
};

// Sentido, ángulo de partida (grados, horario desde las 3) y opacidad del trazo de cada anillo.
// Partida del anillo medio en 105°: como exterior y medio giran en sentidos contrarios, algún par
// se cruza siempre; con 105° el único cruce (exterior de 75° con medio de 105°) cae abajo, donde
// los anillos están más separados en vertical. Con +20° se cruzaban de lado y se pisaban a 768 y
// 375 px (lo detectó el banco de pruebas).
// Radios y tramos los fija el kit (ORBIT en motion.ts): no se pueden cambiar desde la página.
const RINGS: Record<RingName, { dir: 1 | -1; start: number; strokeOpacity: number }> = {
  inner: { dir: 1, start: 65, strokeOpacity: 0.4 },
  middle: { dir: -1, start: 105, strokeOpacity: 0.3 },
  outer: { dir: 1, start: -45, strokeOpacity: 0.45 },
};
const ORDER: RingName[] = ["inner", "middle", "outer"];

function Rings({ wide, dashed }: { wide: boolean; dashed: RingName[] }) {
  const w = wide ? 860 : 100;
  const h = wide ? 460 : 100;
  const squash = wide ? ORBIT.squash : ORBIT.squashCompact;
  return (
    <svg
      className={cn("motion-orbit-rings", wide ? "motion-orbit-rings-wide" : "motion-orbit-rings-compact")}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
    >
      {ORDER.map((ring, k) => {
        const rx = (ORBIT.radii[ring] / 100) * w;
        return (
          <ellipse
            key={ring}
            cx={w / 2}
            cy={h / 2}
            rx={rx}
            ry={rx * squash}
            stroke="currentColor"
            strokeOpacity={RINGS[ring].strokeOpacity}
            strokeWidth={wide ? 1.2 : 0.2}
            strokeDasharray={dashed.includes(ring) ? (wide ? "3 9" : "0.6 1.6") : undefined}
            style={{ "--motion-ring": k } as CSSProperties}
          />
        );
      })}
    </svg>
  );
}

/**
 * Pieza `orbita` del catálogo SAU (en prueba; destacada, máx. 1 por página, nunca en el hero ni
 * con intensidad `sobria`). Un núcleo con halo, 2–3 elipses y nodos que avanzan un tramo de su
 * órbita mientras la sección cruza la pantalla, cada anillo en sentido contrario al anterior.
 * Ligado al scroll (si el scroll para, la órbita para). Sin bucles ni JavaScript.
 * Geometría: rotaciones anidadas con contrarrotación sobre un plano aplastado con scaleY.
 */
export function Orbit({
  caption,
  core,
  outer,
  middle = [],
  inner = 0,
  dashed = ["outer", "inner"],
  showCaption = true,
  className,
}: OrbitProps) {
  if (outer.length < 1 || outer.length > 4) throw new Error(`Orbit: el anillo exterior lleva de 1 a 4 nodos (tiene ${outer.length}).`);
  if (middle.length > ORBIT.maxNodes.middle) throw new Error(`Orbit: el anillo medio lleva como máximo 3 nodos.`);
  if (inner < 0 || inner > ORBIT.maxNodes.inner) throw new Error(`Orbit: el anillo interior lleva como máximo 2 puntos.`);

  const items: Record<RingName, (OrbitNode | null)[]> = {
    inner: Array.from({ length: inner }, () => null),
    middle,
    outer,
  };

  return (
    <figure className={cn("motion-orbit", className)} data-motion="orbita">
      <div className="motion-orbit-stage" aria-hidden="true">
        <Rings wide dashed={dashed} />
        <Rings wide={false} dashed={dashed} />
        <div className="motion-orbit-halo" />
        <div className="motion-orbit-plane">
          {ORDER.map((ring) => {
            const list = items[ring];
            if (!list.length) return null;
            const { dir, start } = RINGS[ring];
            return (
              <div
                key={ring}
                className="motion-orbit-spin"
                data-ring={ring}
                style={{ "--motion-dir": dir, "--motion-sweep": `var(--motion-orbit-sweep-${ring})` } as CSSProperties}
              >
                {list.map((node, i) => {
                  const a = start + (i * 360) / list.length;
                  return (
                    <div
                      key={i}
                      className="motion-orbit-arm"
                      data-angle={a}
                      style={{ transform: `rotate(${a}deg) translateX(${ORBIT.radii[ring]}cqi) rotate(${-a}deg)` }}
                    >
                      <div className="motion-orbit-node">
                        {ring === "inner" || !node ? (
                          <span className="motion-orbit-chip" data-kind="dot" />
                        ) : (
                          <span className="motion-orbit-chip" data-kind={ring === "outer" ? "chip" : "icon"}>
                            <span className="motion-orbit-chip-icon">{node.icon}</span>
                            {ring === "outer" ? <span className="motion-orbit-chip-label">{node.label}</span> : null}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {/* Después del plano: los nodos que cruzan por el centro pasan por detrás del núcleo. */}
        <div className="motion-orbit-core-pos">
          <div className="motion-orbit-core">
            <span className="motion-orbit-core-icon">{core.icon}</span>
            <span className="motion-orbit-core-label">{core.label}</span>
            {core.sublabel ? <span className="motion-orbit-core-sublabel">{core.sublabel}</span> : null}
          </div>
        </div>
      </div>
      {/* Móvil: las etiquetas de los nodos (exteriores y, en estilo secundario, medios), en estático. */}
      <ul className="motion-orbit-legend" aria-hidden="true">
        {outer.map((n) => (
          <li key={`o-${n.label}`} data-ring="outer">
            <span className="motion-orbit-chip-icon">{n.icon}</span>
            {n.label}
          </li>
        ))}
        {middle.map((n) => (
          <li key={`m-${n.label}`} data-ring="middle">
            <span className="motion-orbit-chip-icon">{n.icon}</span>
            {n.label}
          </li>
        ))}
      </ul>
      <figcaption className={showCaption ? "motion-orbit-caption" : "sr-only"}>{caption}</figcaption>
    </figure>
  );
}
