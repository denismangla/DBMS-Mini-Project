"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import AppShell from "../components/app-shell";

type Offer = {
  offer_id: number;
  item_id: number;
  item_name: string;
  offer_stage: "Preliminary" | "Final";
  amount: string | number;
  currency: string;
  reason: string;
  valuation_notes: string | null;
  disposition: string | null;
  offer_status: "Pending" | "Accepted" | "Declined";
  created_at: string;
  decided_at: string | null;
};

type ItemOption = {
  item_id: number;
  item_name: string;
  description: string | null;
  condition: string | null;
  item_status: string;
  category_name: string;
  brand_name: string | null;
};

type PendingValuation = ItemOption & {
  customer_name: string;
  submitted_at: string | null;
  previous_offer_status: "Pending" | "Accepted" | "Declined" | null;
  previous_offer_amount: string | number | null;
  previous_offer_currency: string | null;
};

type OfferStats = {
  preliminary: number;
  final: number;
  awaitingResponse: number;
  accepted: number;
  declined: number;
};

type InspectionOption = {
  inspectionId: number;
  itemId: number;
  itemName: string;
  inspectionDate: string;
  conditionAssessment: string | null;
  damageLevel: string | null;
  inspectionResult: string | null;
  estimatedRepairCost: string | number | null;
  processingType: string | null;
  processingStatus: string | null;
};

type InspectionReport = {
  inspectionId: number;
  technicianNotes: string;
  observations: string[];
  componentFindings: Array<{
    component: string;
    condition: string;
    notes: string;
  }>;
  repairRecommendations: string[];
};

type OfferFilter = "All" | "Pending" | "Accepted" | "Declined" | "Preliminary" | "Final";
type OfferForm = {
  itemId: string;
  stage: "Preliminary" | "Final";
  amount: string;
  currency: string;
  reason: string;
  valuationNotes: string;
  disposition: string;
};

function money(amount: string | number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function offerStatusLabel(status: Offer["offer_status"]) {
  return status === "Pending" ? "Awaiting response" : status;
}

function dateLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "Not recorded";
}

export default function OffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [pendingValuations, setPendingValuations] = useState<PendingValuation[]>([]);
  const [inspections, setInspections] = useState<InspectionOption[]>([]);
  const [inspectionReports, setInspectionReports] = useState<InspectionReport[]>([]);
  const [offerStats, setOfferStats] = useState<OfferStats>({
    preliminary: 0,
    final: 0,
    awaitingResponse: 0,
    accepted: 0,
    declined: 0,
  });
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inspectionError, setInspectionError] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueStatus, setQueueStatus] = useState("All");
  const [offerFilter, setOfferFilter] = useState<OfferFilter>("All");
  const [selectedValuationId, setSelectedValuationId] = useState<number | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    offer: Offer;
    decision: "Accepted" | "Declined";
  } | null>(null);
  const decisionDialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<OfferForm>({
    itemId: "",
    stage: "Preliminary",
    amount: "",
    currency: "INR",
    reason: "",
    valuationNotes: "",
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
      setPendingValuations(offerData.pendingValuations ?? []);
      setOfferStats(offerData.offerStats ?? {
        preliminary: 0,
        final: 0,
        awaitingResponse: 0,
        accepted: 0,
        declined: 0,
      });
      if (responses[1].ok && itemData.success) setItems(itemData.items ?? []);

      if (offerData.userRole === "STAFF" || offerData.userRole === "ADMIN") {
        const inspectionResponse = await fetch("/api/inspections", { cache: "no-store" });
        const inspectionData = await inspectionResponse.json();
        if (inspectionResponse.ok && inspectionData.success) {
          setInspections(inspectionData.inspectionOptions ?? []);
          setInspectionReports(inspectionData.reports ?? []);
          setInspectionError("");
        } else {
          setInspectionError(inspectionData.message ?? "Unable to load inspection details.");
        }
      } else {
        setInspections([]);
        setInspectionReports([]);
        setInspectionError("");
      }
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

  useEffect(() => {
    const dialog = decisionDialog.current;
    if (!dialog) return;
    if (pendingDecision && !dialog.open) dialog.showModal();
    if (!pendingDecision && dialog.open) dialog.close();
  }, [pendingDecision]);

  async function createOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const itemId = Number(form.itemId);
    const eligible =
      form.stage === "Preliminary"
        ? pendingValuations.some((item) => item.item_id === itemId)
        : finalCandidates.some((item) => item.itemId === itemId);
    if (!eligible) {
      setError("Select an eligible device for this offer stage.");
      return;
    }

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
      setForm({ ...form, itemId: "", amount: "", reason: "", valuationNotes: "" });
      setSelectedValuationId(null);
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
      setPendingDecision(null);
      await loadData();
    } catch (requestError) {
      console.error("Failed to record offer decision:", requestError);
      setError("Unable to connect to the offer service.");
    } finally {
      setSaving(false);
    }
  }

  const management = role === "STAFF" || role === "ADMIN";
  const inspectedItemIds = new Set(
    items.filter((item) => item.item_status === "Inspected").map((item) => item.item_id)
  );
  const finalCandidates = inspections.filter(
    (inspection, index) =>
      inspectedItemIds.has(inspection.itemId) &&
      (inspection.processingType === "Recycling" ||
        inspection.processingType === "Refurbishment") &&
      inspections.findIndex((entry) => entry.itemId === inspection.itemId) === index
  );
  const selectedValuation = pendingValuations.find(
    (item) => item.item_id === selectedValuationId
  );
  const selectedInspection =
    form.stage === "Final"
      ? inspections.find((inspection) => inspection.itemId === Number(form.itemId))
      : undefined;
  const selectedInspectionReport = selectedInspection
    ? inspectionReports.find((report) => report.inspectionId === selectedInspection.inspectionId)
    : undefined;
  const visibleValuations = pendingValuations.filter((item) => {
    const matchesStatus = queueStatus === "All" || item.item_status === queueStatus;
    const searchable = [
      item.item_name,
      item.item_id,
      item.category_name,
      item.brand_name,
      item.customer_name,
    ].join(" ").toLowerCase();
    return matchesStatus && searchable.includes(queueSearch.trim().toLowerCase());
  });
  const visibleOffers = offers
    .filter((offer) => {
      if (offerFilter === "All") return true;
      if (offerFilter === "Preliminary" || offerFilter === "Final") {
        return offer.offer_stage === offerFilter;
      }
      return offer.offer_status === offerFilter;
    })
    .sort((first, second) => {
      const activeDifference =
        Number(second.offer_status === "Pending") -
        Number(first.offer_status === "Pending");
      return activeDifference || Date.parse(second.created_at) - Date.parse(first.created_at);
    });

  return (
    <AppShell userRole={role}>
      <div className="pageContent">
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
          <>
            <section className="offerMetrics" aria-label="Offer overview">
              <article><span>Pending valuations</span><strong>{loading ? "—" : pendingValuations.length}</strong></article>
              <article><span>Preliminary offers</span><strong>{loading ? "—" : offerStats.preliminary}</strong></article>
              <article><span>Final offers</span><strong>{loading ? "—" : offerStats.final}</strong></article>
              <article><span>Awaiting response</span><strong>{loading ? "—" : offerStats.awaitingResponse}</strong></article>
              <article><span>Accepted / declined</span><strong>{loading ? "—" : `${offerStats.accepted} / ${offerStats.declined}`}</strong></article>
            </section>

            <section className="formPanel valuationQueue" aria-labelledby="pending-valuations-title">
              <div className="panelHeading">
                <div>
                  <span className="eyebrow">STAFF WORK QUEUE</span>
                  <h2 id="pending-valuations-title">Pending valuations</h2>
                </div>
                <span className="liveLabel">{pendingValuations.length} to review</span>
              </div>
              <div className="queueFilters">
                <label>
                  <span className="srOnly">Search pending valuations</span>
                  <input
                    type="search"
                    placeholder="Search device, category, brand or customer"
                    value={queueSearch}
                    onChange={(event) => setQueueSearch(event.target.value)}
                  />
                </label>
                <label>
                  <span className="srOnly">Filter by device status</span>
                  <select value={queueStatus} onChange={(event) => setQueueStatus(event.target.value)}>
                    <option value="All">All eligible statuses</option>
                    <option value="Registered">Registered</option>
                    <option value="Estimate Declined">Estimate declined</option>
                  </select>
                </label>
              </div>
              {loading ? (
                <p className="stateMessage">Loading submitted devices…</p>
              ) : error ? null : (
                visibleValuations.length === 0 ? (
                  <div className="emptyState">
                    <h2>{pendingValuations.length ? "No matching devices" : "No devices awaiting valuation"}</h2>
                    <p>
                      {pendingValuations.length
                        ? "Try another search or status filter."
                        : "New registered devices will appear here until a preliminary offer is issued."}
                    </p>
                  </div>
                ) : (
                  <div className="valuationQueueList">
                    {visibleValuations.map((item) => (
                      <article
                        className={`valuationQueueItem${selectedValuationId === item.item_id ? " selected" : ""}`}
                        key={item.item_id}
                      >
                        <div className="valuationQueueSummary">
                          <span className="eyebrow">ITEM #{item.item_id} · {item.category_name}</span>
                          <h3>{item.item_name}</h3>
                          <p>{item.brand_name ?? "Unbranded"}{item.condition ? ` · ${item.condition} condition` : ""}</p>
                          <p>Customer: {item.customer_name}</p>
                          <p>Submitted: {dateLabel(item.submitted_at)} · {item.item_status}</p>
                          <p>
                            Previous preliminary offer:{" "}
                            {item.previous_offer_status
                              ? `${item.previous_offer_status}${item.previous_offer_amount != null
                                ? ` · ${money(item.previous_offer_amount, item.previous_offer_currency ?? "INR")}`
                                : ""}`
                              : "None"}
                          </p>
                          {item.description && <p className="valuationDescription">{item.description}</p>}
                        </div>
                        <button
                          type="button"
                          className={selectedValuationId === item.item_id ? "outlineButton" : "primaryButton"}
                          onClick={() => {
                            setSelectedValuationId(item.item_id);
                            setForm({ ...form, itemId: String(item.item_id), stage: "Preliminary" });
                            setError("");
                          }}
                        >
                          {selectedValuationId === item.item_id ? "Selected for valuation" : "Review device"}
                        </button>
                      </article>
                    ))}
                  </div>
                )
              )}
            </section>

            <div className="formPanel">
              <h2>Create an offer</h2>
              <p className="formHelp">
                Preliminary offers are limited to the pending queue. Final offers can only be created for inspected devices.
              </p>
              <form className="deviceForm" onSubmit={createOffer}>
                <label htmlFor="offerStage">Offer stage</label>
                <select
                  id="offerStage"
                  value={form.stage}
                  onChange={(event) => {
                    const stage = event.target.value === "Final" ? "Final" : "Preliminary";
                    setForm({ ...form, stage, itemId: "" });
                    setSelectedValuationId(null);
                  }}
                >
                  <option value="Preliminary">Preliminary offer</option>
                  <option value="Final">Final offer after inspection</option>
                </select>

                <label htmlFor="offerItem">Device</label>
                <select
                  id="offerItem"
                  required
                  value={form.itemId}
                  onChange={(event) => {
                    const itemId = event.target.value;
                    const inspection = inspections.find((entry) => entry.itemId === Number(itemId));
                    setForm({
                      ...form,
                      itemId,
                      disposition:
                        inspection?.processingType === "Refurbishment"
                          ? "Refurbishment"
                          : "Recycling",
                    });
                    if (form.stage === "Preliminary") {
                      setSelectedValuationId(Number(event.target.value) || null);
                    }
                  }}
                >
                  <option value="">Select an eligible device</option>
                  {form.stage === "Preliminary"
                    ? pendingValuations.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          #{item.item_id} · {item.item_name} · {item.customer_name}
                        </option>
                      ))
                    : finalCandidates.map((item) => (
                        <option key={item.itemId} value={item.itemId}>
                          #{item.itemId} · {item.itemName}
                        </option>
                      ))}
                </select>
                {form.stage === "Final" && finalCandidates.length === 0 && (
                  <p className="formHelp">No inspected devices are currently eligible for a final offer.</p>
                )}

                {form.stage === "Preliminary" && selectedValuation && (
                  <section className="valuationReview" aria-label="Selected device details">
                    <span className="eyebrow">DEVICE REVIEW</span>
                    <h3>{selectedValuation.item_name}</h3>
                    <p>#{selectedValuation.item_id} · {selectedValuation.brand_name ?? "Unbranded"} · {selectedValuation.category_name}</p>
                    <p>Condition: {selectedValuation.condition ?? "Not provided"}</p>
                    <p>Description: {selectedValuation.description ?? "Not provided"}</p>
                    <p>Customer: {selectedValuation.customer_name}</p>
                    <p>Submission date: {dateLabel(selectedValuation.submitted_at)}</p>
                  </section>
                )}

                {form.stage === "Final" && selectedInspection && (
                  <section className="valuationReview" aria-label="Inspection review">
                    <span className="eyebrow">INSPECTION #{selectedInspection.inspectionId}</span>
                    <h3>{selectedInspection.itemName}</h3>
                    <p>Inspected: {dateLabel(selectedInspection.inspectionDate)}</p>
                    <p>Assessment: {selectedInspection.conditionAssessment ?? "Not recorded"}</p>
                    <p>Damage level: {selectedInspection.damageLevel ?? "Not recorded"}</p>
                    <p>Recommendation: {selectedInspection.inspectionResult ?? "Not recorded"} · {selectedInspection.processingType ?? "No disposition"}</p>
                    <p>Estimated repair cost: {selectedInspection.estimatedRepairCost == null ? "Not recorded" : money(selectedInspection.estimatedRepairCost, form.currency)}</p>
                    {inspectionError && <p className="errorMessage">{inspectionError}</p>}
                    {!inspectionError && !selectedInspectionReport && (
                      <p className="formHelp">No detailed technician report is attached to this inspection yet.</p>
                    )}
                    {selectedInspectionReport && (
                      <div className="inspectionFindings">
                        <p><strong>Technician notes:</strong> {selectedInspectionReport.technicianNotes}</p>
                        {selectedInspectionReport.observations.length > 0 && (
                          <p><strong>Observations:</strong> {selectedInspectionReport.observations.join(" · ")}</p>
                        )}
                        {selectedInspectionReport.componentFindings.map((finding, index) => (
                          <p key={`${finding.component}-${index}`}>
                            <strong>{finding.component}:</strong> {finding.condition} — {finding.notes}
                          </p>
                        ))}
                        {selectedInspectionReport.repairRecommendations.length > 0 && (
                          <p><strong>Repair recommendations:</strong> {selectedInspectionReport.repairRecommendations.join(" · ")}</p>
                        )}
                      </div>
                    )}
                  </section>
                )}

                <label htmlFor="offerAmount">Offer amount</label>
                <input id="offerAmount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
                <label htmlFor="offerCurrency">Currency (ISO 4217 code)</label>
                <input id="offerCurrency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} />
                {form.stage === "Final" && (
                  <>
                    <label htmlFor="offerDisposition">Supported disposition</label>
                    <select id="offerDisposition" value={form.disposition} onChange={(event) => setForm({ ...form, disposition: event.target.value })}>
                      <option value="Recycling">Recycling</option>
                      <option value="Refurbishment">Refurbishment</option>
                    </select>
                  </>
                )}
                <label htmlFor="offerReason">{form.stage === "Final" ? "Final offer explanation / difference" : "Offer explanation"}</label>
                <textarea id="offerReason" required maxLength={1000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
                <label htmlFor="valuationNotes">Valuation notes (optional)</label>
                <textarea id="valuationNotes" maxLength={1000} value={form.valuationNotes} onChange={(event) => setForm({ ...form, valuationNotes: event.target.value })} />
                <button type="submit" disabled={saving || (form.stage === "Preliminary" ? pendingValuations.length === 0 : finalCandidates.length === 0)}>
                  {saving ? "Publishing…" : "Publish offer"}
                </button>
              </form>
            </div>
          </>
        )}
        <section className="offerHistorySection">
          <div className="offerHistoryHeading">
            <div>
              <span className="eyebrow">{management ? "OFFER MONITOR" : "YOUR OFFER HISTORY"}</span>
              <h2>{management ? "Offer activity" : "My offers"}</h2>
              <p className="formHelp">Most recent offers appear first; previous decisions remain in your history.</p>
            </div>
          </div>
          {!management && offers.length === 0 && !loading && !error && (
            <div className="emptyState">
              <h2>Your devices are awaiting staff valuation</h2>
              <p>Offers will appear here as soon as the operations team reviews your submitted devices.</p>
              <Link href="/items" className="primaryAction">View my devices <span aria-hidden="true">→</span></Link>
            </div>
          )}
          {offers.length > 0 && (
            <div className="offerFilters" role="group" aria-label="Filter offer history">
              {(["All", "Pending", "Accepted", "Declined", "Preliminary", "Final"] as OfferFilter[]).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  aria-pressed={offerFilter === filter}
                  className={offerFilter === filter ? "active" : ""}
                  onClick={() => setOfferFilter(filter)}
                >
                  {filter === "Pending" ? "Awaiting response" : filter}
                </button>
              ))}
            </div>
          )}
          {loading ? <p className="stateMessage">Loading offers…</p> : error ? null : offers.length > 0 && visibleOffers.length === 0 ? (
            <div className="emptyState"><h2>No offers in this view</h2><p>Choose another filter to review your offer history.</p></div>
          ) : offers.length > 0 && (
          <div className="reportList">
            {visibleOffers.map((offer) => (
              <article className="reportCard offerCard" key={offer.offer_id}>
                <div className="offerHeading">
                  <div><p className="description">OFFER #{offer.offer_id} · DEVICE #{offer.item_id}</p><h2>{offer.item_name}</h2></div>
                  <span className={`statusBadge status-${offer.offer_status.toLowerCase()}`}>{offerStatusLabel(offer.offer_status)}</span>
                </div>
                <p className="offerAmount">{money(offer.amount, offer.currency)}</p>
                <p><strong>{offer.offer_stage} offer</strong>{offer.disposition ? ` · ${offer.disposition} recommendation` : ""}</p>
                <p>{offer.reason}</p>
                {offer.valuation_notes && <p className="offerNotes"><strong>Valuation notes:</strong> {offer.valuation_notes}</p>}
                <p className="description">Created {dateLabel(offer.created_at)}{offer.decided_at ? ` · Decision recorded ${dateLabel(offer.decided_at)}` : ""}</p>
                {!management && offer.offer_status === "Pending" && (
                  <div className="offerActions">
                    <button type="button" className="primaryButton" disabled={saving} onClick={() => setPendingDecision({ offer, decision: "Accepted" })}>Accept offer</button>
                    <button type="button" className="outlineButton" disabled={saving} onClick={() => setPendingDecision({ offer, decision: "Declined" })}>Decline offer</button>
                  </div>
                )}
                {!management && offer.offer_status === "Accepted" && offer.offer_stage === "Preliminary" && <Link className="primaryAction" href="/pickups">Request a pickup</Link>}
                {!management && offer.offer_status === "Declined" && offer.offer_stage === "Final" && <p className="warningNote">Your device needs a return-resolution arrangement before processing can continue.</p>}
              </article>
            ))}
          </div>
          )}
        </section>
      </section>
      <dialog
        ref={decisionDialog}
        className="confirmationDialog"
        aria-labelledby="offer-decision-title"
        onCancel={(event) => {
          event.preventDefault();
          setPendingDecision(null);
        }}
      >
        {pendingDecision && (
          <>
            <span className="authFormEyebrow">CUSTOMER DECISION</span>
            <h2 id="offer-decision-title">
              {pendingDecision.decision === "Accepted" ? "Accept this offer?" : "Decline this offer?"}
            </h2>
            <p>
              {pendingDecision.offer.item_name} · {money(pendingDecision.offer.amount, pendingDecision.offer.currency)}
            </p>
            <p className="formHelp">
              {pendingDecision.decision === "Accepted"
                ? "Your decision will be recorded for this offer."
                : "This offer will be marked as declined. You can review the offer details before confirming."}
            </p>
            <div className="dialogActions">
              <button className="outlineButton" type="button" onClick={() => setPendingDecision(null)}>
                Go back
              </button>
              <button
                className="primaryButton"
                type="button"
                disabled={saving}
                onClick={() => void decide(pendingDecision.offer.offer_id, pendingDecision.decision)}
              >
                {saving ? "Saving..." : `Confirm ${pendingDecision.decision.toLowerCase()}`}
              </button>
            </div>
          </>
        )}
      </dialog>
      </div>
    </AppShell>
  );
}
