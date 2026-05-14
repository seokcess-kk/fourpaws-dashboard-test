"use client";

import { useState } from "react";
import type { CustomerRow, LineItemRow, TxRow } from "@/lib/schema";
import { transformToDashboardData } from "@/lib/transform";

type Step = "idle" | "parsing" | "transforming" | "done" | "error";

export default function UploadPage() {
  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string>("");
  const [stats, setStats] = useState<{ tx: number; line: number; cust: number } | null>(null);

  async function handleExcel(file: File) {
    setStep("parsing");
    setMessage(`엑셀 파일 읽는 중... (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });

      const sheetNames = wb.SheetNames;
      const find = (candidates: string[]) =>
        sheetNames.find((n) => candidates.includes(n.trim()));
      const txSheet = find(["Transactions", "transactions", "거래", "거래내역"]);
      const liSheet = find(["LineItems", "Lineitems", "lineitems", "라인아이템", "품목"]);
      const cuSheet = find(["Customers", "customers", "고객"]);

      if (!txSheet) throw new Error("'Transactions' 시트를 찾을 수 없습니다.");
      if (!liSheet) throw new Error("'LineItems' 시트를 찾을 수 없습니다.");

      const transactions = XLSX.utils.sheet_to_json<TxRow>(wb.Sheets[txSheet], { raw: false, defval: "" });
      const lineItems = XLSX.utils.sheet_to_json<LineItemRow>(wb.Sheets[liSheet], { raw: false, defval: "" });
      const customers = cuSheet ? XLSX.utils.sheet_to_json<CustomerRow>(wb.Sheets[cuSheet], { raw: false, defval: "" }) : [];

      setStats({ tx: transactions.length, line: lineItems.length, cust: customers.length });
      setStep("transforming");
      setMessage("DATA 구조로 변환 중...");

      const data = transformToDashboardData({ transactions, lineItems, customers });

      const json = JSON.stringify(data);
      try {
        sessionStorage.setItem("__dash_data", json);
      } catch (e) {
        throw new Error(
          `브라우저 sessionStorage 용량 초과 (${(json.length / 1024 / 1024).toFixed(1)}MB). 데이터 양을 줄이거나 다른 브라우저를 사용하세요.`,
        );
      }

      setStep("done");
      setMessage("변환 완료. 대시보드로 이동합니다...");
      setTimeout(() => {
        window.location.href = "/dashboard.html";
      }, 500);
    } catch (e: any) {
      console.error(e);
      setStep("error");
      setMessage(e?.message || String(e));
    }
  }

  async function handleJson(file: File) {
    setStep("parsing");
    setMessage("JSON 파일 읽는 중...");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.meta || !data.monthly || !data.locations) {
        throw new Error("유효한 DATA JSON이 아닙니다. (meta/monthly/locations 키 누락)");
      }
      sessionStorage.setItem("__dash_data", text);
      setStep("done");
      setMessage("로드 완료. 대시보드로 이동합니다...");
      setTimeout(() => {
        window.location.href = "/dashboard.html";
      }, 400);
    } catch (e: any) {
      setStep("error");
      setMessage(e?.message || String(e));
    }
  }

  const busy = step === "parsing" || step === "transforming";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <a href="/" style={{ display: "inline-block", marginBottom: 14, color: "#3b82f6", fontSize: 13, textDecoration: "none", fontWeight: 500 }}>
        ← 대시보드로 돌아가기
      </a>
      <div style={{ background: "linear-gradient(135deg,#2c3e50 0%,#4a6688 100%)", color: "#fff", padding: "24px 28px", borderRadius: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>📂 엑셀 업로드</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.9 }}>
          엑셀 파일을 업로드하면 자동으로 집계되어 대시보드가 렌더링됩니다. 업로드한 데이터는 데모 데이터를 대체합니다.
        </p>
      </div>

      <section style={card}>
        <h2 style={{ marginTop: 0, fontSize: 16, color: "#2c3e50" }}>1. 엑셀 업로드 (Raw 거래 데이터)</h2>
        <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.6 }}>
          아래 3개 시트를 포함하는 <code style={codeInline}>.xlsx</code> 파일을 선택하세요. 처리는
          <b> 브라우저(클라이언트) 안에서만</b> 이루어지며 서버로 전송되지 않습니다.
        </p>
        <ul style={{ fontSize: 12.5, color: "#4a5568", lineHeight: 1.7, paddingLeft: 20 }}>
          <li><b>Transactions</b>: 거래ID, 날짜, 지점, 지도사, 패키지, 장례매출, 부가매출, 무게추가, 할인금액, 추모전용</li>
          <li><b>LineItems</b>: 거래ID, 카테고리, 품목, 가격, 기본가, 수량</li>
          <li><b>Customers</b> (선택): 거래ID, 보호자연령, 반려동물체중, 반려동물품종, 사망원인</li>
        </ul>
        <label style={btnPrimary(busy)}>
          {busy ? "처리 중..." : "엑셀 파일 선택"}
          <input
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.ods"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleExcel(f);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>
        <p style={{ fontSize: 11, color: "#888", marginTop: 10 }}>
          자세한 컬럼 명세는 프로젝트 루트의 <code style={codeInline}>EXCEL_SPEC.md</code> 참고.
        </p>
      </section>

      <section style={card}>
        <h2 style={{ marginTop: 0, fontSize: 16, color: "#2c3e50" }}>2. 또는 사전 집계된 JSON 업로드</h2>
        <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.6 }}>
          이미 가공된 DATA JSON 파일이 있다면 변환 없이 바로 로드합니다.
        </p>
        <label style={btnSecondary(busy)}>
          {busy ? "처리 중..." : "JSON 파일 선택"}
          <input
            type="file"
            accept=".json"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleJson(f);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>
      </section>

      {message && (
        <div style={{ ...card, borderLeft: step === "error" ? "4px solid #dc2626" : "4px solid #3b82f6", background: step === "error" ? "#fef2f2" : "#eff6ff" }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: step === "error" ? "#991b1b" : "#1e40af" }}>
            {step === "parsing" && "📂 파싱 중..."}
            {step === "transforming" && "⚙️ 변환 중..."}
            {step === "done" && "✅ 완료"}
            {step === "error" && "❌ 오류"}
          </div>
          <div style={{ fontSize: 13, color: "#374151", marginTop: 6, whiteSpace: "pre-wrap" }}>{message}</div>
          {stats && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
              읽어들인 행 수 — Transactions: <b>{stats.tx.toLocaleString()}</b>, LineItems: <b>{stats.line.toLocaleString()}</b>, Customers: <b>{stats.cust.toLocaleString()}</b>
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: 11, color: "#888", marginTop: 32, textAlign: "center" }}>
        세션 동안만 데이터가 메모리에 보관되며, 탭을 닫으면 자동으로 사라집니다.
      </p>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  padding: "20px 22px",
  borderRadius: 10,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  border: "1px solid #e7eaee",
  marginBottom: 16,
};
const codeInline: React.CSSProperties = {
  background: "#f1f5f9",
  padding: "1px 6px",
  borderRadius: 4,
  fontSize: "0.9em",
};
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "10px 22px",
  background: disabled ? "#94a3b8" : "#3b82f6",
  color: "#fff",
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
  cursor: disabled ? "not-allowed" : "pointer",
});
const btnSecondary = (disabled: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "10px 22px",
  background: "#fff",
  color: disabled ? "#94a3b8" : "#3b82f6",
  border: "1px solid #3b82f6",
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
  cursor: disabled ? "not-allowed" : "pointer",
});
