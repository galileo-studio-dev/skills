// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { Root, RootContent, Parent, Paragraph, PhrasingContent } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";

/**
 * Bloques de movimiento admitidos en el Markdown del blog (catálogo SAU).
 * Mantener alineado con motion-catalog.md de la skill motion-director.
 */
export const MOTION_CONTAINERS = ["pasos", "comparativa", "columna", "cita-destacada"] as const;
export type MotionContainer = (typeof MOTION_CONTAINERS)[number];

type DirectiveNode = ContainerDirective | LeafDirective | TextDirective;

function isDirective(node: RootContent): node is DirectiveNode {
  return (
    node.type === "containerDirective" ||
    node.type === "leafDirective" ||
    node.type === "textDirective"
  );
}

function plainText(nodes: readonly RootContent[]): string {
  return nodes
    .map((n) => {
      if ("value" in n && typeof n.value === "string") return n.value;
      if ("children" in n) return plainText(n.children as RootContent[]);
      return "";
    })
    .join("");
}

/** Devuelve el texto original de una directiva que no pertenece al catálogo. */
function directiveAsText(node: LeafDirective | TextDirective): string {
  const prefix = node.type === "leafDirective" ? "::" : ":";
  const label = node.children.length ? `[${plainText(node.children)}]` : "";
  const attrs = Object.entries(node.attributes ?? {})
    .map(([key, value]) => (value ? `${key}="${value}"` : key))
    .join(" ");
  return `${prefix}${node.name}${label}${attrs ? `{${attrs}}` : ""}`;
}

function transformContainer(node: ContainerDirective) {
  const data = (node.data ??= {});
  data.hName = "div";

  if (!(MOTION_CONTAINERS as readonly string[]).includes(node.name)) {
    // Bloque desconocido: el contenido se muestra sin movimiento.
    data.hProperties = {};
    return;
  }

  const props: Record<string, string | boolean> = { dataMotion: node.name };

  // La etiqueta `:::columna[Título]` llega como primer párrafo marcado.
  const first = node.children[0] as Paragraph | undefined;
  if (first?.type === "paragraph" && first.data && "directiveLabel" in first.data) {
    props.dataTitle = plainText(first.children as RootContent[]);
    node.children.shift();
  }

  if (node.attributes && "destacada" in node.attributes) {
    props.dataHighlight = "true";
  }

  data.hProperties = props;
}

function walk(parent: Parent) {
  parent.children.forEach((child, index) => {
    const node = child as RootContent;
    if (isDirective(node)) {
      if (node.type === "containerDirective") {
        transformContainer(node);
      } else if (node.type === "leafDirective") {
        const paragraph: Paragraph = {
          type: "paragraph",
          children: [{ type: "text", value: directiveAsText(node) }],
        };
        parent.children[index] = paragraph as (typeof parent.children)[number];
        return;
      } else {
        const text: PhrasingContent = { type: "text", value: directiveAsText(node) };
        parent.children[index] = text as (typeof parent.children)[number];
        return;
      }
    }
    if ("children" in node) walk(node as Parent);
  });
}

/**
 * Plugin remark: convierte los bloques `:::` del catálogo en `<div data-motion>`.
 * Las directivas de texto o de línea (`:algo`, `::algo`) no se usan: vuelven a texto,
 * para que un "Nota:importante" del contenido no desaparezca.
 * Usar después de `remark-directive`.
 */
export function remarkMotion() {
  return (tree: Root) => {
    walk(tree);
  };
}
