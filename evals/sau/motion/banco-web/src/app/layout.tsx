import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Banco de motion (SAU)" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
