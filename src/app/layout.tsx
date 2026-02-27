import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nacho busca laburo",
  description: "Envío masivo de CV por email",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
