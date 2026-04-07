"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/ingredients", label: "成分データベース", icon: "🧪" },
  { href: "/catalog", label: "カタログ", icon: "📦" },
  { href: "/ranking", label: "ランキング", icon: "🏆" },
  { href: "/builder", label: "ビルダー", icon: "⚙️" },
  { href: "/admin", label: "管理", icon: "🔧" },
];

export default function Navigation({ userName }: { userName?: string }) {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <span className="font-bold text-blue-600 text-lg mr-4">
              成分分析ツール
            </span>
            {tabs.map((tab) => {
              const isActive =
                tab.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            {userName && (
              <span className="text-sm text-gray-600">{userName}</span>
            )}
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}
