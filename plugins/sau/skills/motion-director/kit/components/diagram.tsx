// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DiagramNode = {
  id: string;
  /** Hasta 3 palabras, texto real. */
  label: string;
  /** Texto mono pequeño bajo la etiqueta. Se escribe tal cual (respeta «vLLM», «Open WebUI»). */
  sublabel?: string;
  /** Icono decorativo (se oculta a lectores de pantalla). */
  icon?: ReactNode;
  /** Posición del centro del icono en % del escenario (0–100). Solo con `layout="stage"`. */
  x?: number;
  y?: number;
  /** Nodo principal: tile de acento con brillo y halo. */
  emphasis?: boolean;
  /** Nodo fuera del perímetro (p. ej. una API pública): tono apagado. */
  outside?: boolean;
  /** Orden de entrada. Por defecto, su posición en la lista. */
  order?: number;
};

/**
 * Conector. `cut`: conexión cortada (trazo discontinuo y marca de corte); entra con un fundido, la última.
 * `dashed`: discontinuo sin marca (también entra con fundido: un trazo discontinuo que escala se deforma).
 */
export type DiagramEdge = {
  from: string;
  to: string;
  dashed?: boolean;
  cut?: boolean;
  /** Dónde va la marca de corte, en fracción del conector (0 = origen, 1 = destino). Por defecto 0,5. */
  cutAt?: number;
};

type DiagramProps = {
  /** Obligatorio: describe el esquema en una frase (figcaption, texto real). */
  caption: string;
  /** De 3 a 7 nodos. */
  nodes: DiagramNode[];
  /** Solo con `layout="stage"`. En `row`, los nodos se unen en orden. */
  edges?: DiagramEdge[];
  /**
   * `stage` (por defecto): escenario con proporción fija y nodos en (x, y).
   * `row`: una fila de capas o pasos unidos en orden; alto según el contenido. En móvil se apila en columna.
   */
  layout?: "stage" | "row";
  aspect?: "1/1" | "4/3" | "16/9";
  /** Perímetro (solo `stage`): rectángulo discontinuo con etiqueta. `box` en % del escenario. */
  perimeter?: { label: string; box?: { left: number; top: number; right: number; bottom: number } };
  /** `false`: el figcaption queda solo para lectores de pantalla. */
  showCaption?: boolean;
  className?: string;
};

/** Identificador estable para los degradados de los conectores (sin estado ni hooks). */
function slug(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

function NodeBody({ n }: { n: DiagramNode }) {
  return (
    <span className="motion-diagram-node">
      <span aria-hidden="true" className="motion-diagram-icon">
        {n.icon ?? <span className="motion-diagram-dot" />}
      </span>
      <span className="motion-diagram-text">
        <span className="motion-diagram-label">{n.label}</span>
        {n.sublabel ? <span className="motion-diagram-sublabel">{n.sublabel}</span> : null}
      </span>
    </span>
  );
}

/**
 * Pieza `esquema` del catálogo SAU (en prueba; destacada, máx. 2 por página, nunca en el hero):
 * 3–7 nodos unidos por conectores. Cada conector crece desde su nodo de origen y su nodo destino
 * aparece cuando la línea lleva unos dos tercios: la línea «lleva» al nodo. Las conexiones cortadas
 * entran al final, con un fundido. Solo `transform` y `opacity`, sobre la línea de tiempo de la figura.
 */
export function Diagram({
  caption,
  nodes,
  edges = [],
  layout = "stage",
  aspect = "4/3",
  perimeter,
  showCaption = true,
  className,
}: DiagramProps) {
  if (nodes.length < 3 || nodes.length > 7) {
    throw new Error(`Diagram: necesita de 3 a 7 nodos (tiene ${nodes.length}).`);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) throw new Error(`Diagram: conector ${e.from} → ${e.to} con un nodo que no existe.`);
  }
  if (layout === "stage" && nodes.some((n) => n.x === undefined || n.y === undefined)) {
    throw new Error("Diagram: con layout=\"stage\" cada nodo necesita x e y.");
  }
  if (nodes.length > 5 && process.env.NODE_ENV !== "production") {
    console.warn(`Diagram «${caption}»: ${nodes.length} nodos; revisa la captura a 390 px por si se pisan etiquetas.`);
  }
  // Paso de entrada de cada nodo: 0, 1, 2… según `order` (o su posición en la lista).
  const sorted = nodes.map((n, i) => ({ id: n.id, key: n.order ?? i, i })).sort((a, b) => a.key - b.key || a.i - b.i);
  const step = new Map(sorted.map((s, k) => [s.id, k]));
  const last = nodes.length - 1;
  const ordered = sorted.map((s) => byId.get(s.id)!);
  const id = `motion-wire-${slug(caption)}`;

  if (layout === "row") {
    return (
      <figure className={cn("motion-diagram", className)} data-motion="esquema" data-layout="row">
        <ol className="motion-diagram-row">
          {ordered.map((n, k) => (
            <li key={n.id} data-emphasis={n.emphasis ? "" : undefined} style={{ "--motion-step": k } as CSSProperties}>
              <NodeBody n={n} />
            </li>
          ))}
        </ol>
        <figcaption className={showCaption ? "motion-diagram-caption" : "sr-only"}>{caption}</figcaption>
      </figure>
    );
  }

  const box = perimeter?.box ?? { left: 3, top: 12, right: 18, bottom: 3 };
  return (
    <figure
      className={cn("motion-diagram", className)}
      data-motion="esquema"
      data-layout="stage"
      style={{ "--motion-diagram-aspect": aspect.replace("/", " / ") } as CSSProperties}
    >
      <div className="motion-diagram-stage">
        {perimeter ? (
          <div
            aria-hidden="true"
            className="motion-diagram-perimeter"
            style={{ left: `${box.left}%`, top: `${box.top}%`, right: `${box.right}%`, bottom: `${box.bottom}%` }}
          >
            <span className="motion-diagram-perimeter-label">{perimeter.label}</span>
          </div>
        ) : null}
        <svg aria-hidden="true" className="motion-diagram-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {edges.map((e, i) => {
              const a = byId.get(e.from)!;
              const b = byId.get(e.to)!;
              return (
                <linearGradient key={i} id={`${id}-${i}`} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
                  <stop offset="0%" className="motion-diagram-wire-from" />
                  <stop offset="100%" className="motion-diagram-wire-to" />
                </linearGradient>
              );
            })}
          </defs>
          {edges.map((e, i) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const faded = e.cut || e.dashed;
            // El conector va a la par con su destino: empieza 0,6 pasos antes que su nodo destino.
            // Los cortados y discontinuos entran los últimos, con un fundido.
            const s = faded ? last + 0.4 : step.get(e.to)! - 0.6;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={`url(#${id}-${i})`}
                strokeDasharray={faded ? "3 5" : undefined}
                data-kind={e.cut ? "cut" : faded ? "dashed" : "wire"}
                data-to={e.to}
                style={{ "--motion-step": s, transformOrigin: `${a.x}px ${a.y}px` } as CSSProperties}
              />
            );
          })}
        </svg>
        {edges
          .filter((e) => e.cut)
          .map((e, i) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const f = e.cutAt ?? 0.5;
            return (
              <span
                key={i}
                aria-hidden="true"
                className="motion-diagram-cut"
                style={{ left: `${a.x! + (b.x! - a.x!) * f}%`, top: `${a.y! + (b.y! - a.y!) * f}%`, "--motion-step": last + 0.4 } as CSSProperties}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M5.7 5.7l12.6 12.6" />
                </svg>
              </span>
            );
          })}
        <ol className="motion-diagram-nodes">
          {ordered.map((n) => (
            <li
              key={n.id}
              data-emphasis={n.emphasis ? "" : undefined}
              data-outside={n.outside ? "" : undefined}
              style={{ left: `${n.x}%`, top: `${n.y}%`, "--motion-step": step.get(n.id)! } as CSSProperties}
            >
              <NodeBody n={n} />
            </li>
          ))}
        </ol>
      </div>
      <figcaption className={showCaption ? "motion-diagram-caption" : "sr-only"}>{caption}</figcaption>
    </figure>
  );
}
