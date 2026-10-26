"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Pickup = {
  pickup_id: number;
  requested_date: string;
  scheduled_date: string | null;
  pickup_address: string;
  pickup_status: string;
  rating: string | null;
  comments: string | null;
  user_id: number;
  user_name: string;
  center_name: string;
  collector_name: string;
  assignment_status: string;
};

function formatDate(date: string | null) {
  if (!date) return "Not scheduled";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PickupsPage() {
  const router = useRouter();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPickups() {
      try {
        const response = await fetch("/api/pickups", {
          cache: "no-store",
        });

        const data = await response.json();

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (data.success) {
          setPickups(data.pickups);
          setRole(data.userRole ?? "");
        }
      } catch (error) {
        console.error("Failed to load pickups:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPickups();
  }, [router]);

  return (
    <main className="itemsPage">
      <header className="pageHeader">
        <div>
          <h1>Pickup Requests</h1>
          <p>
            {role === "CUSTOMER"
              ? "View your pickup requests and their current status."
              : "View pickup requests, schedules, collectors and statuses."}
          </p>
        </div>

        <Link href="/dashboard" className="backButton">
          Dashboard
        </Link>
      </header>

      <section className="itemsSection">
        {loading ? (
          <p>Loading pickup requests...</p>
        ) : pickups.length === 0 ? (
          <p>No pickup requests found.</p>
        ) : (
          <div className="tableContainer">
            <table className="itemsTable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Pickup Address</th>
                  <th>Requested</th>
                  <th>Scheduled</th>
                  <th>Center</th>
                  <th>Collector</th>
                  <th>Status</th>
                  <th>Assignment</th>
                </tr>
              </thead>

              <tbody>
                {pickups.map((pickup) => (
                  <tr key={pickup.pickup_id}>
                    <td>{pickup.pickup_id}</td>
                    <td>
                      <strong>{pickup.user_name}</strong>
                    </td>
                    <td>{pickup.pickup_address}</td>
                    <td>{formatDate(pickup.requested_date)}</td>
                    <td>{formatDate(pickup.scheduled_date)}</td>
                    <td>{pickup.center_name}</td>
                    <td>{pickup.collector_name}</td>
                    <td>
                      <span className="statusBadge">
                        {pickup.pickup_status}
                      </span>
                    </td>
                    <td>
                      <span className="statusBadge">
                        {pickup.assignment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
