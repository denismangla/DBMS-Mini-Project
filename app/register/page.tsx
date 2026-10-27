"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type RegistrationResponse = {
  success?: boolean;
  message?: string;
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone, address }),
      });
      const data: RegistrationResponse = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message ?? "Registration failed.");
        return;
      }

      setRegistered(true);
    } catch (error) {
      console.error("Registration request failed:", error);
      setMessage("Unable to connect to the registration service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <div className="loginCard">
        <h1>Create an account</h1>
        <p className="loginSubtitle">
          Register as a customer to track your e-waste.
        </p>

        {!registered && <form onSubmit={handleRegister}>
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            autoComplete="name"
            required
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={150}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            required
          />

          <label htmlFor="phone">Phone (optional)</label>
          <input
            id="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={20}
            autoComplete="tel"
          />

          <label htmlFor="address">Address (optional)</label>
          <input
            id="address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={255}
            autoComplete="street-address"
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>}

        {message && <p className="loginMessage">{message}</p>}

        <Link href="/login" className="loginBack">
          {registered ? "Continue to login" : "Already registered? Log in"}
        </Link>
      </div>
    </main>
  );
}
