"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadItems() {
      try {
        const response = await fetch("/api/items", {
          cache: "no-store",
        });

        const data = await response.json();

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (data.success) {
          setItems(data.items);
          setRole(data.userRole ?? "");
        }
      } catch (error) {
        console.error("Failed to load items:", error);
      } finally {
        setLoading(false);
      }
    }

    loadItems();
  }, [router]);

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
