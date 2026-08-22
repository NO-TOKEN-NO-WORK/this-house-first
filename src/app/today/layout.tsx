import type { Metadata } from "next";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "오늘의 대응 보드",
  manifest: "/today.webmanifest",
  appleWebApp: {
    capable: true,
    title: "오늘의 대응 보드",
    statusBarStyle: "default",
  },
};

export default function TodayLayout({ children }: LayoutProps<"/today">) {
  return (
    <>
      {children}
      <ServiceWorkerRegistrar />
    </>
  );
}
