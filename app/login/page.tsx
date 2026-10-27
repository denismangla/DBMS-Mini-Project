"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type LoginResponse = {
  success?: boolean;
  message?: string;
  user?: {
    name: string;
    role: string;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const data: LoginResponse = contentType.includes("application/json")
        ? await response.json()
        : {
            success: false,
            message: "The login service returned an unexpected response.",
          };

      if (!response.ok || !data.success) {
        setMessage(data.message ?? "Login failed.");
        return;
      }

      setMessage(
        `Welcome, ${data.user?.name ?? "user"} (${data.user?.role ?? ""}).`
      );

      router.push("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Unable to connect to the login service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <div className="loginCard">
        <h1>Smart E-Waste</h1>

        <p className="loginSubtitle">
          Login to access the management system
        </p>
        <form onSubmit={handleLogin}>
          <label htmlFor="email">Email</label>

          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {message && <p className="loginMessage">{message}</p>}

        <Link href="/register" className="loginBack">
          Create a customer account
        </Link>
        <Link href="/" className="loginBack">
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}
