import type { Metadata } from "next";

const INSTALL_PROMPT_BUFFER = `
window.addEventListener("beforeinstallprompt", function (event) {
  event.preventDefault();
  window.__thfInstallPrompt = event;
});
`;

export const metadata: Metadata = {
  title: "오늘의 대응 보드",
  manifest: "/today.webmanifest",
  appleWebApp: {
    capable: true,
    title: "See:Near",
    statusBarStyle: "default",
  },
};

export default function TodayLayout({ children }: LayoutProps<"/today">) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: INSTALL_PROMPT_BUFFER }} />
      {children}
    </>
  );
}
