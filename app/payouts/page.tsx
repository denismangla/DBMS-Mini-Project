"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, FormEvent, useCallback, useEffect, useState } from "react";
import AppShell from "../components/app-shell";

type Payout = {
  payout_id: number;
  offer_id: number;
  item_id: number;
  item_name: string;
  description: string | null;
  condition: string | null;
  category_name: string;
  brand_name: string | null;
  customer_name: string;
  accepted_offer_amount: string | number;
  offer_reason: string;
  offer_disposition: string | null;
  amount: string | number;
  currency: string;
  payment_method: string | null;
  payout_status: "Pending" | "Processing" | "Paid" | "Failed";
  transaction_reference: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  processing_at: string | null;
  paid_at: string | null;
  history: PayoutHistory[];
};

type PayoutHistory = {
  previous_status: string | null;
  next_status: PayoutStatus;
  transaction_reference: string | null;
  failure_reason: string | null;
  changed_at: string;
};

type PayoutStatus = Payout["payout_status"];
type PayoutFilter = "All" | PayoutStatus;
type PaymentDetails = { transactionReference: string; failureReason: string };

type Offer = {
  offer_id: number;
  item_id: number;
  item_name: string;
  customer_name: string;
  amount: string | number;
  currency: string;
};

type PayoutSummary = Record<
  PayoutStatus,
  { count: number; totals: Array<{ currency: string; amount: string | number }> }
>;

function amount(value: string | number, currency: string) {
  return `${currency} ${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusLabel(status: PayoutStatus) {
  return status === "Paid" ? "Completed" : status;
}

function dateLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Not recorded";
}

export default function PayoutsPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [eligibleOffers, setEligibleOffers] = useState<Offer[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [role, setRole] = useState("");
  const [offerId, setOfferId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Manual bank transfer");
  const [paymentDetails, setPaymentDetails] = useState<Record<number, PaymentDetails>>({});
  const [statusFilter, setStatusFilter] = useState<PayoutFilter>("All");
  const [expandedPayoutId, setExpandedPayoutId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function updatePaymentDetail(
    payoutId: number,
    field: keyof PaymentDetails,
    value: string
  ) {
    setPaymentDetails((current) => ({
      ...current,
      [payoutId]: {
        transactionReference: current[payoutId]?.transactionReference ?? "",
        failureReason: current[payoutId]?.failureReason ?? "",
        [field]: value,
      },
    }));
  }

  const load = useCallback(async () => {
    setError("");
    try {
      const payoutResponse = await fetch("/api/payouts", { cache: "no-store" });
      if (payoutResponse.status === 401) {
        router.push("/login");
        return;
      }
      const payoutData = await payoutResponse.json();
      if (!payoutResponse.ok || !payoutData.success) {
        setError(payoutData.message ?? "Unable to load payout records.");
        return;
      }
      setPayouts(payoutData.payouts ?? []);
      setRole(payoutData.userRole ?? "");
      setEligibleOffers(payoutData.eligibleOffers ?? []);
      setSummary(payoutData.summary ?? null);
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
      if (response.status === 401) {
        router.push("/login");
        return;
      }
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

  async function updatePayout(payoutId: number, status: PayoutStatus) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId,
          status,
          transactionReference: paymentDetails[payoutId]?.transactionReference ?? "",
          failureReason: paymentDetails[payoutId]?.failureReason ?? "",
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to update payout.");
        return;
      }
      setMessage(data.message);
      setPaymentDetails((current) => {
        const next = { ...current };
        delete next[payoutId];
        return next;
      });
      await load();
    } catch (requestError) {
      console.error("Failed to finalize payout:", requestError);
      setError("Unable to connect to the payout service.");
    } finally {
      setSaving(false);
    }
  }

  const management = role === "STAFF" || role === "ADMIN";
  const visiblePayouts = statusFilter === "All"
    ? payouts
    : payouts.filter((payout) => payout.payout_status === statusFilter);
  const payoutFilters: PayoutFilter[] = ["All", "Pending", "Processing", "Paid", "Failed"];

  return (
    <AppShell userRole={role}>
      <div className="pageContent">
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
            <p className="formHelp">Only customer-accepted final offers with a matching inspected disposition are eligible. This creates a pending record; it does not transfer money.</p>
            <form className="deviceForm" onSubmit={createPayout}>
              <label htmlFor="payoutOffer">Accepted final offer</label>
              <select id="payoutOffer" required value={offerId} onChange={(event) => setOfferId(event.target.value)}>
                <option value="">Select an offer</option>
                {eligibleOffers.map((offer) => <option key={offer.offer_id} value={offer.offer_id}>#{offer.offer_id} · {offer.item_name} · Item #{offer.item_id} · {offer.customer_name} · {amount(offer.amount, offer.currency)}</option>)}
              </select>
              <label htmlFor="paymentMethod">Manual payment method</label>
              <input id="paymentMethod" maxLength={50} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} />
              <button type="submit" disabled={saving || !offerId}>{saving ? "Saving..." : "Record pending payout"}</button>
            </form>
          </div>
        )}
        {management && summary && (
          <section className="offerMetrics" aria-label="Payout overview">
            {(["Pending", "Processing", "Paid", "Failed"] as PayoutStatus[]).map((status) => (
              <article key={status}>
                <span>{statusLabel(status)} payouts</span>
                <strong>{summary[status].count}</strong>
                {summary[status].totals.map((total) => (
                  <small key={total.currency}>{amount(total.amount, total.currency)} total</small>
                ))}
              </article>
            ))}
          </section>
        )}
        {loading ? <p className="stateMessage">Loading payout records…</p> : error ? null : payouts.length === 0 ? (
          <div className="emptyState"><h2>No payouts recorded</h2><p>Accepted final supplier offers will be listed here when a payout is recorded.</p></div>
        ) : (
          <>
            <div className="offerFilters" role="group" aria-label="Filter payouts by status">
              {payoutFilters.map((filter) => (
                <button
                  type="button"
                  key={filter}
                  aria-pressed={statusFilter === filter}
                  className={statusFilter === filter ? "active" : ""}
                  onClick={() => setStatusFilter(filter)}
                >
                  {filter === "All" ? "All" : statusLabel(filter)}
                  {filter !== "All" && summary && ` (${summary[filter].count})`}
                </button>
              ))}
            </div>
            {visiblePayouts.length === 0 ? (
              <div className="emptyState"><h2>No {statusFilter === "All" ? "" : `${statusLabel(statusFilter).toLowerCase()} `}payouts</h2><p>Try another status filter to review payout activity.</p></div>
            ) : (
              <div className="tableContainer"><table className="itemsTable">
                <thead><tr>{management && <th>Customer</th>}<th>Device</th><th>Accepted offer</th><th>Payout amount</th><th>Method</th><th>Status</th><th>Reference / failure</th><th>Completed date</th><th>Details</th>{management && <th>Action</th>}</tr></thead>
                <tbody>{visiblePayouts.map((payout) => (
                  <Fragment key={payout.payout_id}>
                    <tr>
                      {management && <td>{payout.customer_name}</td>}
                      <td><strong>{payout.item_name}</strong><span className="tableSubtext">Item #{payout.item_id} · Payout #{payout.payout_id}</span></td>
                      <td>{amount(payout.accepted_offer_amount, payout.currency)}<span className="tableSubtext">Offer #{payout.offer_id}</span></td>
                      <td>{amount(payout.amount, payout.currency)}</td>
                      <td>{payout.payment_method ?? "Not specified"}</td>
                      <td>
                        <span className={`statusBadge status-${payout.payout_status.toLowerCase()}`}>{statusLabel(payout.payout_status)}</span>
                        {!management && (
                          <span className="tableSubtext">
                            {payout.payout_status === "Pending" ? "Awaiting staff processing" : payout.payout_status === "Processing" ? "Payment is being prepared" : payout.payout_status === "Failed" ? "See details for the reason" : "Payment completion recorded"}
                          </span>
                        )}
                      </td>
                      <td>{payout.transaction_reference ?? "—"}{payout.failure_reason && <span className="tableSubtext">Failure: {payout.failure_reason}</span>}</td>
                      <td>{payout.paid_at ? dateLabel(payout.paid_at) : "—"}</td>
                      <td><button className="outlineButton" type="button" aria-expanded={expandedPayoutId === payout.payout_id} onClick={() => setExpandedPayoutId(expandedPayoutId === payout.payout_id ? null : payout.payout_id)}>{expandedPayoutId === payout.payout_id ? "Hide details" : "View details"}</button></td>
                      {management && <td>
                        {payout.payout_status === "Pending" && (
                          <button className="primaryButton" disabled={saving} onClick={() => void updatePayout(payout.payout_id, "Processing")}>Start processing</button>
                        )}
                        {payout.payout_status === "Failed" && (
                          <button className="primaryButton" disabled={saving} onClick={() => void updatePayout(payout.payout_id, "Processing")}>Retry payout</button>
                        )}
                        {payout.payout_status === "Processing" && (
                          <div className="tableActions">
                            <input
                              aria-label={`Transaction reference for payout ${payout.payout_id}`}
                              maxLength={150}
                              placeholder="Reference (required to complete)"
                              value={paymentDetails[payout.payout_id]?.transactionReference ?? ""}
                              onChange={(event) => updatePaymentDetail(payout.payout_id, "transactionReference", event.target.value)}
                            />
                            <input
                              aria-label={`Failure reason for payout ${payout.payout_id}`}
                              maxLength={1000}
                              placeholder="Failure reason (required to fail)"
                              value={paymentDetails[payout.payout_id]?.failureReason ?? ""}
                              onChange={(event) => updatePaymentDetail(payout.payout_id, "failureReason", event.target.value)}
                            />
                            <button className="primaryButton" disabled={saving || !paymentDetails[payout.payout_id]?.transactionReference.trim()} title="Only record completion after confirming the manual payment." onClick={() => void updatePayout(payout.payout_id, "Paid")}>Record completed payment</button>
                            <button className="outlineButton" disabled={saving || !paymentDetails[payout.payout_id]?.failureReason.trim()} onClick={() => void updatePayout(payout.payout_id, "Failed")}>Mark failed</button>
                          </div>
                        )}
                      </td>}
                    </tr>
                    {expandedPayoutId === payout.payout_id && (
                      <tr key={`${payout.payout_id}-details`}>
                        <td colSpan={management ? 10 : 9}>
                          <div className="payoutDetails">
                            <p><strong>Device:</strong> Item #{payout.item_id} · {payout.category_name} · {payout.brand_name ?? "Unbranded"} · {payout.condition ?? "Condition not recorded"}</p>
                            {payout.description && <p><strong>Description:</strong> {payout.description}</p>}
                            <p><strong>Offer disposition:</strong> {payout.offer_disposition ?? "Not specified"} · <strong>Offer explanation:</strong> {payout.offer_reason}</p>
                            <p><strong>Recorded:</strong> {dateLabel(payout.created_at)} · <strong>Last updated:</strong> {dateLabel(payout.updated_at)} · <strong>Processing started:</strong> {dateLabel(payout.processing_at)}</p>
                            <h3>Status history</h3>
                            {payout.history.length === 0 ? <p>No status changes recorded.</p> : (
                              <ul>{payout.history.map((entry, index) => (
                                <li key={`${entry.changed_at}-${entry.next_status}-${index}`}>
                                  {statusLabel(entry.next_status)} · {dateLabel(entry.changed_at)}
                                  {entry.transaction_reference && ` · Reference: ${entry.transaction_reference}`}
                                  {entry.failure_reason && ` · Reason: ${entry.failure_reason}`}
                                </li>
                              ))}</ul>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}</tbody>
              </table></div>
            )}
          </>
        )}
      </section>
      </div>
    </AppShell>
  );
}
