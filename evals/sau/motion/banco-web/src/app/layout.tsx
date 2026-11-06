import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata = { title: "Banco de motion (SAU)" };

// Geist y Geist Mono, como galileo-studio-web (variables --font-geist-sans y --font-geist-mono),
// para que las capturas que revisa Pelayo lleven la tipografía real de Galileo.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
