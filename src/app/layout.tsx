import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美容成分検索・健康食品成分検索 | Beauty Health DB",
  description: "化粧品成分14,000件・健康食品成分670件を横断検索。タグ・スコア・INCI名で絞り込み可能。",
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
