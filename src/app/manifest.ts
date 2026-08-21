import type { MetadataRoute } from "next";

/** PWA Web App Manifest (ADR-0006) — /manifest.webmanifest로 서빙된다 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "이 집 먼저 — 폭염·한파 취약노인 관제",
    short_name: "이집먼저",
    description:
      "폭염·한파 경보일에 누가 위험한지, 누구부터 확인할지, 언제 방문으로 전환할지 정해주는 취약노인 관제 시스템",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#b91c1c",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
