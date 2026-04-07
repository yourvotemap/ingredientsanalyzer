"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function IngredientSearch({
  currentQuery,
  currentDomain,
  currentTag,
  tags,
}: {
  currentQuery: string;
  currentDomain: string;
  currentTag: string;
  tags: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(currentQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (currentDomain) params.set("domain", currentDomain);
    if (currentTag) params.set("tag", currentTag);
    router.push(`/ingredients?${params.toString()}`);
  };

  const setDomain = (domain: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (domain) params.set("domain", domain);
    if (currentTag) params.set("tag", currentTag);
    router.push(`/ingredients?${params.toString()}`);
  };

  const setTag = (tag: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (currentDomain) params.set("domain", currentDomain);
    if (tag) params.set("tag", tag);
    router.push(`/ingredients?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <form onSubmit={handleSearch} className="flex gap-3 mb-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="成分名、INCI名、別名で検索..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          検索
        </button>
      </form>

      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-gray-500 mr-1">区分:</span>
        {["", "cosmetics", "healthfood", "both"].map((d) => (
          <button
            key={d}
            onClick={() => setDomain(d)}
            className={`text-xs px-3 py-1 rounded-full transition ${
              currentDomain === d
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {d === ""
              ? "すべて"
              : d === "cosmetics"
              ? "化粧品"
              : d === "healthfood"
              ? "健康食品"
              : "両方"}
          </button>
        ))}

        <span className="text-xs text-gray-500 ml-3 mr-1">タグ:</span>
        <select
          value={currentTag}
          onChange={(e) => setTag(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none"
        >
          <option value="">すべて</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
