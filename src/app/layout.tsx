import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "成分分析ツール | Ingredient Analyzer",
  description: "化粧品・健康食品の成分解析・販促ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
