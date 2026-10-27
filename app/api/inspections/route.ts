import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { requireRole } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import pool from "@/lib/mysql";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

function authFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHENTICATED") {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401, headers: noStore }
    );
  }
  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "Staff or administrator access is required." },
      { status: 403, headers: noStore }
    );
  }
  return null;
}

type ComponentFinding = {
  component: string;
  condition: string;
  notes: string;
};

type InspectionReportBody = {
  inspectionId?: unknown;
  itemId?: unknown;
  technicianNotes?: unknown;
  observations?: unknown;
  componentFindings?: unknown;
  repairRecommendations?: unknown;
  attachments?: unknown;
};

function isRecord(value: unknown): value is InspectionReportBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown, maximumLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every(
      (entry) =>
        typeof entry === "string" &&
        entry.trim().length > 0 &&
        entry.length <= maximumLength
    )
  );
}

function isComponentFinding(value: unknown): value is ComponentFinding {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const finding = value as Record<string, unknown>;
  return (
    typeof finding.component === "string" &&
    finding.component.trim().length > 0 &&
    finding.component.length <= 150 &&
    typeof finding.condition === "string" &&
    finding.condition.trim().length > 0 &&
    finding.condition.length <= 100 &&
    typeof finding.notes === "string" &&
    finding.notes.trim().length > 0 &&
    finding.notes.length <= 1000
  );
}

export async function GET() {
  try {
    const user = await requireRole(["CUSTOMER", "STAFF", "ADMIN"]);
    const managementAccess = user.role !== "CUSTOMER";
    const [inspectionRows] = await pool.query(
      `
      SELECT i.inspection_id AS inspectionId, i.item_id AS itemId, e.item_name AS itemName
      FROM INSPECTION i
      JOIN E_WASTE_ITEM e ON i.item_id = e.item_id
      ${managementAccess ? "" : "WHERE e.user_id = ?"}
      ORDER BY i.inspection_id DESC
      `,
      managementAccess ? [] : [user.userId]
    );
    const inspections = inspectionRows as Array<{
      inspectionId: number;
      itemId: number;
      itemName: string;
    }>;
    const filter: Document = managementAccess
      ? {}
      : { itemId: { $in: inspections.map((inspection) => inspection.itemId) } };
    const db = await getMongoDb();
    const reports = await db
      .collection<Document>("inspection_reports")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    const serializedReports = reports.map((report) => ({
      ...report,
      _id: report._id.toString(),
      createdAt:
        report.createdAt instanceof Date
          ? report.createdAt.toISOString()
          : report.createdAt ?? null,
      updatedAt:
        report.updatedAt instanceof Date
          ? report.updatedAt.toISOString()
          : report.updatedAt ?? null,
    }));

    return NextResponse.json(
      {
        success: true,
        reports: serializedReports,
        inspectionOptions: inspections,
        userRole: user.role,
      },
      { headers: noStore }
    );
  } catch (error) {
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to load inspection reports.");
    return NextResponse.json(
      { success: false, message: "Unable to load inspection reports." },
      { status: 500, headers: noStore }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["STAFF", "ADMIN"]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "A valid JSON request body is required." },
        { status: 400, headers: noStore }
      );
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        { success: false, message: "A valid inspection report is required." },
        { status: 400, headers: noStore }
      );
    }

    const inspectionId = body.inspectionId;
    const itemId = body.itemId;
    const technicianNotes =
      typeof body.technicianNotes === "string"
        ? body.technicianNotes.trim()
        : "";
    const observations = body.observations ?? [];
    const componentFindings = body.componentFindings ?? [];
    const repairRecommendations = body.repairRecommendations ?? [];
    const attachments = body.attachments ?? [];

    if (
      typeof inspectionId !== "number" ||
      !Number.isSafeInteger(inspectionId) ||
      inspectionId <= 0 ||
      typeof itemId !== "number" ||
      !Number.isSafeInteger(itemId) ||
      itemId <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Valid inspection and item IDs are required." },
        { status: 400, headers: noStore }
      );
    }
    if (!technicianNotes || technicianNotes.length > 5000) {
      return NextResponse.json(
        { success: false, message: "Technician notes are required and must be 5,000 characters or fewer." },
        { status: 400, headers: noStore }
      );
    }
    if (
      !isStringList(observations, 1000) ||
      !Array.isArray(componentFindings) ||
      componentFindings.length > 50 ||
      !componentFindings.every(isComponentFinding) ||
      !isStringList(repairRecommendations, 1000) ||
      !isStringList(attachments, 255)
    ) {
      return NextResponse.json(
        { success: false, message: "Inspection findings, recommendations, or attachment names are invalid." },
        { status: 400, headers: noStore }
      );
    }

    const [matchingRows] = await pool.query(
      `
      SELECT inspection_id
      FROM INSPECTION
      WHERE inspection_id = ? AND item_id = ?
      LIMIT 1
      `,
      [inspectionId, itemId]
    );
    if ((matchingRows as Array<{ inspection_id: number }>).length === 0) {
      return NextResponse.json(
        { success: false, message: "The inspection does not belong to the specified item." },
        { status: 400, headers: noStore }
      );
    }

    const now = new Date();
    const report = {
      inspectionId,
      itemId,
      technicianNotes,
      observations: observations.map((entry) => entry.trim()),
      componentFindings: componentFindings.map((finding) => ({
        component: finding.component.trim(),
        condition: finding.condition.trim(),
        notes: finding.notes.trim(),
      })),
      repairRecommendations: repairRecommendations.map((entry) =>
        entry.trim()
      ),
      attachments: attachments.map((entry) => entry.trim()),
      createdAt: now,
      updatedAt: now,
    };
    const db = await getMongoDb();
    const result = await db
      .collection("inspection_reports")
      .insertOne(report);

    return NextResponse.json(
      {
        success: true,
        message: "Inspection report saved.",
        report: { ...report, _id: result.insertedId.toString() },
      },
      { status: 201, headers: noStore }
    );
  } catch (error) {
    const response = authFailure(error);
    if (response) return response;
    console.error("Failed to create inspection report.");
    return NextResponse.json(
      { success: false, message: "Unable to create inspection report." },
      { status: 500, headers: noStore }
    );
  }
}
