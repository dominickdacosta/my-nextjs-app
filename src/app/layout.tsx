import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Home Together | Family Task Board",
  description: "A cheerful shared board for keeping household tasks moving.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
