import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminClient from "@/components/AdminClient";

export default async function AdminPage() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "admin") {
    redirect("/");
  }

  const [ingredientCount, productCount, importLogs] = await Promise.all([
    prisma.ingredient.count(),
    prisma.product.count(),
    prisma.importLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">管理画面</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500">成分数</div>
          <div className="text-2xl font-bold">{ingredientCount.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500">製品数</div>
          <div className="text-2xl font-bold">{productCount.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-sm text-gray-500">最終インポート</div>
          <div className="text-sm font-medium mt-1">
            {importLogs[0]
              ? new Date(importLogs[0].createdAt).toLocaleString("ja-JP")
              : "なし"}
          </div>
        </div>
      </div>

      <AdminClient importLogs={importLogs} />
    </div>
  );
}
