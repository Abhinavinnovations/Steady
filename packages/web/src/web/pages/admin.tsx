import { useEffect, useMemo, useState } from "react";
import { useAdminRows, useAdminTables, useRunSql } from "../queries/admin";

/**
 * Owner's database console — /admin, gated by ADMIN_KEY (root .env).
 * Browse tables, page through rows, run raw SQL. Dark, calm, Steady-styled.
 */

const KEY_STORE = "steady.adminKey";
const PAGE = 50;

const ui = {
  bg: "#101018",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.10)",
  text: "#ECECF2",
  muted: "#96969F",
  primary: "#8B85D6",
  danger: "#C08890",
};

function Cell({ value }: { value: string | number | null }) {
  if (value === null)
    return <span style={{ color: ui.muted, fontStyle: "italic" }}>null</span>;
  const s = String(value);
  return <span title={s}>{s.length > 80 ? `${s.slice(0, 80)}…` : s}</span>;
}

function Grid({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number | null)[][];
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        border: `1px solid ${ui.border}`,
        borderRadius: 12,
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12.5,
        }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  color: ui.primary,
                  borderBottom: `1px solid ${ui.border}`,
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={Math.max(1, columns.length)}
                style={{ padding: 16, color: ui.muted }}
              >
                No rows.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${ui.border}` }}>
              {r.map((v, j) => (
                <td
                  key={j}
                  style={{
                    padding: "8px 12px",
                    color: ui.text,
                    whiteSpace: "nowrap",
                    maxWidth: 420,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <Cell value={v} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Admin() {
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [table, setTable] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [sqlText, setSqlText] = useState("");
  const [tab, setTab] = useState<"browse" | "sql">("browse");

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORE);
    if (saved) setKey(saved);
  }, []);

  const tables = useAdminTables(key);
  const rows = useAdminRows(key, table, offset);
  const run = useRunSql();

  const unlocked = tables.isSuccess;

  // Auto-select the first table once unlocked.
  useEffect(() => {
    if (unlocked && !table && tables.data && tables.data.tables.length > 0) {
      setTable(tables.data.tables[0].name);
    }
  }, [unlocked, table, tables.data]);

  const total = rows.data?.total ?? 0;
  const pageLabel = useMemo(() => {
    if (!rows.data) return "";
    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + PAGE, total);
    return `${from}–${to} of ${total}`;
  }, [rows.data, offset, total]);

  function unlock() {
    const k = keyInput.trim();
    if (!k) return;
    localStorage.setItem(KEY_STORE, k);
    setKey(k);
  }

  function lock() {
    localStorage.removeItem(KEY_STORE);
    setKey(null);
    setKeyInput("");
    setTable(null);
  }

  const page = {
    minHeight: "100vh",
    background: ui.bg,
    color: ui.text,
    fontFamily: "Poppins, system-ui, sans-serif",
  } as const;

  if (!key || (tables.isError && !tables.isFetching)) {
    return (
      <div
        style={{
          ...page,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 360,
            padding: 28,
            background: ui.card,
            border: `1px solid ${ui.border}`,
            borderRadius: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: ui.muted,
              fontWeight: 600,
            }}
          >
            steady
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "6px 0 4px" }}>
            Database console
          </h1>
          <p style={{ color: ui.muted, fontSize: 13, margin: "0 0 18px" }}>
            Paste the admin key (ADMIN_KEY in the root .env).
          </p>
          {key && tables.isError && (
            <p style={{ color: ui.danger, fontSize: 13, margin: "0 0 12px" }}>
              {(tables.error as Error)?.message ?? "Wrong key"}
            </p>
          )}
          <input
            aria-label="Admin key"
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            placeholder="steady-admin-…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${ui.border}`,
              background: "rgba(255,255,255,0.06)",
              color: ui.text,
              outline: "none",
              fontSize: 14,
            }}
          />
          <button
            onClick={unlock}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: ui.primary,
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...page, display: "flex" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          borderRight: `1px solid ${ui.border}`,
          padding: 20,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: ui.muted,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          steady · tables
        </div>
        {tables.data?.tables.map((t) => (
          <button
            key={t.name}
            onClick={() => {
              setTable(t.name);
              setOffset(0);
              setTab("browse");
            }}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              padding: "9px 12px",
              marginBottom: 4,
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background:
                table === t.name && tab === "browse"
                  ? "rgba(139,133,214,0.16)"
                  : "transparent",
              color: table === t.name && tab === "browse" ? ui.primary : ui.text,
              fontSize: 13.5,
              fontFamily: "inherit",
            }}
          >
            <span>{t.name}</span>
            <span style={{ color: ui.muted, fontSize: 12 }}>{t.count}</span>
          </button>
        ))}
        <button
          onClick={() => setTab("sql")}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "9px 12px",
            borderRadius: 10,
            border: `1px solid ${ui.border}`,
            background: tab === "sql" ? "rgba(139,133,214,0.16)" : "transparent",
            color: tab === "sql" ? ui.primary : ui.text,
            fontSize: 13.5,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Run SQL
        </button>
        <button
          onClick={lock}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "9px 12px",
            borderRadius: 10,
            border: "none",
            background: "transparent",
            color: ui.muted,
            fontSize: 12.5,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Lock console
        </button>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 24, minWidth: 0 }}>
        {tab === "browse" && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                {table ?? "—"}
              </h1>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: ui.muted, fontSize: 13 }}>{pageLabel}</span>
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${ui.border}`,
                    background: "transparent",
                    color: offset === 0 ? ui.muted : ui.text,
                    cursor: offset === 0 ? "default" : "pointer",
                  }}
                >
                  ‹
                </button>
                <button
                  disabled={offset + PAGE >= total}
                  onClick={() => setOffset(offset + PAGE)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${ui.border}`,
                    background: "transparent",
                    color: offset + PAGE >= total ? ui.muted : ui.text,
                    cursor: offset + PAGE >= total ? "default" : "pointer",
                  }}
                >
                  ›
                </button>
              </div>
            </div>
            {rows.isLoading && (
              <p style={{ color: ui.muted, fontSize: 13 }}>Loading…</p>
            )}
            {rows.isError && (
              <p style={{ color: ui.danger, fontSize: 13 }}>
                {(rows.error as Error).message}
              </p>
            )}
            {rows.data && <Grid columns={rows.data.columns} rows={rows.data.rows} />}
          </>
        )}

        {tab === "sql" && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 6px" }}>
              Run SQL
            </h1>
            <p style={{ color: ui.muted, fontSize: 13, margin: "0 0 14px" }}>
              Full control — SELECT, UPDATE, DELETE, ALTER all work. Results cap
              at 500 rows. There is no undo.
            </p>
            <textarea
              aria-label="SQL query"
              value={sqlText}
              onChange={(e) => setSqlText(e.target.value)}
              placeholder={'SELECT id, title, month FROM tasks ORDER BY id DESC LIMIT 20'}
              rows={5}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${ui.border}`,
                background: "rgba(255,255,255,0.06)",
                color: ui.text,
                outline: "none",
                fontSize: 13.5,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 10, margin: "12px 0 18px" }}>
              <button
                disabled={run.isPending || sqlText.trim().length === 0}
                onClick={() =>
                  run.mutate({ key: key ?? "", sql: sqlText.trim() })
                }
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: "none",
                  background: ui.primary,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13.5,
                  cursor: "pointer",
                  opacity: run.isPending || sqlText.trim().length === 0 ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {run.isPending ? "Running…" : "Run"}
              </button>
              {run.data && (
                <span style={{ alignSelf: "center", color: ui.muted, fontSize: 13 }}>
                  {run.data.rows.length} row{run.data.rows.length === 1 ? "" : "s"} ·{" "}
                  {run.data.rowsAffected} affected · {run.data.ms}ms
                </span>
              )}
            </div>
            {run.isError && (
              <p style={{ color: ui.danger, fontSize: 13 }}>
                {(run.error as Error).message}
              </p>
            )}
            {run.data && run.data.columns.length > 0 && (
              <Grid columns={run.data.columns} rows={run.data.rows} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
