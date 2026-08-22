import Image from "next/image";
import Link from "next/link";
import styles from "./admin-side-nav.module.css";

export type AdminPage = "dashboard" | "welfare-scan";

export function AdminSideNav({
  activePage,
  previewMode = false,
}: {
  activePage: AdminPage;
  previewMode?: boolean;
}) {
  const adminHref = previewMode ? "/admin?preview=1" : "/admin";
  const items: Array<{
    label: string;
    href: string;
    icon: string;
    page: AdminPage;
  }> = [
    { label: "관제 현황", href: adminHref, icon: "/admin/building.png", page: "dashboard" },
    { label: "복지 스캔", href: previewMode ? "/admin/welfare-scan?preview=1" : "/admin/welfare-scan", icon: "/admin/search.png", page: "welfare-scan" },
  ];

  return (
    <nav className={styles.sideNav} aria-label="관리자 메뉴">
      {items.map((item) => {
        const active = item.page === activePage;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? styles.activeNavItem : styles.navItem}
            href={item.href}
            key={item.label}
          >
            <Image alt="" aria-hidden="true" height={18} src={item.icon} width={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
