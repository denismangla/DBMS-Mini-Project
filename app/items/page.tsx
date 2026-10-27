"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

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
        setMessage(data.message ?? "Unable to load e-waste items.");
        return;
      }
      setItems(data.items);
      setCategories(data.categories ?? []);
      setBrands(data.brands ?? []);
      setRole(data.userRole ?? "");
    } catch (error) {
      console.error("Failed to load items:", error);
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
        setMessage(data.message ?? "Unable to register this device.");
        return;
      }

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
      setMessage("Unable to connect to the device registration service.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="itemsPage">
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
        {message && <p className="loginMessage">{message}</p>}
        {loading ? (
          <p>Loading items...</p>
        ) : items.length === 0 ? (
          <p>No e-waste items found.</p>
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
    </main>
  );
}
