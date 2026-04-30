"use client";

import { useState, useRef } from "react";

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

type SeedProgress = {
  current: number;
  total: number;
  created: number;
  updated: number;
};

const BATCH_SIZE: Record<"cosmetics" | "healthfoods", number> = {
  cosmetics: 100,
  healthfoods: 200,
};

export default function AdminClient({
  importLogs,
}: {
  importLogs: ImportLog[];
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [fileType, setFileType] = useState("ingredients");
  const [seeding, setSeeding] = useState<"cosmetics" | "healthfoods" | null>(null);
  const [seedError, setSeedError] = useState("");
  const [progress, setProgress] = useState<Record<string, SeedProgress>>({});
  // 途中再開用のオフセット（停止した位置を保持）
  const resumeOffset = useRef<Record<string, number>>({ cosmetics: 0, healthfoods: 0 });
  const stopRequested = useRef(false);

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

  const handleSeed = async (type: "cosmetics" | "healthfoods", fromResume = false) => {
    setSeeding(type);
    setSeedError("");
    stopRequested.current = false;

    let offset = fromResume ? resumeOffset.current[type] : 0;
    if (!fromResume) {
      resumeOffset.current[type] = 0;
      setProgress((p) => ({ ...p, [type]: { current: 0, total: 0, created: 0, updated: 0 } }));
    }

    let totalCreated = progress[type]?.created ?? 0;
    let totalUpdated = progress[type]?.updated ?? 0;

    try {
      while (true) {
        if (stopRequested.current) {
          resumeOffset.current[type] = offset;
          break;
        }

        const res = await fetch(`/api/seed/${type}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, batchSize: BATCH_SIZE[type] }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "不明なエラー" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        totalCreated += data.created ?? 0;
        totalUpdated += data.updated ?? 0;

        setProgress((p) => ({
          ...p,
          [type]: {
            current: Math.min(data.nextOffset, data.total),
            total: data.total,
            created: totalCreated,
            updated: totalUpdated,
          },
        }));

        if (data.done) {
          resumeOffset.current[type] = 0;
          setTimeout(() => window.location.reload(), 1500);
          break;
        }
        offset = data.nextOffset;
      }
    } catch (e) {
      resumeOffset.current[type] = offset;
      setSeedError(`エラー（${offset}件目で停止）: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSeeding(null);
    }
  };

  const handleStop = () => {
    stopRequested.current = true;
  };

  const renderSeedSection = (
    type: "cosmetics" | "healthfoods",
    label: string,
    total: string
  ) => {
    const prog = progress[type];
    const isRunning = seeding === type;
    const canResume = resumeOffset.current[type] > 0 && !isRunning;
    const pct = prog && prog.total > 0
      ? Math.round((prog.current / prog.total) * 100)
      : 0;

    return (
      <div style={{ marginBottom: 16, padding: 16, background: "#f8fafc", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-3 mb-2" style={{ flexWrap: "wrap" }}>
          <span className="text-sm font-bold">{label}</span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>（{total}）</span>
          <div className="flex gap-2" style={{ marginLeft: "auto" }}>
            {isRunning ? (
              <button className="btn" style={{ background: "#fef2f2", color: "#991b1b", borderColor: "#fecaca" }} onClick={handleStop}>
                停止
              </button>
            ) : (
              <>
                <button className="btn primary" onClick={() => handleSeed(type, false)} disabled={seeding !== null}>
                  {prog?.current === prog?.total && prog?.total > 0 ? "再投入" : "開始"}
                </button>
                {canResume && (
                  <button className="btn" onClick={() => handleSeed(type, true)} disabled={seeding !== null}>
                    {resumeOffset.current[type]}件目から再開
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {prog && prog.total > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              <span>{prog.current.toLocaleString()} / {prog.total.toLocaleString()} 件</span>
              <span>{pct}%　新規: {prog.created.toLocaleString()}　更新: {prog.updated.toLocaleString()}</span>
            </div>
            <div style={{ background: "#e2e8f0", borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{ background: pct === 100 ? "#22c55e" : "#2563eb", height: "100%", width: `${pct}%`, transition: "width 0.3s" }} />
            </div>
          </>
        )}

        {isRunning && (!prog || prog.total === 0) && (
          <p className="text-xs" style={{ color: "var(--muted)", marginTop: 4 }}>CSVを取得中...</p>
        )}
      </div>
    );
  };


  return (
    <div>
      <div className="card">
        <h2 className="text-xl font-bold mb-4">管理画面</h2>
        <p className="lead text-sm mb-4">Excelファイルから成分・製品データをインポートできます。</p>
      </div>

      {/* データ一括投入（GitHub CSV） */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="text-lg font-bold mb-2">データ一括投入（GitHub CSV）</h3>
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
          500件ずつ自動で投入します。停止後は「再開」ボタンで続きから再開できます。
        </p>
        {renderSeedSection("cosmetics", "化粧品成分", "約16,500件")}
        {renderSeedSection("healthfoods", "健康食品", "約31,600件")}
        {seedError && (
          <div className="result" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b", fontWeight: 700, marginTop: 8 }}>
            {seedError}
          </div>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        {/* Excelインポート */}
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
