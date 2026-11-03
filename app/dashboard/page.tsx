"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type DashboardStats = {
  totalItems: number;
  totalPickups: number;
  totalRecycled: number;
  totalRefurbished: number;
  pendingReview: number;
  pendingPickups: number;
  awaitingInspection: number;
  statusBreakdown: Array<{ status: string; total: number | string }>;
};

type CurrentUser = { name: string; role: string };

const customerLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/items", label: "My devices" },
  { href: "/offers", label: "Offers" },
  { href: "/pickups", label: "Pickups" },
  { href: "/payouts", label: "Payouts" },
];

const operationsLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/items", label: "Device queue" },
  { href: "/offers", label: "Valuations" },
  { href: "/pickups", label: "Collections" },
  { href: "/inspections", label: "Inspections" },
  { href: "/recycling", label: "Recycling" },
  { href: "/refurbishment", label: "Refurbishment" },
  { href: "/payouts", label: "Supplier payouts" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [authResponse, statsResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/dashboard/stats", { cache: "no-store" }),
        ]);
        if (authResponse.status === 401) {
          router.push("/login");
          return;
        }
        const authData = await authResponse.json();
        const statsData = await statsResponse.json();
        if (!authResponse.ok || !authData.success) {
          setError(authData.message ?? "Unable to verify your session.");
          return;
        }
        if (active) setUser(authData.user);
        if (!statsResponse.ok || !statsData.success) {
          setError(statsData.message ?? "Unable to load current operations data.");
          return;
        }
        if (active) setStats(statsData.stats);
      } catch (requestError) {
        console.error("Failed to load dashboard:", requestError);
        if (active) setError("Unable to connect to the dashboard service.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      if (!response.ok) {
        setError("Unable to end your session. Please try again.");
        return;
      }
      router.push("/login");
    } catch (requestError) {
      console.error("Logout failed:", requestError);
      setError("Unable to connect to the sign-out service.");
    } finally {
      setLoggingOut(false);
    }
  }

  const management = user?.role === "STAFF" || user?.role === "ADMIN";
  const links = management ? operationsLinks : customerLinks;
  const maxStatusTotal = Math.max(
    1,
    ...(stats?.statusBreakdown ?? []).map((entry) => Number(entry.total))
  );
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <main className="appShell">
      <aside className="sidebar">
        <Link className="brandLockup" href="/dashboard" aria-label="Smart E-Waste home">
          <span className="brandMark" aria-hidden="true">EW</span>
          <span><strong>evercycle</strong><small>SMART E-WASTE</small></span>
        </Link>
        <p className="navGroupLabel">{management ? "OPERATIONS" : "YOUR ACCOUNT"}</p>
        <nav className="sideNav" aria-label="Main navigation">
          {links.map((link, index) => (
            <Link href={link.href} key={link.href} aria-current={index === 0 ? "page" : undefined} className={index === 0 ? "sideNavLink active" : "sideNavLink"}>
              <span className="navGlyph" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="sidebarFooter">
          <span className="accountAvatar" aria-hidden="true">{user?.name?.slice(0, 1).toUpperCase() ?? "U"}</span>
          <span className="accountText"><strong>{user?.name ?? "Loading account"}</strong><small>{user?.role ?? "Verifying"}</small></span>
          <button type="button" className="logoutIconButton" aria-label="Log out" title="Log out" onClick={() => void logout()} disabled={loggingOut}>↗</button>
        </div>
      </aside>
      <div className="dashboardWorkspace">
        <header className="dashboardTopbar">
          <div className="topbarBreadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>Overview</strong></div>
          <div className="topbarMeta"><span className="roleBadge">{user?.role ?? "Session"}</span><span>{dateLabel}</span></div>
        </header>
        <div className="dashboardContent">
          <section className="dashboardIntro">
            <div>
              <span className="eyebrow">{management ? "OPERATIONS OVERVIEW" : "CUSTOMER PORTAL"}</span>
              <h1>{management ? user?.role === "ADMIN" ? "System overview" : "Operations overview" : `Good to see you, ${user?.name ?? "there"}`}</h1>
              <p>{management
                ? user?.role === "ADMIN"
                  ? "Monitor collection and material recovery across the platform."
                  : "Prioritize new submissions, collection and inspection work."
                : "Track each device and take the next step toward a more circular future."}</p>
            </div>
            {!management && <Link href="/items" className="primaryAction">Register a device <span aria-hidden="true">→</span></Link>}
            {management && <Link href="/items" className="primaryAction">Review device queue <span aria-hidden="true">→</span></Link>}
          </section>

          {error && <p className="errorMessage" role="alert">{error}</p>}

          <section className="stats dashboardStats" aria-label="Live system statistics">
            <article className="metricCard metricGreen"><div className="metricTop"><span>Devices tracked</span><span className="metricIcon" aria-hidden="true">DV</span></div><p className="number">{loading ? "—" : stats?.totalItems ?? 0}</p><small>{management ? "All registered devices" : "Your registered devices"}</small></article>
            <article className="metricCard metricBlue"><div className="metricTop"><span>Pickup requests</span><span className="metricIcon" aria-hidden="true">PK</span></div><p className="number">{loading ? "—" : stats?.totalPickups ?? 0}</p><small>{management ? "Across collection centers" : "Your collection activity"}</small></article>
            <article className="metricCard metricAmber"><div className="metricTop"><span>Recycled</span><span className="metricIcon" aria-hidden="true">RC</span></div><p className="number">{loading ? "—" : stats?.totalRecycled ?? 0}</p><small>Recorded recycling operations</small></article>
            <article className="metricCard metricViolet"><div className="metricTop"><span>Refurbished</span><span className="metricIcon" aria-hidden="true">RF</span></div><p className="number">{loading ? "—" : stats?.totalRefurbished ?? 0}</p><small>Recorded product outcomes</small></article>
          </section>

          {management ? (
            <section className="dashboardPanels">
              <article className="panelCard queuePanel">
                <div className="panelHeading"><div><span className="eyebrow">WORK TO DO</span><h2>Priority queues</h2></div><span className="liveLabel"><span aria-hidden="true" /> Live</span></div>
                <Link className="queueRow" href="/items"><span className="queueNumber">{loading ? "—" : stats?.pendingReview ?? 0}</span><span><strong>New device submissions</strong><small>Awaiting an initial review</small></span><span className="queueArrow" aria-hidden="true">→</span></Link>
                <Link className="queueRow" href="/pickups"><span className="queueNumber">{loading ? "—" : stats?.pendingPickups ?? 0}</span><span><strong>Pickups to schedule</strong><small>Pending scheduling or assignment</small></span><span className="queueArrow" aria-hidden="true">→</span></Link>
                <Link className="queueRow" href="/inspections"><span className="queueNumber">{loading ? "—" : stats?.awaitingInspection ?? 0}</span><span><strong>Devices awaiting inspection</strong><small>Collected, with no inspection record</small></span><span className="queueArrow" aria-hidden="true">→</span></Link>
              </article>
              <article className="panelCard breakdownPanel">
                <div className="panelHeading"><div><span className="eyebrow">DEVICE LIFECYCLE</span><h2>Current status mix</h2></div></div>
                {loading ? <p className="stateMessage">Loading status data…</p> : !stats?.statusBreakdown.length ? (
                  <div className="chartEmpty"><span className="emptyChartMark" aria-hidden="true">—</span><p>No device data to visualize yet.</p></div>
                ) : <div className="statusChart" role="list" aria-label="Devices grouped by status">
                  {stats.statusBreakdown.map((entry) => {
                    const total = Number(entry.total);
                    return <div className="statusChartRow" key={entry.status} role="listitem"><div className="chartLabel"><span>{entry.status}</span><strong>{total}</strong></div><div className="chartTrack"><span style={{ width: `${Math.max(4, total / maxStatusTotal * 100)}%` }} /></div></div>;
                  })}
                </div>}
                <Link className="panelLink" href="/items">View all devices <span aria-hidden="true">→</span></Link>
              </article>
            </section>
          ) : (
            <section className="dashboardPanels customerPanels">
              <article className="panelCard journeyPanel">
                <div className="panelHeading"><div><span className="eyebrow">YOUR NEXT STEP</span><h2>Keep your device moving</h2></div><span className="journeyMark" aria-hidden="true">01</span></div>
                <p>Register a device to start. Your account will show its estimate, pickup, inspection outcome and processing updates as they are recorded.</p>
                <div className="journeyActions"><Link href="/items">My devices <span aria-hidden="true">→</span></Link><Link href="/offers">Review offers <span aria-hidden="true">→</span></Link><Link href="/pickups">Track pickups <span aria-hidden="true">→</span></Link></div>
              </article>
              <article className="panelCard breakdownPanel">
                <div className="panelHeading"><div><span className="eyebrow">YOUR DEVICES</span><h2>Status overview</h2></div></div>
                {loading ? <p className="stateMessage">Loading status data…</p> : !stats?.statusBreakdown.length ? <div className="chartEmpty"><p>Your device statuses will appear here after your first registration.</p></div> : <div className="statusChart" role="list" aria-label="Your devices grouped by status">{stats.statusBreakdown.map((entry) => {const total = Number(entry.total); return <div className="statusChartRow" key={entry.status} role="listitem"><div className="chartLabel"><span>{entry.status}</span><strong>{total}</strong></div><div className="chartTrack"><span style={{ width: `${Math.max(4, total / maxStatusTotal * 100)}%` }} /></div></div>;})}</div>}
                <Link className="panelLink" href="/items">Manage devices <span aria-hidden="true">→</span></Link>
              </article>
            </section>
          )}
          <footer className="workspaceFooter"><span>Smart E-Waste Management</span><span>Responsible collection. Better reuse.</span></footer>
        </div>
      </div>
    </main>
  );
}
