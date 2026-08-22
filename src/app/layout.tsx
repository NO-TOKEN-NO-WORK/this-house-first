import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "이 집 먼저",
    template: "%s | 이 집 먼저",
  },
  description:
    "폭염·한파 경보일에 누가 위험한지, 누구부터 확인할지, 언제 방문으로 전환할지 정해주는 취약노인 관제 시스템",
};

export const viewport: Viewport = {
  // 메타데이터는 CSS 변수를 받을 수 없어 status/critical의 해석값을 맞춰 둔다 (ADR-0015).
  themeColor: "#d93025",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
