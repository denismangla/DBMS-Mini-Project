"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Pickup = {
  pickup_id: number;
  requested_date: string;
  scheduled_date: string | null;
  pickup_address: string;
  pickup_status: string;
  user_id: number;
  user_name: string;
  center_id: number;
  center_name: string;
  collector_id: number | null;
  collector_name: string | null;
  assignment_status: string;
};

type Center = { center_id: number; center_name: string; city: string | null };
type Collector = { collector_id: number; collector_name: string; center_id: number };
type Item = { item_id: number; item_name: string; item_status: string };

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PickupsPage() {
  const router = useRouter();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [itemId, setItemId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [address, setAddress] = useState("");
  const [scheduleDates, setScheduleDates] = useState<Record<number, string>>({});
  const [assignments, setAssignments] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const pickupResponse = await fetch("/api/pickups", { cache: "no-store" });
      if (pickupResponse.status === 401) {
        router.push("/login");
        return;
      }
      const pickupData = await pickupResponse.json();
      if (!pickupResponse.ok || !pickupData.success) {
        setError(pickupData.message ?? "Unable to load pickup requests.");
        return;
      }
      setPickups(pickupData.pickups);
      setCenters(pickupData.centers ?? []);
      setCollectors(pickupData.collectors ?? []);
      setRole(pickupData.userRole ?? "");
      if (pickupData.userRole === "CUSTOMER") {
        const itemResponse = await fetch("/api/items", { cache: "no-store" });
        const itemData = await itemResponse.json();
        if (itemResponse.ok && itemData.success) {
          setItems((itemData.items as Item[]).filter((item) => item.item_status === "Offer Accepted"));
        }
      }
    } catch (requestError) {
      console.error("Failed to load pickup requests:", requestError);
      setError("Unable to connect to the pickup service.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function createPickup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: Number(itemId), centerId: Number(centerId), pickupAddress: address }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to request pickup.");
        return;
      }
      setMessage(data.message);
      setItemId("");
      setAddress("");
      await load();
    } catch (requestError) {
      console.error("Failed to create pickup request:", requestError);
      setError("Unable to connect to the pickup service.");
    } finally {
      setSaving(false);
    }
  }

  async function updatePickup(pickup: Pickup, complete = false) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/pickups/${pickup.pickup_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complete ? { status: "Completed" } : {
          scheduledDate: scheduleDates[pickup.pickup_id] ?? pickup.scheduled_date,
          collectorId: assignments[pickup.pickup_id] ?? pickup.collector_id,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to update pickup.");
        return;
      }
      setMessage(data.message);
      await load();
    } catch (requestError) {
      console.error("Failed to update pickup:", requestError);
      setError("Unable to connect to the pickup service.");
    } finally {
      setSaving(false);
    }
  }

  const management = role === "STAFF" || role === "ADMIN";

  return (
    <main className="itemsPage">
      <header className="pageHeader">
        <div>
          <span className="eyebrow">Collection operations</span>
          <h1>Pickup requests</h1>
          <p>{management ? "Schedule collections, assign a center's collector and record receipt." : "Choose an eligible device and collection center to arrange pickup."}</p>
        </div>
        <Link href="/dashboard" className="backButton">Dashboard</Link>
      </header>
      <section className="itemsSection">
        {message && <p className="successMessage" role="status">{message}</p>}
        {error && <p className="errorMessage" role="alert">{error}</p>}
        {role === "CUSTOMER" && (
          <div className="formPanel">
            <h2>Request a device pickup</h2>
            {items.length === 0 && !loading && <p className="formHelp">Pickup becomes available after you accept a preliminary estimate.</p>}
            <form className="deviceForm" onSubmit={createPickup}>
              <label htmlFor="pickupItem">Device</label>
              <select id="pickupItem" required value={itemId} onChange={(event) => setItemId(event.target.value)} disabled={items.length === 0}>
                <option value="">Select an eligible device</option>
                {items.map((item) => <option key={item.item_id} value={item.item_id}>#{item.item_id} · {item.item_name}</option>)}
              </select>
              <label htmlFor="pickupCenter">Collection center</label>
              <select id="pickupCenter" required value={centerId} onChange={(event) => setCenterId(event.target.value)}>
                <option value="">Select a center</option>
                {centers.map((center) => <option key={center.center_id} value={center.center_id}>{center.center_name}{center.city ? ` · ${center.city}` : ""}</option>)}
              </select>
              <label htmlFor="pickupAddress">Collection address</label>
              <textarea id="pickupAddress" required maxLength={255} value={address} onChange={(event) => setAddress(event.target.value)} />
              <button type="submit" disabled={saving || !items.length}>{saving ? "Submitting…" : "Request pickup"}</button>
            </form>
          </div>
        )}
        {loading ? <p className="stateMessage">Loading pickup requests…</p> : pickups.length === 0 ? (
          <div className="emptyState"><h2>No pickup requests</h2><p>When a customer requests collection, its schedule and status will appear here.</p></div>
        ) : (
          <div className="tableContainer"><table className="itemsTable">
            <thead><tr>{management && <th>Customer</th>}<th>Pickup address</th><th>Requested</th><th>Scheduled</th><th>Center</th><th>Collector</th><th>Status</th>{management && <th>Operations</th>}</tr></thead>
            <tbody>{pickups.map((pickup) => <tr key={pickup.pickup_id}>
              {management && <td><strong>{pickup.user_name}</strong><span className="tableSubtext">Request #{pickup.pickup_id}</span></td>}
              <td>{pickup.pickup_address}</td>
              <td>{formatDate(pickup.requested_date)}</td>
              <td>{formatDate(pickup.scheduled_date)}</td>
              <td>{pickup.center_name}</td>
              <td>{pickup.collector_name ?? "Unassigned"}</td>
              <td><span className={`statusBadge status-${pickup.pickup_status.toLowerCase().replaceAll(" ", "-")}`}>{pickup.pickup_status}</span><span className="tableSubtext">{pickup.assignment_status ?? "Pending assignment"}</span></td>
              {management && <td>{["Pending", "Scheduled"].includes(pickup.pickup_status) ? <div className="tableActions">
                <label className="compactLabel" htmlFor={`date-${pickup.pickup_id}`}>Schedule date</label>
                <input id={`date-${pickup.pickup_id}`} type="date" min={pickup.requested_date.slice(0, 10)} value={scheduleDates[pickup.pickup_id] ?? pickup.scheduled_date?.slice(0, 10) ?? ""} onChange={(event) => setScheduleDates({ ...scheduleDates, [pickup.pickup_id]: event.target.value })} />
                <label className="compactLabel" htmlFor={`collector-${pickup.pickup_id}`}>Collector</label>
                <select id={`collector-${pickup.pickup_id}`} value={assignments[pickup.pickup_id] ?? String(pickup.collector_id ?? "")} onChange={(event) => setAssignments({ ...assignments, [pickup.pickup_id]: event.target.value })}>
                  <option value="">Unassigned</option>
                  {collectors.filter((collector) => collector.center_id === pickup.center_id).map((collector) => <option key={collector.collector_id} value={collector.collector_id}>{collector.collector_name}</option>)}
                </select>
                <button className="primaryButton" disabled={saving || !(scheduleDates[pickup.pickup_id] ?? pickup.scheduled_date)} onClick={() => void updatePickup(pickup)}>Save schedule</button>
                <button className="outlineButton" disabled={saving || !pickup.scheduled_date || !pickup.collector_id} onClick={() => void updatePickup(pickup, true)}>Record collection</button>
              </div> : "—"}</td>}
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </main>
  );
}
