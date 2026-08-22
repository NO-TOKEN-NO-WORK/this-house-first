import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSideNav, type AdminPage } from "./AdminSideNav";
import styles from "./admin-shell.module.css";

export type AdminTopBarItem = {
  icon: string;
  label: string;
  value: ReactNode;
  tone?: "danger";
  live?: boolean;
};

export function AdminTopBar({
  controls,
  items,
  metaTail,
  title,
}: {
  controls?: ReactNode;
  items: readonly AdminTopBarItem[];
  metaTail?: ReactNode;
  title: string;
}) {
  return (
    <header className={styles.topBar} data-admin-topbar="true">
      <Link href="/" className={styles.brand}>
        <Image alt="" aria-hidden="true" height={32} src="/admin/brand-mark.png" width={32} />
        <span>See:Near</span>
      </Link>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.topMeta}>
        {items.map((item) => (
          <dl className={styles.metaItem} data-tone={item.tone} key={item.label}>
            <Image alt="" aria-hidden="true" className={styles.metaIcon} height={24} src={item.icon} width={24} />
            <dt>{item.label}</dt>
            <dd>
              {item.value}
              {item.live ? <Image alt="작동 중" className={styles.liveDot} height={8} src="/admin/status-resolved.png" width={8} /> : null}
            </dd>
          </dl>
        ))}
        {metaTail}
      </div>
      {controls}
    </header>
  );
}

export function AdminShell({
  activePage,
  children,
  header,
  pageClassName,
  previewMode = false,
}: {
  activePage: AdminPage;
  children: ReactNode;
  header: ReactNode;
  pageClassName: string;
  previewMode?: boolean;
}) {
  return (
    <div className={pageClassName}>
      <div className={styles.header} data-admin-shell-part="header">
        {header}
      </div>
      <div className={styles.body} data-admin-shell-part="body">
        <AdminSideNav activePage={activePage} previewMode={previewMode} />
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
