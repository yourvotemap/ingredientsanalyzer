"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/search", label: "💄 化粧品成分検索", dataPage: "search-cosmetics" },
  { href: "/search?mode=health", label: "🌿 健康食品検索", dataPage: "search-health" },
  { href: "/builder", label: "理想設計", dataPage: "builder" },
  { href: "/catalog", label: "おすすめ製品", dataPage: "catalog" },
  { href: "/ingredients", label: "成分一覧(DB)", dataPage: "ingredients" },
  { href: "/ranking", label: "ランキング", dataPage: "ranking" },
  { href: "/mongolia", label: "モンゴル産特集", dataPage: "mongolia" },
];

export default function Navigation({ userName }: { userName?: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20" style={{ background: "rgba(245,247,251,.96)", backdropFilter: "blur(8px)" }}>
      <div className="max-w-[1360px] mx-auto px-6 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 m-0">Beauty & Health 成分分析</h1>
            <p className="text-sm text-gray-500 mt-1">成分データで製品の実力を可視化</p>
          </div>
          <div className="flex items-center gap-2">
            {userName && (
              <span className="text-sm text-gray-600">{userName}</span>
            )}
            <Link
              href="/admin"
              className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-white text-indigo-600 text-sm font-bold hover:bg-indigo-50 transition"
            >
              管理画面
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 text-sm font-bold hover:bg-red-50 hover:text-red-600 transition"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>

        <nav className="flex gap-2.5 flex-wrap">
          {tabs.map((tab) => {
            const isActive =
              tab.href === "/"
                ? pathname === "/"
                : tab.href === "/search"
                ? pathname === "/search"
                : tab.href === "/search?mode=health"
                ? false
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                  isActive
                    ? "bg-[#2563eb] border-[#2563eb] text-white shadow-md"
                    : "bg-[#eef2ff] border-[#c7d2fe] text-[#1d4ed8] hover:bg-[#dbeafe]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
