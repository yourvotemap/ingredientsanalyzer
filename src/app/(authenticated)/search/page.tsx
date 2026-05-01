import SearchClient from "@/components/SearchClient";

export const metadata = {
  title: "美容成分検索・健康食品成分検索 | Beauty Health DB",
  description: "化粧品成分と健康食品成分を横断検索。タグ・スコア・INCI名で絞り込み可能。",
};

export default function SearchPage() {
  return <SearchClient />;
}
