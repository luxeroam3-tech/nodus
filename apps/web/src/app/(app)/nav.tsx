"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
      </svg>
    ),
  },
  {
    href: "/properties",
    label: "Properties",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="3" width="16" height="18" rx="1.5" />
        <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
      </svg>
    ),
  },
  {
    href: "/tenants",
    label: "Tenants",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5" />
      </svg>
    ),
  },
  {
    href: "/leases",
    label: "Leases",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M9 12h6M9 16h6" />
      </svg>
    ),
  },
  {
    href: "/payments",
    label: "Payments",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14.7 3.3 20.7 9.3 9.3 20.7 3.3 20.7 3.3 14.7Z" />
        <path d="M13 5l6 6" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav>
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={`app-nav-link${isActive(pathname, item.href) ? " active" : ""}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} className={`app-tab${active ? " active" : ""}`}>
            <span className="app-tab-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
