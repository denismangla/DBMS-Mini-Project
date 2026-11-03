"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type InspectionOption = {
  inspectionId: number;
  itemId: number;
  itemName: string;
};

type InspectionCandidate = { itemId: number; itemName: string };

type ComponentFinding = {
  component: string;
  condition: string;
  notes: string;
};

type InspectionReport = {
  _id: string;
  inspectionId: number;
  itemId: number;
  technicianNotes: string;
  observations: string[];
  componentFindings: ComponentFinding[];
  repairRecommendations: string[];
  attachments: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function InspectionsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [inspectionOptions, setInspectionOptions] = useState<
    InspectionOption[]
  >([]);
  const [inspectionCandidates, setInspectionCandidates] = useState<
    InspectionCandidate[]
  >([]);
  const [selectedInspection, setSelectedInspection] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [technicianNotes, setTechnicianNotes] = useState("");
  const [observations, setObservations] = useState("");
  const [componentFindings, setComponentFindings] = useState("");
  const [repairRecommendations, setRepairRecommendations] = useState("");
  const [attachments, setAttachments] = useState("");
  const [newInspection, setNewInspection] = useState({
    itemId: "",
    conditionAssessment: "",
    damageLevel: "Moderate",
    inspectionResult: "Refurbishment recommended",
    estimatedRepairCost: "",
  });

  const loadReports = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/inspections", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to load inspection reports.");
        return;
      }
      setRole(data.userRole ?? "");
      setReports(data.reports ?? []);
      setInspectionOptions(data.inspectionOptions ?? []);
      setInspectionCandidates(data.inspectionCandidates ?? []);
      if (!selectedInspection && data.inspectionOptions?.length) {
        setSelectedInspection(String(data.inspectionOptions[0].inspectionId));
      }
    } catch (requestError) {
      console.error("Failed to load inspection reports:", requestError);
      setError("Unable to load inspection reports.");
    } finally {
      setLoading(false);
    }
  }, [router, selectedInspection]);

  useEffect(() => {
    void Promise.resolve().then(loadReports);
  }, [loadReports]);

  async function handleCreateInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const processingType =
      newInspection.inspectionResult === "Refurbishment recommended"
        ? "Refurbishment"
        : newInspection.inspectionResult === "Recycling recommended"
          ? "Recycling"
          : null;
    try {
      const response = await fetch("/api/inspections/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newInspection,
          itemId: Number(newInspection.itemId),
          estimatedRepairCost: newInspection.estimatedRepairCost || null,
          processingType,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to save the structured inspection.");
        return;
      }
      setMessage(data.message);
      setSelectedInspection(String(data.inspectionId));
      setNewInspection({
        itemId: "",
        conditionAssessment: "",
        damageLevel: "Moderate",
        inspectionResult: "Refurbishment recommended",
        estimatedRepairCost: "",
      });
      await loadReports();
    } catch (requestError) {
      console.error("Failed to save structured inspection:", requestError);
      setError("Unable to connect to the inspection service.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const option = inspectionOptions.find(
      (entry) => entry.inspectionId === Number(selectedInspection)
    );
    if (!option) {
      setError("Select an existing inspection and device.");
      return;
    }

    const findings = splitLines(componentFindings).map((line) => {
      const [component, condition, ...details] = line.split("|");
      return {
        component: component?.trim() ?? "",
        condition: condition?.trim() ?? "",
        notes: details.join("|").trim(),
      };
    });

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId: option.inspectionId,
          itemId: option.itemId,
          technicianNotes,
          observations: splitLines(observations),
          componentFindings: findings,
          repairRecommendations: splitLines(repairRecommendations),
          attachments: splitLines(attachments),
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? "Unable to save inspection report.");
        return;
      }
      setMessage(data.message ?? "Inspection report saved.");
      setTechnicianNotes("");
      setObservations("");
      setComponentFindings("");
      setRepairRecommendations("");
      setAttachments("");
      await loadReports();
    } catch (requestError) {
      console.error("Failed to save inspection report:", requestError);
      setError("Unable to save inspection report.");
    } finally {
      setSaving(false);
    }
  }

  const canCreate = role === "STAFF" || role === "ADMIN";

  return (
    <main className="itemsPage">
      <header className="pageHeader">
        <div>
          <h1>Inspection Reports</h1>
          <p>Reports stored in MongoDB for MySQL inspection and device records.</p>
        </div>
        <Link href="/dashboard" className="backButton">
          Dashboard
        </Link>
      </header>

      <section className="itemsSection">
        {message && <p className="successMessage">{message}</p>}
        {error && <p className="errorMessage">{error}</p>}

        {canCreate && (
          <div className="formPanel">
            <h2>Record structured inspection</h2>
            <p className="formHelp">
              This creates the authoritative inspection row and device status in MySQL.
              Detailed findings are saved in MongoDB in the next form.
            </p>
            <form className="deviceForm" onSubmit={handleCreateInspection}>
              <label htmlFor="candidateItem">Collected device</label>
              <select id="candidateItem" required value={newInspection.itemId} onChange={(event) => setNewInspection({ ...newInspection, itemId: event.target.value })} disabled={inspectionCandidates.length === 0}>
                <option value="">Select a collected device</option>
                {inspectionCandidates.map((candidate) => <option key={candidate.itemId} value={candidate.itemId}>#{candidate.itemId} · {candidate.itemName}</option>)}
              </select>
              <label htmlFor="conditionAssessment">Condition assessment</label>
              <textarea id="conditionAssessment" required maxLength={500} value={newInspection.conditionAssessment} onChange={(event) => setNewInspection({ ...newInspection, conditionAssessment: event.target.value })} />
              <label htmlFor="damageLevel">Damage level</label>
              <select id="damageLevel" value={newInspection.damageLevel} onChange={(event) => setNewInspection({ ...newInspection, damageLevel: event.target.value })}>
                {["Low", "Moderate", "High", "Critical", "Unknown"].map((level) => <option key={level}>{level}</option>)}
              </select>
              <label htmlFor="inspectionResult">Inspection outcome</label>
              <select id="inspectionResult" value={newInspection.inspectionResult} onChange={(event) => setNewInspection({ ...newInspection, inspectionResult: event.target.value })}>
                {["Refurbishment recommended", "Recycling recommended"].map((outcome) => <option key={outcome}>{outcome}</option>)}
              </select>
              <label htmlFor="estimatedRepairCost">Estimated repair cost (optional)</label>
              <input id="estimatedRepairCost" type="number" min="0" step="0.01" value={newInspection.estimatedRepairCost} onChange={(event) => setNewInspection({ ...newInspection, estimatedRepairCost: event.target.value })} />
              <button type="submit" disabled={saving || inspectionCandidates.length === 0}>{saving ? "Saving inspection..." : "Save structured inspection"}</button>
            </form>
          </div>
        )}

        {canCreate && (
          <div className="formPanel">
            <h2>Create an inspection report</h2>
            <form className="deviceForm" onSubmit={handleCreateReport}>
              <label htmlFor="inspection">Inspection and device</label>
              <select
                id="inspection"
                required
                value={selectedInspection}
                onChange={(event) => setSelectedInspection(event.target.value)}
              >
                <option value="">Select an inspection</option>
                {inspectionOptions.map((option) => (
                  <option
                    key={option.inspectionId}
                    value={option.inspectionId}
                  >
                    #{option.inspectionId} · {option.itemName} (item #
                    {option.itemId})
                  </option>
                ))}
              </select>

              <label htmlFor="technicianNotes">Technician notes</label>
              <textarea
                id="technicianNotes"
                required
                maxLength={5000}
                value={technicianNotes}
                onChange={(event) => setTechnicianNotes(event.target.value)}
              />

              <label htmlFor="observations">Observations (one per line)</label>
              <textarea
                id="observations"
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
              />

              <label htmlFor="componentFindings">
                Component findings (component | condition | finding, one per line)
              </label>
              <textarea
                id="componentFindings"
                value={componentFindings}
                onChange={(event) =>
                  setComponentFindings(event.target.value)
                }
              />

              <label htmlFor="repairRecommendations">
                Repair recommendations (one per line)
              </label>
              <textarea
                id="repairRecommendations"
                value={repairRecommendations}
                onChange={(event) =>
                  setRepairRecommendations(event.target.value)
                }
              />

              <label htmlFor="attachments">
                Attachment names (one per line; file upload is not provided)
              </label>
              <textarea
                id="attachments"
                value={attachments}
                onChange={(event) => setAttachments(event.target.value)}
              />

              <button
                type="submit"
                disabled={saving || inspectionOptions.length === 0}
              >
                {saving ? "Saving report..." : "Save inspection report"}
              </button>
            </form>
          </div>
        )}

        <h2 className="sectionHeading">Saved reports</h2>
        {loading ? (
          <p>Loading inspection reports...</p>
        ) : reports.length === 0 ? (
          <p>No inspection reports found.</p>
        ) : (
          <div className="reportList">
            {reports.map((report) => (
              <article className="reportCard" key={report._id}>
                <h3>
                  {report.technicianNotes || "Inspection report"} · Item #
                  {report.itemId}
                </h3>
                <p className="formHelp">
                  Inspection #{report.inspectionId}
                  {report.createdAt
                    ? ` · Saved ${new Date(report.createdAt).toLocaleString()}`
                    : ""}
                </p>
                <h4>Observations</h4>
                {report.observations?.length ? (
                  <ul>
                    {report.observations.map((observation, index) => (
                      <li key={`${report._id}-observation-${index}`}>
                        {observation}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No observations recorded.</p>
                )}
                <h4>Component condition and findings</h4>
                {report.componentFindings?.length ? (
                  <ul>
                    {report.componentFindings.map((finding, index) => (
                      <li key={`${report._id}-component-${index}`}>
                        <strong>{finding.component}</strong>: {finding.condition}
                        {" — "}
                        {finding.notes}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No component findings recorded.</p>
                )}
                <h4>Repair recommendations</h4>
                {report.repairRecommendations?.length ? (
                  <ul>
                    {report.repairRecommendations.map((recommendation, index) => (
                      <li key={`${report._id}-recommendation-${index}`}>
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No repair recommendations recorded.</p>
                )}
                <h4>Attachments</h4>
                <p>
                  {report.attachments?.length
                    ? report.attachments.join(", ")
                    : "No attachment names recorded."}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
