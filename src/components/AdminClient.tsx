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

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setMessage("エラー: .xlsx または .xls ファイルのみ対応しています");
      return;
    }

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

  return (
    <div>
      <div className="card">
        <h2 className="text-xl font-bold mb-4">管理画面</h2>
        <p className="lead text-sm mb-4">Excelファイルから成分・製品データをインポートできます。</p>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        {/* インポート */}
        <div className="card" style={{ marginTop: 0 }}>
          <h3 className="text-lg font-bold mb-4">Excelインポート</h3>

          <div className="mb-4">
            <label className="text-sm font-bold" style={{ display: "block", marginBottom: 8 }}>
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
                  className={`pill ${fileType === t.value ? "active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              border: "2px dashed var(--line)",
              borderRadius: "var(--radius)",
              padding: "32px",
              textAlign: "center",
              background: "#f8fafc",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📥</div>
            <p className="text-sm" style={{ color: "var(--muted)", marginBottom: 12 }}>
              .xlsx / .xls ファイルをアップロード
            </p>
            <label style={{ display: "inline-block", cursor: "pointer" }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUpload}
                disabled={uploading}
                style={{ display: "none" }}
              />
              <span className="btn primary" style={{ cursor: "pointer" }}>
                {uploading ? "アップロード中..." : "ファイルを選択"}
              </span>
            </label>
          </div>

          {message && (
            <div
              className="result"
              style={{
                background: message.startsWith("エラー") ? "#fef2f2" : "#ecfdf5",
                borderColor: message.startsWith("エラー") ? "#fecaca" : "#a7f3d0",
                color: message.startsWith("エラー") ? "var(--bad)" : "var(--good)",
                fontWeight: 700,
              }}
            >
              {message}
            </div>
          )}
        </div>

        {/* インポート履歴 */}
        <div className="card" style={{ marginTop: 0 }}>
          <h3 className="text-lg font-bold mb-4">インポート履歴</h3>
          {importLogs.length > 0 ? (
            <div className="space-y-3">
              {importLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "#f8fafc", border: "1px solid var(--line)" }}
                >
                  <div>
                    <div className="text-sm font-bold">{log.fileName}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(log.createdAt).toLocaleString("ja-JP")} | {log.fileType}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      className="tag"
                      style={{
                        background: log.status === "success" ? "#ecfdf5" : log.status === "partial" ? "#fffbeb" : "#fef2f2",
                        color: log.status === "success" ? "#166534" : log.status === "partial" ? "#92400e" : "#991b1b",
                        borderColor: log.status === "success" ? "#a7f3d0" : log.status === "partial" ? "#fde68a" : "#fecaca",
                      }}
                    >
                      {log.status === "success" ? "成功" : log.status === "partial" ? "一部成功" : "エラー"}
                    </span>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      {log.rowsSucceeded}/{log.rowsProcessed}件
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="result text-center" style={{ color: "var(--muted)" }}>
              インポート履歴はありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
