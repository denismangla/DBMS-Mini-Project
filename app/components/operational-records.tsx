"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type RecyclingRecord = {
  recycling_id: number;
  inspection_id: number;
  recycling_date: string;
  recycling_method: string | null;
  recycling_status: string | null;
  recovered_material: string | null;
  recovered_quantity: number | string | null;
  recovered_value: number | string | null;
  purity_percentage: number | string | null;
  item_id: number;
  item_name: string;
};

type RefurbishedProduct = {
  product_id: number;
  product_name: string;
  model: string | null;
  condition: string | null;
  warranty_period: string | null;
  selling_price: number | string | null;
  sale_status: string | null;
  sale_date: string | null;
  payment_method: string | null;
  payment_status: string | null;
  inspection_id: number;
  processing_status: string | null;
  item_id: number;
  item_name: string;
};

type OperationalRecordsProps = {
  kind: "recycling" | "refurbishment";
};

const processStatuses = ["Pending", "In Progress", "Completed"];

function display(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

export default function OperationalRecords({ kind }: OperationalRecordsProps) {
  const router = useRouter();
  const [recycling, setRecycling] = useState<RecyclingRecord[]>([]);
  const [products, setProducts] = useState<RefurbishedProduct[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recyclingDrafts, setRecyclingDrafts] = useState<Record<number, string>>(
    {}
  );
  const [productDrafts, setProductDrafts] = useState<
    Record<number, { saleStatus: string; processingStatus: string }>
  >({});
  const isRecycling = kind === "recycling";
  const title = isRecycling ? "Recycling" : "Refurbishment";

  const loadRecords = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/${kind}`, { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? `Unable to load ${title.toLowerCase()} records.`);
        return;
      }
      setRole(data.userRole ?? "");
      if (isRecycling) {
        setRecycling(data.recycling ?? []);
        setRecyclingDrafts(
          Object.fromEntries(
            (data.recycling as RecyclingRecord[]).map((row) => [
              row.recycling_id,
              row.recycling_status ?? "Pending",
            ])
          )
        );
      } else {
        setProducts(data.products ?? []);
        setProductDrafts(
          Object.fromEntries(
            (data.products as RefurbishedProduct[]).map((row) => [
              row.product_id,
              {
                saleStatus: row.sale_status ?? "Available",
                processingStatus: row.processing_status ?? "Pending",
              },
            ])
          )
        );
      }
    } catch (requestError) {
      console.error(`Failed to load ${title.toLowerCase()} records:`, requestError);
      setError(`Unable to load ${title.toLowerCase()} records.`);
    } finally {
      setLoading(false);
    }
  }, [isRecycling, kind, router, title]);

  useEffect(() => {
    void Promise.resolve().then(loadRecords);
  }, [loadRecords]);

  async function saveStatus(id: number) {
    setSavingId(id);
    setMessage("");
    setError("");
    try {
      const body = isRecycling
        ? { status: recyclingDrafts[id] }
        : productDrafts[id];
      const response = await fetch(`/api/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message ?? `Unable to save ${title.toLowerCase()} status.`);
        return;
      }
      setMessage(data.message ?? "Status updated.");
      await loadRecords();
    } catch (requestError) {
      console.error(`Failed to save ${title.toLowerCase()} status:`, requestError);
      setError(`Unable to save ${title.toLowerCase()} status.`);
    } finally {
      setSavingId(null);
    }
  }

  const canEdit = role === "STAFF" || role === "ADMIN";

  return (
    <main className="itemsPage">
      <header className="pageHeader">
        <div>
          <h1>{title}</h1>
          <p>
            {canEdit
              ? "Review records and update operational statuses."
              : `View ${title.toLowerCase()} records associated with your devices.`}
          </p>
        </div>
        <Link href="/dashboard" className="backButton">
          Dashboard
        </Link>
      </header>

      <section className="itemsSection">
        {message && <p className="successMessage">{message}</p>}
        {error && <p className="errorMessage">{error}</p>}
        {loading ? (
          <p>Loading {title.toLowerCase()} records...</p>
        ) : isRecycling ? (
          recycling.length === 0 ? (
            <p>No recycling records found.</p>
          ) : (
            <div className="tableContainer">
              <table className="itemsTable">
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Device</th>
                    <th>Method</th>
                    <th>Recovered material</th>
                    <th>Recovered quantity</th>
                    <th>Status</th>
                    {canEdit && <th>Update status</th>}
                  </tr>
                </thead>
                <tbody>
                  {recycling.map((row) => (
                    <tr key={row.recycling_id}>
                      <td>#{row.recycling_id}</td>
                      <td>{row.item_name}</td>
                      <td>{display(row.recycling_method)}</td>
                      <td>{display(row.recovered_material)}</td>
                      <td>{display(row.recovered_quantity)}</td>
                      <td>{display(row.recycling_status)}</td>
                      {canEdit && (
                        <td>
                          <select
                            aria-label={`Recycling status for record ${row.recycling_id}`}
                            value={
                              recyclingDrafts[row.recycling_id] ??
                              row.recycling_status ??
                              "Pending"
                            }
                            onChange={(event) =>
                              setRecyclingDrafts({
                                ...recyclingDrafts,
                                [row.recycling_id]: event.target.value,
                              })
                            }
                          >
                            {processStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void saveStatus(row.recycling_id)}
                            disabled={savingId === row.recycling_id}
                          >
                            {savingId === row.recycling_id ? "Saving..." : "Save"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : products.length === 0 ? (
          <p>No refurbished products found.</p>
        ) : (
          <div className="tableContainer">
            <table className="itemsTable">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Device</th>
                  <th>Price</th>
                  <th>Sale status</th>
                  <th>Sale date</th>
                  <th>Payment status</th>
                  <th>Processing status</th>
                  {canEdit && <th>Update statuses</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const draft = productDrafts[product.product_id] ?? {
                    saleStatus: product.sale_status ?? "Available",
                    processingStatus: product.processing_status ?? "Pending",
                  };
                  return (
                    <tr key={product.product_id}>
                      <td>
                        {product.product_name}
                        <br />
                        <span className="description">
                          {display(product.model)}
                        </span>
                      </td>
                      <td>{product.item_name}</td>
                      <td>{display(product.selling_price)}</td>
                      <td>{display(product.sale_status)}</td>
                      <td>{display(product.sale_date)}</td>
                      <td>
                        {display(product.payment_status)}
                        {product.payment_method
                          ? ` · ${product.payment_method}`
                          : ""}
                      </td>
                      <td>{display(product.processing_status)}</td>
                      {canEdit && (
                        <td>
                          <label>
                            Sale
                            <select
                              value={draft.saleStatus}
                              onChange={(event) =>
                                setProductDrafts({
                                  ...productDrafts,
                                  [product.product_id]: {
                                    ...draft,
                                    saleStatus: event.target.value,
                                  },
                                })
                              }
                            >
                              {["Available", "Sold"].map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Processing
                            <select
                              value={draft.processingStatus}
                              onChange={(event) =>
                                setProductDrafts({
                                  ...productDrafts,
                                  [product.product_id]: {
                                    ...draft,
                                    processingStatus: event.target.value,
                                  },
                                })
                              }
                            >
                              {processStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => void saveStatus(product.product_id)}
                            disabled={savingId === product.product_id}
                          >
                            {savingId === product.product_id
                              ? "Saving..."
                              : "Save"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!canEdit && !loading && (
          <p className="formHelp">
            Operational status changes are available to staff and administrators.
          </p>
        )}
        {!isRecycling && canEdit && (
          <p className="formHelp">
            Marking a product Sold records the sale date. Payment status is
            displayed but is not changed or processed here.
          </p>
        )}
      </section>
    </main>
  );
}
