"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "../components/app-shell";

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

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [authResponse, statsResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store", credentials: "include" }),
          fetch("/api/dashboard/stats", {
            cache: "no-store",
            credentials: "include",
          }),
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

  const management = user?.role === "STAFF" || user?.role === "ADMIN";
  const admin = user?.role === "ADMIN";
  const maxStatusTotal = Math.max(
    1,
    ...(stats?.statusBreakdown ?? []).map((entry) => Number(entry.total))
  );

  return (
    <AppShell userRole={user?.role ?? ""} userName={user?.name}>
      <div className="dashboardContent">
          <section className="dashboardIntro">
            <div>
              <span className="eyebrow">{admin ? "ADMIN CONTROL CENTER" : management ? "STAFF OPERATIONS" : "CUSTOMER PORTAL"}</span>
              <h1>{management ? admin ? "System overview" : "Operations overview" : `Good to see you, ${user?.name ?? "there"}`}</h1>
              <p>{management
                ? admin
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
            <section className={`dashboardPanels${admin ? " adminPanels" : ""}`}>
              <article className="panelCard queuePanel">
                <div className="panelHeading"><div><span className="eyebrow">{admin ? "PLATFORM OVERSIGHT" : "LIVE WORK QUEUES"}</span><h2>{admin ? "Operational watchlist" : "Priority queues"}</h2></div><span className="liveLabel"><span aria-hidden="true" /> Live</span></div>
                <Link className="queueRow" href="/items"><span className="queueNumber">{loading ? "—" : stats?.pendingReview ?? 0}</span><span><strong>New device submissions</strong><small>Awaiting an initial review</small></span><span className="queueArrow" aria-hidden="true">→</span></Link>
                <Link className="queueRow" href="/pickups"><span className="queueNumber">{loading ? "—" : stats?.pendingPickups ?? 0}</span><span><strong>Pickups to schedule</strong><small>Pending scheduling or assignment</small></span><span className="queueArrow" aria-hidden="true">→</span></Link>
                <Link className="queueRow" href="/inspections"><span className="queueNumber">{loading ? "—" : stats?.awaitingInspection ?? 0}</span><span><strong>Devices awaiting inspection</strong><small>Collected, with no inspection record</small></span><span className="queueArrow" aria-hidden="true">→</span></Link>
              </article>
              <article className="panelCard breakdownPanel">
                <div className="panelHeading"><div><span className="eyebrow">{admin ? "SYSTEM-WIDE ANALYTICS" : "DEVICE LIFECYCLE"}</span><h2>{admin ? "Device distribution" : "Current status mix"}</h2></div></div>
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
          <footer className="workspaceFooter"><span>E-Kachra Mitra</span><span>Responsible collection. Better reuse.</span></footer>
        </div>
    </AppShell>
  );
}
