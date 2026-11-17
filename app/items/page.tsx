"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AppShell from "../components/app-shell";

type Item = {
  item_id: number;
  item_name: string;
  description: string;
  condition: string;
  estimated_weight: string;
  item_status: string;
  final_disposition: string | null;
  category_name: string;
  brand_name: string | null;
};

type Category = { category_id: number; category_name: string };
type Brand = { brand_id: number; brand_name: string };

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [form, setForm] = useState({
    itemName: "",
    description: "",
    condition: "",
    categoryId: "",
    brandId: "",
    manufactureYear: "",
    estimatedWeight: "",
    quantity: "",
  });

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch("/api/items", { cache: "no-store" });
      const data = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok || !data.success) {
        setMessageTone("error");
        setMessage(data.message ?? "Unable to load e-waste items.");
        return;
      }
      setItems(data.items);
      setCategories(data.categories ?? []);
      setBrands(data.brands ?? []);
      setRole(data.userRole ?? "");
    } catch (error) {
      console.error("Failed to load items:", error);
      setMessageTone("error");
      setMessage("Unable to load e-waste items.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(loadItems);
  }, [loadItems]);

  async function handleCreateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setMessageTone("success");

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok || !data.success) {
        setMessageTone("error");
        setMessage(data.message ?? "Unable to register this device.");
        return;
      }

      setMessageTone("success");
      setMessage("Device registered successfully.");
      setForm({
        itemName: "",
        description: "",
        condition: "",
        categoryId: "",
        brandId: "",
        manufactureYear: "",
        estimatedWeight: "",
        quantity: "",
      });
      await loadItems();
    } catch (error) {
      console.error("Device registration request failed:", error);
      setMessageTone("error");
      setMessage("Unable to connect to the device registration service.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell userRole={role}>
      <div className="pageContent">
      <header className="pageHeader">
        <div>
          <h1>E-Waste Items</h1>
          <p>
            {role === "CUSTOMER"
              ? "View your registered electronic waste."
              : "View registered electronic waste and its processing status."}
          </p>
        </div>

        <Link href="/dashboard" className="backButton">
          Dashboard
        </Link>
      </header>

      <section className="itemsSection">
        {role === "CUSTOMER" && (
          <div className="formPanel">
            <h2>Register an e-waste device</h2>
            <form className="deviceForm" onSubmit={handleCreateItem}>
              <label htmlFor="itemName">Device name</label>
              <input
                id="itemName"
                required
                maxLength={150}
                value={form.itemName}
                onChange={(event) =>
                  setForm({ ...form, itemName: event.target.value })
                }
              />

              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                maxLength={500}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />

              <label htmlFor="condition">Condition</label>
              <input
                id="condition"
                maxLength={50}
                value={form.condition}
                onChange={(event) =>
                  setForm({ ...form, condition: event.target.value })
                }
              />

              <label htmlFor="categoryId">Category</label>
              <select
                id="categoryId"
                required
                value={form.categoryId}
                onChange={(event) =>
                  setForm({ ...form, categoryId: event.target.value })
                }
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.category_name}
                  </option>
                ))}
              </select>

              <label htmlFor="brandId">Brand (optional)</label>
              <select
                id="brandId"
                value={form.brandId}
                onChange={(event) =>
                  setForm({ ...form, brandId: event.target.value })
                }
              >
                <option value="">No brand</option>
                {brands.map((brand) => (
                  <option key={brand.brand_id} value={brand.brand_id}>
                    {brand.brand_name}
                  </option>
                ))}
              </select>

              <label htmlFor="manufactureYear">Manufacture year (optional)</label>
              <input
                id="manufactureYear"
                type="number"
                min={1901}
                max={new Date().getFullYear()}
                value={form.manufactureYear}
                onChange={(event) =>
                  setForm({ ...form, manufactureYear: event.target.value })
                }
              />

              <label htmlFor="estimatedWeight">Estimated weight (kg)</label>
              <input
                id="estimatedWeight"
                type="number"
                min="0"
                step="0.01"
                value={form.estimatedWeight}
                onChange={(event) =>
                  setForm({ ...form, estimatedWeight: event.target.value })
                }
              />

              <label htmlFor="quantity">Quantity (optional)</label>
              <input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(event) =>
                  setForm({ ...form, quantity: event.target.value })
                }
              />

              <button type="submit" disabled={saving || categories.length === 0}>
                {saving ? "Registering..." : "Register device"}
              </button>
            </form>
            <p className="formHelp">
              New devices are recorded as Registered. Processing status is
              managed by staff.
            </p>
          </div>
        )}
        {message && (
          <p
            className={messageTone === "error" ? "errorMessage" : "successMessage"}
            role={messageTone === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        )}
        {loading ? (
          <p>Loading items...</p>
        ) : items.length === 0 ? (
          <p>No e-waste items found.</p>
        ) : role === "CUSTOMER" ? (
          <div className="deviceGrid">
            {items.map((item) => (
              <article className="deviceCard" key={item.item_id}>
                <div className="deviceCardTop">
                  <span className="deviceGlyph" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="7" y="2.5" width="10" height="19" rx="2" />
                      <path d="M10 18.5h4" />
                    </svg>
                  </span>
                  <span className={`statusBadge status-${item.item_status.toLowerCase().replaceAll(" ", "-")}`}>
                    {item.item_status}
                  </span>
                </div>
                <p className="deviceCardId">DEVICE #{item.item_id}</p>
                <h2>{item.item_name}</h2>
                <p className="deviceCardDescription">
                  {item.description || "No additional description provided."}
                </p>
                <div className="deviceCardMeta">
                  <span><small>Category</small><strong>{item.category_name}</strong></span>
                  <span><small>Condition</small><strong>{item.condition || "Not specified"}</strong></span>
                  <span><small>Weight</small><strong>{item.estimated_weight || "—"} kg</strong></span>
                  <span><small>Next path</small><strong>{item.final_disposition ?? "Under review"}</strong></span>
                </div>
                <Link href="/offers" className="deviceCardLink">
                  View related offers <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="tableContainer">
            <table className="itemsTable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Condition</th>
                  <th>Weight (kg)</th>
                  <th>Status</th>
                  <th>Disposition</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.item_id}>
                    <td>{item.item_id}</td>
                    <td>
                      <strong>{item.item_name}</strong>
                      <br />
                      <span className="description">
                        {item.description}
                      </span>
                    </td>
                    <td>{item.category_name}</td>
                    <td>{item.brand_name ?? "N/A"}</td>
                    <td>{item.condition}</td>
                    <td>{item.estimated_weight}</td>
                    <td>
                      <span className="statusBadge">
                        {item.item_status}
                      </span>
                    </td>
                    <td>{item.final_disposition ?? "Pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
    </AppShell>
  );
}
