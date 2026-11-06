import { useState, type ReactNode } from "react";

/** ROTO: estado de navegador en un componente del kit. */
export function Roto({ children }: { children: ReactNode }) {
  const [visible] = useState(true);
  return visible ? <div className="motion-roto">{children}</div> : null;
}
