"use client";
import type { ReactNode } from "react";

/** ROTO: componente con "use client". */
export function Roto({ children }: { children: ReactNode }) {
  return <div className="motion-roto">{children}</div>;
}
