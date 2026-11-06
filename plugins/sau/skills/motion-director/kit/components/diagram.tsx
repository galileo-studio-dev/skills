// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DiagramNode = {
  id: string;
  /** Hasta 3 palabras, texto real. */
  label: string;
  /** Texto mono pequeño bajo la etiqueta. */
  sublabel?: string;
  /** Icono decorativo (se oculta a lectores de pantalla). */
  icon?: ReactNode;
  /** Posición del centro del nodo en % del escenario (0–100). */
  x: number;
  y: number;
  /** Nodo principal: borde y halo de acento. */
  emphasis?: boolean;
  /** Orden de entrada. Por defecto, su posición en la lista. */
  order?: number;
};

export type DiagramEdge = { from: string; to: string; dashed?: boolean };

type DiagramProps = {
  /** Obligatorio: describe el esquema en una frase (figcaption, texto real). */
  caption: string;
  /** De 3 a 7 nodos. */
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  aspect?: "1/1" | "4/3" | "16/9";
  /** `false`: el figcaption queda solo para lectores de pantalla. */
  showCaption?: boolean;
  className?: string;
};

/**
 * Pieza `esquema` del catálogo SAU (en prueba; destacada, máx. 2 por página, nunca en el hero):
 * 3–7 nodos unidos por conectores. Los nodos aparecen en orden y cada conector crece desde su
 * nodo de origen (escala uniforme desde ese punto, solo `transform`). Todo sobre la línea de
 * tiempo de la figura (`--motion-diagram`).
 */
export function Diagram({ caption, nodes, edges, aspect = "4/3", showCaption = true, className }: DiagramProps) {
  if (nodes.length < 3 || nodes.length > 7) {
    throw new Error(`Diagram: necesita de 3 a 7 nodos (tiene ${nodes.length}).`);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) throw new Error(`Diagram: conector ${e.from} → ${e.to} con un nodo que no existe.`);
  }
  if (nodes.length > 5 && process.env.NODE_ENV !== "production") {
    console.warn(`Diagram «${caption}»: ${nodes.length} nodos; revisa la captura a 375 px por si se pisan etiquetas.`);
  }
  // Paso de entrada de cada nodo: 0, 1, 2… según `order` (o su posición en la lista).
  const sorted = nodes.map((n, i) => ({ id: n.id, key: n.order ?? i, i })).sort((a, b) => a.key - b.key || a.i - b.i);
  const step = new Map(sorted.map((s, k) => [s.id, k]));

  return (
    <figure
      className={cn("motion-diagram", className)}
      data-motion="esquema"
      style={{ "--motion-diagram-aspect": aspect.replace("/", " / ") } as CSSProperties}
    >
      <div className="motion-diagram-stage">
        <svg aria-hidden="true" className="motion-diagram-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
          {edges.map((e) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            return (
              <line
                key={`${e.from}-${e.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                strokeDasharray={e.dashed ? "3 5" : undefined}
                data-dashed={e.dashed ? "" : undefined}
                style={{ "--motion-step": step.get(e.from)! + 0.5, transformOrigin: `${a.x}px ${a.y}px` } as CSSProperties}
              />
            );
          })}
        </svg>
        <ol className="motion-diagram-nodes">
          {[...nodes]
            .sort((a, b) => step.get(a.id)! - step.get(b.id)!)
            .map((n) => (
              <li
                key={n.id}
                data-emphasis={n.emphasis ? "" : undefined}
                style={{ left: `${n.x}%`, top: `${n.y}%`, "--motion-step": step.get(n.id)! } as CSSProperties}
              >
                <span className="motion-diagram-node">
                  <span aria-hidden="true" className="motion-diagram-icon">
                    {n.icon ?? <span className="motion-diagram-dot" />}
                  </span>
                  <span className="motion-diagram-label">{n.label}</span>
                  {n.sublabel ? <span className="motion-diagram-sublabel">{n.sublabel}</span> : null}
                </span>
              </li>
            ))}
        </ol>
      </div>
      <figcaption className={showCaption ? "motion-diagram-caption" : "sr-only"}>{caption}</figcaption>
    </figure>
  );
}
