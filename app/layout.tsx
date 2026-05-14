import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "장례 매출 대시보드",
  description: "엑셀 업로드 기반 매출 대시보드",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: '-apple-system,"Segoe UI","Apple SD Gothic Neo","Noto Sans KR",sans-serif', background: "#f5f6f8", color: "#222" }}>
        {children}
      </body>
    </html>
  );
}
