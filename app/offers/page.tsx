"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Offer = {
  offer_id: number;
  item_id: number;
  item_name: string;
  offer_stage: "Preliminary" | "Final";
  amount: string | number;
  currency: string;
  reason: string;
  disposition: string | null;
  offer_status: "Pending" | "Accepted" | "Declined";
  created_at: string;
};

type ItemOption = { item_id: number; item_name: string; item_status: string };

function money(amount: string | number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export default function OffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    itemId: "",
    stage: "Preliminary",
    amount: "",
    currency: "INR",
    reason: "",
    disposition: "Recycling",
  });

  const loadData = useCallback(async () => {
    setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/offers", { cache: "no-store" }),
        fetch("/api/items", { cache: "no-store" }),
      ]);
      if (responses.some((response) => response.status === 401)) {
        router.push("/login");
        return;
      }
      const offerData = await responses[0].json();
      const itemData = await responses[1].json();
      if (!responses[0].ok || !offerData.success) {
        setError(offerData.message ?? "Unable to load offers.");
        return;
      }
      setOffers(offerData.offers);
      setRole(offerData.userRole ?? "");
      if (responses[1].ok && itemData.success) setItems(itemData.items ?? []);
    } catch (requestError) {
      console.error("Failed to load offers:", requestError);
      setError("Unable to connect to the offers service.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  async function createOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          itemId: Number(form.itemId),
          amount: Number(form.amount),
          disposition: form.stage === "Final" ? form.disposition : null,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to create the offer.");
        return;
      }
      setMessage(data.message);
      setForm({ ...form, amount: "", reason: "" });
      await loadData();
    } catch (requestError) {
      console.error("Failed to create offer:", requestError);
      setError("Unable to connect to the offer service.");
    } finally {
      setSaving(false);
    }
  }

  async function decide(offerId: number, decision: "Accepted" | "Declined") {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, decision }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to record your decision.");
        return;
      }
      setMessage(data.message);
      await loadData();
    } catch (requestError) {
      console.error("Failed to record offer decision:", requestError);
      setError("Unable to connect to the offer service.");
    } finally {
      setSaving(false);
    }
  }

  const management = role === "STAFF" || role === "ADMIN";

  return (
    <main className="itemsPage">
      <header className="pageHeader">
        <div>
          <span className="eyebrow">Offers & valuation</span>
          <h1>{management ? "Device valuations" : "Your offers"}</h1>
          <p>
            {management
              ? "Prepare transparent estimates and final offers for submitted devices."
              : "Review the amount, explanation and next step for each device offer."}
          </p>
        </div>
        <Link href="/dashboard" className="backButton">Dashboard</Link>
      </header>
      <section className="itemsSection">
        {message && <p className="successMessage" role="status">{message}</p>}
        {error && <p className="errorMessage" role="alert">{error}</p>}
        {management && (
          <div className="formPanel">
            <h2>Create a valuation</h2>
            <form className="deviceForm" onSubmit={createOffer}>
              <label htmlFor="offerItem">Device</label>
              <select id="offerItem" required value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}>
                <option value="">Select a device</option>
                {items.map((item) => <option key={item.item_id} value={item.item_id}>#{item.item_id} · {item.item_name} ({item.item_status})</option>)}
              </select>
              <label htmlFor="offerStage">Offer stage</label>
              <select id="offerStage" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>
                <option value="Preliminary">Preliminary estimate</option>
                <option value="Final">Final offer after inspection</option>
              </select>
              <label htmlFor="offerAmount">Amount</label>
              <input id="offerAmount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
              <label htmlFor="offerCurrency">Currency (ISO code)</label>
              <input id="offerCurrency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} />
              {form.stage === "Final" && <>
                <label htmlFor="offerDisposition">Recommended disposition</label>
                <select id="offerDisposition" value={form.disposition} onChange={(event) => setForm({ ...form, disposition: event.target.value })}>
                  <option value="Recycling">Recycling</option>
                  <option value="Refurbishment">Refurbishment</option>
                </select>
              </>}
              <label htmlFor="offerReason">Explanation</label>
              <textarea id="offerReason" required maxLength={1000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
              <button type="submit" disabled={saving}>{saving ? "Saving..." : "Create offer"}</button>
            </form>
          </div>
        )}
        {loading ? <p className="stateMessage">Loading offers…</p> : offers.length === 0 ? (
          <div className="emptyState"><h2>No offers yet</h2><p>Offers for your devices will appear here once they are prepared by the operations team.</p></div>
        ) : (
          <div className="reportList">
            {offers.map((offer) => (
              <article className="reportCard offerCard" key={offer.offer_id}>
                <div className="offerHeading">
                  <div><p className="description">Device #{offer.item_id}</p><h2>{offer.item_name}</h2></div>
                  <span className={`statusBadge status-${offer.offer_status.toLowerCase()}`}>{offer.offer_status}</span>
                </div>
                <p className="offerAmount">{money(offer.amount, offer.currency)}</p>
                <p><strong>{offer.offer_stage} offer</strong>{offer.disposition ? ` · ${offer.disposition} recommendation` : ""}</p>
                <p>{offer.reason}</p>
                <p className="description">Created {new Date(offer.created_at).toLocaleDateString("en-IN")}</p>
                {!management && offer.offer_status === "Pending" && (
                  <div className="offerActions">
                    <button className="primaryButton" disabled={saving} onClick={() => void decide(offer.offer_id, "Accepted")}>Accept offer</button>
                    <button className="outlineButton" disabled={saving} onClick={() => void decide(offer.offer_id, "Declined")}>Decline offer</button>
                  </div>
                )}
                {!management && offer.offer_status === "Accepted" && offer.offer_stage === "Preliminary" && <Link className="primaryAction" href="/pickups">Request a pickup</Link>}
                {!management && offer.offer_status === "Declined" && offer.offer_stage === "Final" && <p className="warningNote">Your device needs a return-resolution arrangement before processing can continue.</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
