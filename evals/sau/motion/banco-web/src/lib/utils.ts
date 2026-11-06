// Equivalente mínimo del `cn` de shadcn/ui que importan las piezas del kit.
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}
