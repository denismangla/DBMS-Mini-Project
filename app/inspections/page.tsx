"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type InspectionOption = {
  inspectionId: number;
  itemId: number;
  itemName: string;
};

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
