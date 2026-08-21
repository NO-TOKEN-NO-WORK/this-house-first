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
  appleWebApp: {
    capable: true,
    title: "이집먼저",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#b91c1c",
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
