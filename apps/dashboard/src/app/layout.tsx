import type { ReactNode } from "react";
import "./globals.css";
export const metadata = {
  title: "VeoBible Studio",
  description: "Video production dashboard",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
