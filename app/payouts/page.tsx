"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Payout = {
  payout_id: number;
  offer_id: number;
  item_name: string;
  amount: string | number;
  currency: string;
  payment_method: string | null;
  payout_status: "Pending" | "Paid" | "Failed";
  transaction_reference: string | null;
  created_at: string;
};

type Offer = {
  offer_id: number;
  item_name: string;
  offer_stage: string;
  offer_status: string;
  amount: string | number;
  currency: string;
};

function amount(value: string | number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(value));
}

export default function PayoutsPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [eligibleOffers, setEligibleOffers] = useState<Offer[]>([]);
  const [role, setRole] = useState("");
  const [offerId, setOfferId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Manual bank transfer");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [payoutResponse, offerResponse] = await Promise.all([
        fetch("/api/payouts", { cache: "no-store" }),
        fetch("/api/offers", { cache: "no-store" }),
      ]);
      if (payoutResponse.status === 401) {
        router.push("/login");
        return;
      }
      const payoutData = await payoutResponse.json();
      const offerData = await offerResponse.json();
      if (!payoutResponse.ok || !payoutData.success) {
        setError(payoutData.message ?? "Unable to load payout records.");
        return;
      }
      setPayouts(payoutData.payouts ?? []);
      setRole(payoutData.userRole ?? "");
      const recordedOfferIds = new Set((payoutData.payouts as Payout[]).map((payout) => payout.offer_id));
      setEligibleOffers(
        offerResponse.ok && offerData.success
          ? (offerData.offers as Offer[]).filter((offer) =>
              offer.offer_stage === "Final" &&
              offer.offer_status === "Accepted" &&
              !recordedOfferIds.has(offer.offer_id)
            )
          : []
      );
    } catch (requestError) {
      console.error("Failed to load payouts:", requestError);
      setError("Unable to connect to the payout service.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function createPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: Number(offerId), paymentMethod }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to create payout.");
        return;
      }
      setMessage(data.message);
      setOfferId("");
      await load();
    } catch (requestError) {
      console.error("Failed to create payout:", requestError);
      setError("Unable to connect to the payout service.");
    } finally {
      setSaving(false);
    }
  }

  async function finalizePayout(payoutId: number, status: "Paid" | "Failed") {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId, status, transactionReference: reference }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to update payout.");
        return;
      }
      setMessage(data.message);
      setReference("");
      await load();
    } catch (requestError) {
      console.error("Failed to finalize payout:", requestError);
      setError("Unable to connect to the payout service.");
    } finally {
      setSaving(false);
    }
  }

  const management = role === "STAFF" || role === "ADMIN";
  return (
    <main className="itemsPage">
      <header className="pageHeader">
        <div><span className="eyebrow">Supplier settlement</span><h1>{management ? "Payout operations" : "Your payout status"}</h1><p>Supplier payouts are tracked separately from sales of refurbished products.</p></div>
        <Link href="/dashboard" className="backButton">Dashboard</Link>
      </header>
      <section className="itemsSection">
        {message && <p className="successMessage" role="status">{message}</p>}
        {error && <p className="errorMessage" role="alert">{error}</p>}
        {management && (
          <div className="formPanel">
            <h2>Record an accepted supplier offer</h2>
            <form className="deviceForm" onSubmit={createPayout}>
              <label htmlFor="payoutOffer">Accepted final offer</label>
              <select id="payoutOffer" required value={offerId} onChange={(event) => setOfferId(event.target.value)}>
                <option value="">Select an offer</option>
                {eligibleOffers.map((offer) => <option key={offer.offer_id} value={offer.offer_id}>#{offer.offer_id} · {offer.item_name} · {amount(offer.amount, offer.currency)}</option>)}
              </select>
              <label htmlFor="paymentMethod">Manual payment method</label>
              <input id="paymentMethod" maxLength={50} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} />
              <button type="submit" disabled={saving || !offerId}>{saving ? "Saving..." : "Record pending payout"}</button>
            </form>
          </div>
        )}
        {loading ? <p className="stateMessage">Loading payout records…</p> : payouts.length === 0 ? (
          <div className="emptyState"><h2>No payouts recorded</h2><p>Accepted final supplier offers will be listed here when a payout is recorded.</p></div>
        ) : (
          <div className="tableContainer"><table className="itemsTable">
            <thead><tr><th>Device</th><th>Amount</th><th>Method</th><th>Status</th><th>Reference</th><th>Action</th></tr></thead>
            <tbody>{payouts.map((payout) => <tr key={payout.payout_id}>
              <td><strong>{payout.item_name}</strong><span className="tableSubtext">Payout #{payout.payout_id}</span></td>
              <td>{amount(payout.amount, payout.currency)}</td>
              <td>{payout.payment_method ?? "Not specified"}</td>
              <td><span className={`statusBadge status-${payout.payout_status.toLowerCase()}`}>{payout.payout_status}</span></td>
              <td>{payout.transaction_reference ?? "—"}</td>
              <td>{management && payout.payout_status === "Pending" ? <div className="tableActions"><input aria-label={`Transaction reference for payout ${payout.payout_id}`} maxLength={150} placeholder="Reference (optional)" value={reference} onChange={(event) => setReference(event.target.value)} /><button className="primaryButton" disabled={saving} onClick={() => void finalizePayout(payout.payout_id, "Paid")}>Mark paid</button><button className="outlineButton" disabled={saving} onClick={() => void finalizePayout(payout.payout_id, "Failed")}>Mark failed</button></div> : "—"}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </main>
  );
}
