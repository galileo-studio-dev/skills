// ARCHIVO GENERADO por install_kit.py del kit de motion-director (plugin sau).
// No lo edites en src/: edita el kit del plugin y vuelve a instalar.
import type { Root, RootContent, Parent, Paragraph, PhrasingContent, List, ListItem, BlockContent } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";
// Tipos de `data.hName` / `data.hProperties` / `data.hChildren`. Los declara mdast-util-to-hast
// (dependencia de remark-rehype y react-markdown). Sin esta línea, el archivo no compila fuera
// de un proyecto que ya cargue esos tipos por otro lado.
import type {} from "mdast-util-to-hast";

/**
 * Bloques de movimiento admitidos en el Markdown del blog (catálogo SAU).
 * Mantener alineado con motion-catalog.md de la skill motion-director.
 */
export const MOTION_CONTAINERS = ["pasos", "comparativa", "columna", "cita-destacada", "filas"] as const;
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

  const attrs = node.attributes ?? {};
  // Lista blanca de atributos por bloque. Cualquier otro atributo se ignora.
  if (node.name === "columna" && "destacada" in attrs) {
    props.dataHighlight = "true";
  }
  if (node.name === "bento") {
    if (attrs.columnas && ["2", "3", "4"].includes(attrs.columnas)) props.dataColumns = attrs.columnas;
    if ("numerada" in attrs) props.dataNumbered = "";
  }

  data.hProperties = props;

  const list = node.children.find((c): c is List => c.type === "list");
  if (list && node.name === "filas") listToRows(list);
  if (list && node.name === "cifras") listToFigures(list);
}

/** Separa el primer `**negrita**` de un elemento de lista: devuelve la negrita y el resto. */
function splitLead(item: ListItem): { lead: PhrasingContent[] | null; rest: PhrasingContent[]; extra: BlockContent[] } {
  const [first, ...extra] = item.children as BlockContent[];
  if (!first || first.type !== "paragraph") return { lead: null, rest: [], extra: item.children as BlockContent[] };
  const kids = [...first.children];
  const head = kids[0];
  if (head?.type !== "strong") return { lead: null, rest: kids, extra };
  kids.shift();
  const next = kids[0];
  if (next?.type === "text") {
    const value = next.value.replace(/^\s+/, "");
    if (value) kids[0] = { ...next, value };
    else kids.shift();
  }
  return { lead: head.children, rest: kids, extra };
}

/** Nodo de bloque que se convierte en `<tag>` con frases dentro (o con bloques, si hay más de un párrafo). */
function asElement(tag: string, phrasing: PhrasingContent[], extra: BlockContent[] = [], className?: string[]): BlockContent {
  const hProperties = className ? { className } : {};
  if (!extra.length) {
    return { type: "paragraph", children: phrasing, data: { hName: tag, hProperties } };
  }
  const blocks: BlockContent[] = phrasing.length ? [{ type: "paragraph", children: phrasing }, ...extra] : extra;
  return { type: "blockquote", children: blocks, data: { hName: tag, hProperties } };
}

/** Quita el punto final de la etiqueta («**RGPD.**» → «RGPD»). */
function withoutFinalDot(nodes: PhrasingContent[]): PhrasingContent[] {
  const out = [...nodes];
  const last = out[out.length - 1];
  if (last?.type === "text") out[out.length - 1] = { ...last, value: last.value.replace(/\.\s*$/, "") };
  return out;
}

/** `filas`: lista → `<dl>`; cada elemento → `<div><dt>etiqueta</dt><dd>texto</dd></div>`. */
function listToRows(list: List) {
  (list.data ??= {}).hName = "dl";
  for (const item of list.children) {
    const { lead, rest, extra } = splitLead(item);
    const children: BlockContent[] = [];
    if (lead) children.push(asElement("dt", withoutFinalDot(lead)));
    children.push(asElement("dd", rest, extra));
    item.children = children;
    (item.data ??= {}).hName = "div";
  }
}

/** `cifras`: lista → `<dl>`; cada elemento → `<div><dt>explicación</dt><dd class="motion-figure-value">…</dd></div>`. */
function listToFigures(list: List) {
  (list.data ??= {}).hName = "dl";
  for (const item of list.children) {
    const { lead, rest, extra } = splitLead(item);
    const children: BlockContent[] = [asElement("dt", rest, extra)];
    if (lead) {
      children.push({
        type: "paragraph",
        children: lead,
        data: {
          hName: "dd",
          hProperties: { className: ["motion-figure-value"] },
          hChildren: [
            { type: "element", tagName: "span", properties: { className: ["motion-mask-inner"] }, children: [{ type: "text", value: plainText(lead as RootContent[]) }] },
          ],
        },
      });
    }
    item.children = children;
    (item.data ??= {}).hName = "div";
  }
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
