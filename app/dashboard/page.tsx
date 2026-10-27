"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type DashboardStats = {
  totalItems: number;
  totalPickups: number;
  totalRecycled: number;
  totalRefurbished: number;
};

type CurrentUser = {
  name: string;
  role: string;
};

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    totalPickups: 0,
    totalRecycled: 0,
    totalRefurbished: 0,
  });

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const authResponse = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });

        if (!authResponse.ok) {
          router.push("/login");
          return;
        }

        const authData = await authResponse.json();

        if (!authData.success) {
          router.push("/login");
          return;
        }

        setUser(authData.user);
        setAuthLoading(false);

        const statsResponse = await fetch("/api/dashboard/stats", {
          cache: "no-store",
        });

        const statsData = await statsResponse.json();

        if (statsResponse.ok && statsData.success) {
          setStats(statsData.stats);
        }
      } catch (error) {
        console.error("Failed to load dashboard:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    router.push("/login");
  }

  if (authLoading && loading) {
    return (
      <main className="loginPage">
        <div className="loginCard">
          <h1>Smart E-Waste</h1>
          <p className="loginSubtitle">Checking your session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="header">
        <div>
          <h1>Smart E-Waste Management System</h1>
          <p>
            Collection, recycling and refurbishment management platform
          </p>
        </div>

        <div className="headerActions">
          <span className="roleBadge">
            {user?.name} · {user?.role}
          </span>

          <button className="secondaryButton" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="navBar">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/items">E-Waste Items</Link>
        <Link href="/pickups">Pickup Requests</Link>
        <Link href="/recycling">Recycling</Link>
        <Link href="/refurbishment">Refurbishment</Link>
        <Link href="/inspections">Inspection Reports</Link>
      </nav>

      <section className="welcome">
        <h2>Welcome, {user?.name}</h2>
        <p>
          {user?.role === "CUSTOMER"
            ? "View your registered e-waste items and pickup activity."
            : "Manage e-waste collection, inspection, recycling and refurbishment activity."}
        </p>
      </section>

      <section className="stats">
        <div className="card">
          <h3>
            {user?.role === "CUSTOMER"
              ? "My E-Waste Items"
              : "Total E-Waste Items"}
          </h3>
          <p className="number">{loading ? "..." : stats.totalItems}</p>
        </div>

        <div className="card">
          <h3>
            {user?.role === "CUSTOMER"
              ? "My Pickup Requests"
              : "Pickup Requests"}
          </h3>
          <p className="number">{loading ? "..." : stats.totalPickups}</p>
        </div>

        <div className="card">
          <h3>
            {user?.role === "CUSTOMER"
              ? "My Recycled Items"
              : "Recycled Items"}
          </h3>
          <p className="number">{loading ? "..." : stats.totalRecycled}</p>
        </div>

        <div className="card">
          <h3>
            {user?.role === "CUSTOMER"
              ? "My Refurbished Products"
              : "Refurbished Products"}
          </h3>
          <p className="number">
            {loading ? "..." : stats.totalRefurbished}
          </p>
        </div>
      </section>

      <section className="features">
        <div className="featureCard">
          <h3>♻️ E-Waste Collection</h3>
          <p>
            Register electronic waste and request a pickup from a collection
            center.
          </p>
        </div>

        <div className="featureCard">
          <h3>🔍 Inspection</h3>
          <p>
            Inspect collected devices and determine whether they should be
            recycled or refurbished.
          </p>
        </div>

        <div className="featureCard">
          <h3>🌱 Recycling</h3>
          <p>
            Track recycling activities and recovered materials from e-waste.
          </p>
        </div>

        <div className="featureCard">
          <h3>🛠️ Refurbishment</h3>
          <p>
            Manage devices that can be repaired and prepared for reuse.
          </p>
        </div>
      </section>

      <footer>
        <p>Smart E-Waste Collection, Recycling and Refurbishment System</p>
      </footer>
    </main>
  );
}
