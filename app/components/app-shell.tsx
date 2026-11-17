"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import BrandLockup from "./brand-lockup";

type AppShellProps = {
  children: ReactNode;
  userRole: string;
  userName?: string;
};

type NavigationIconName =
  | "grid"
  | "devices"
  | "offer"
  | "pickup"
  | "inspect"
  | "recycle"
  | "refresh"
  | "wallet";

const customerLinks = [
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/items", label: "My devices", icon: "devices" },
  { href: "/offers", label: "Offers", icon: "offer" },
  { href: "/pickups", label: "Pickups", icon: "pickup" },
  { href: "/payouts", label: "Payouts", icon: "wallet" },
] as const;

const operationsLinks = [
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/items", label: "Device queue", icon: "devices" },
  { href: "/offers", label: "Valuations", icon: "offer" },
  { href: "/pickups", label: "Collections", icon: "pickup" },
  { href: "/inspections", label: "Inspections", icon: "inspect" },
  { href: "/recycling", label: "Recycling", icon: "recycle" },
  { href: "/refurbishment", label: "Refurbishment", icon: "refresh" },
  { href: "/payouts", label: "Supplier payouts", icon: "wallet" },
] as const;

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/items": "Devices",
  "/offers": "Offers & valuations",
  "/pickups": "Pickup operations",
  "/inspections": "Inspection reports",
  "/recycling": "Recycling",
  "/refurbishment": "Refurbishment",
  "/payouts": "Payouts",
};

function NavigationIcon({ name }: { name: NavigationIconName }) {
  const paths: Record<NavigationIconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    devices: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M10 18.5h4" /></>,
    offer: <><path d="M20.5 13.5 13 21l-10-10V3h8l9.5 9.5a.7.7 0 0 1 0 1Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    pickup: <><path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z" /><circle cx="7.5" cy="18.5" r="1.5" /><circle cx="17.5" cy="18.5" r="1.5" /></>,
    inspect: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5M8 10.5h5M10.5 8v5" /></>,
    recycle: <><path d="m7 7 3-4 3 4M10 3v7M17 11l5 1-2 5M22 12l-7 4M8 18l-3 3-3-4M5 21v-7M3 14l7 1" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 8h18M16 14h2" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className="navIcon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export default function AppShell({
  children,
  userRole,
  userName,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const management = userRole === "STAFF" || userRole === "ADMIN";
  const links = management ? operationsLinks : customerLinks;
  const title = pageTitles[pathname] ?? "Workspace";
  const initials = userName?.trim().slice(0, 1).toUpperCase() || "U";

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [profileOpen]);

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        setLogoutError("Unable to end your session. Please try again.");
        return;
      }
      setProfileOpen(false);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setLogoutError("Unable to connect to the sign-out service.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div
      className={[
        "appShell",
        collapsed ? "appShell-collapsed" : "",
        mobileOpen ? "appShell-mobileOpen" : "",
      ].filter(Boolean).join(" ")}
    >
      <aside className="sidebar">
        <BrandLockup href="/dashboard" />
        <div className="sidebarSectionLabel">
          <span>{management ? "OPERATIONS" : "YOUR SPACE"}</span>
          <span className="sidebarLabelLine" />
          <button
            type="button"
            className="navCollapseToggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            <span />
            <span />
          </button>
        </div>
        <nav className="sideNav" id="primary-navigation" aria-label="Main navigation">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                href={link.href}
                key={link.href}
                aria-label={link.label}
                aria-current={active ? "page" : undefined}
                className={`sideNavLink${active ? " active" : ""}`}
                title={link.label}
                onClick={() => setMobileOpen(false)}
              >
                <NavigationIcon name={link.icon} />
                <span className="sideNavLabel">{link.label}</span>
                {active && <span className="navActiveDot" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebarNote">
          <span className="sidebarNoteIcon" aria-hidden="true">↗</span>
          <span><strong>Keep it circular</strong><small>Every device has another chapter.</small></span>
        </div>
      </aside>
      <div className="dashboardWorkspace">
        <header className="dashboardTopbar">
          <button
            type="button"
            className="mobileNavToggle"
            onClick={() => setMobileOpen((value) => !value)}
            aria-expanded={mobileOpen}
            aria-controls="primary-navigation"
            aria-label={mobileOpen ? "Close navigation" : "Toggle navigation"}
          >
            <span />
            <span />
          </button>
          <div className="topbarBreadcrumb">
            <span>Workspace</span><span aria-hidden="true">/</span><strong>{title}</strong>
          </div>
          <div className="topbarMeta">
            <span className="roleBadge">{userRole || "SESSION"}</span>
            <div className="profileMenu" ref={profileMenuRef}>
              <button
                type="button"
                className="profileMenuButton"
                aria-expanded={profileOpen}
                aria-controls="profile-menu"
                onClick={() => setProfileOpen((value) => !value)}
              >
                <span className="accountAvatar" aria-hidden="true">{initials}</span>
                <span className="profileMenuName">{userName ?? "Your account"}</span>
                <span className="profileMenuChevron" aria-hidden="true">⌄</span>
              </button>
              {profileOpen && (
                <div className="profileDropdown" id="profile-menu">
                  <span className="profileDropdownName">{userName ?? "Your account"}</span>
                  <span className="profileDropdownRole">{userRole || "Verifying session"}</span>
                  <button
                    type="button"
                    className="profileSignOut"
                    onClick={() => void logout()}
                    disabled={loggingOut}
                  >
                    {loggingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {logoutError && <p className="errorMessage shellError" role="alert">{logoutError}</p>}
        <main className="appMainContent">{children}</main>
      </div>
    </div>
  );
}
