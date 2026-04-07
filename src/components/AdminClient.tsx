"use client";

import { useState } from "react";

type ImportLog = {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  rowsProcessed: number;
  rowsSucceeded: number;
  rowsFailed: number;
  errorDetails: string | null;
  createdAt: Date;
};

export default function AdminClient({
  importLogs,
}: {
  importLogs: ImportLog[];
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [fileType, setFileType] = useState("ingredients");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls")
    ) {
      setMessage("エラー: .xlsx または .xls ファイルのみ対応しています");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setMessage("エラー: ファイルサイズが10MBを超えています");
      return;
    }

    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", fileType);

    try {
      const res = await fetch(`/api/${fileType}/import`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(
          `成功: ${data.rowsSucceeded}件インポート${
            data.rowsFailed > 0 ? `、${data.rowsFailed}件失敗` : ""
          }`
        );
        // Reload after short delay
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage(`エラー: ${data.error || "インポートに失敗しました"}`);
      }
    } catch {
      setMessage("エラー: サーバーとの通信に失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleExportTemplate = async (type: string) => {
    window.open(`/api/${type}/export-template`, "_blank");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* インポート */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">Excelインポート</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            インポート種別
          </label>
          <div className="flex gap-2">
            {[
              { value: "ingredients", label: "成分辞書" },
              { value: "products", label: "製品データ" },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setFileType(t.value)}
                className={`text-sm px-4 py-2 rounded-lg ${
                  fileType === t.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
          <div className="text-3xl mb-2">📥</div>
          <p className="text-sm text-gray-500 mb-3">
            Excelファイルをアップロード
          </p>
          <label className="inline-block cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            <span className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition cursor-pointer">
              {uploading ? "アップロード中..." : "ファイルを選択"}
            </span>
          </label>
        </div>

        {message && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              message.startsWith("エラー")
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            テンプレートダウンロード
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleExportTemplate("ingredients")}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              成分テンプレート
            </button>
            <button
              onClick={() => handleExportTemplate("products")}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              製品テンプレート
            </button>
          </div>
        </div>
      </div>

      {/* インポート履歴 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-4">インポート履歴</h2>
        {importLogs.length > 0 ? (
          <div className="space-y-3">
            {importLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium">{log.fileName}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString("ja-JP")} |{" "}
                    {log.fileType}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      log.status === "success"
                        ? "bg-green-100 text-green-700"
                        : log.status === "partial"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {log.status === "success"
                      ? "成功"
                      : log.status === "partial"
                      ? "一部成功"
                      : "エラー"}
                  </span>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {log.rowsSucceeded}/{log.rowsProcessed}件
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            インポート履歴はありません
          </p>
        )}
      </div>
    </div>
  );
}
