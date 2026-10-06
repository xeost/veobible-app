import { cookies } from "next/headers";
import { I18nProvider } from "../i18n/context";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata = {
  title: "VeoBible Dashboard",
  description: "Video production dashboard",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const language =
    (await cookies()).get("veo_language")?.value === "en" ? "en" : "es";
  return (
    <html lang={language}>
      <body>
        <I18nProvider initialLanguage={language}>{children}</I18nProvider>
      </body>
    </html>
  );
}
