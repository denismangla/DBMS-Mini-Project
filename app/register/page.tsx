"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import BrandLockup from "../components/brand-lockup";

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
  const [showPassword, setShowPassword] = useState(false);

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
      setMessage(data.message ?? "Your account is ready. Sign in to continue.");
    } catch (error) {
      console.error("Registration request failed:", error);
      setMessage("Unable to connect to the registration service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authStory">
        <BrandLockup href="/" variant="public" />
        <div className="authStoryContent">
          <span className="heroKicker"><span /> Make the next step count</span>
          <h1>Give good tech<br /><em>another chapter.</em></h1>
          <p>Create your space to register a device, follow collection progress and see what happens next.</p>
          <div className="authStoryLine"><span>01</span><i /><span>COLLECT</span><i /><span>RENEW</span><i /><span>RECOVER</span></div>
        </div>
        <p className="authStoryFoot">Your next small step can keep value in motion.</p>
        <div className="authOrb authOrbOne" />
        <div className="authOrb authOrbTwo" />
      </section>
      <section className="authFormPanel">
        <div className="authFormTop">
          <span>CREATE YOUR ACCOUNT</span>
          <Link href="/">Back to E-Kachra Mitra <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="loginCard">
          <span className="authFormEyebrow">A FRESH START FOR YOUR DEVICES</span>
          <h2>Create your account</h2>
          <p className="loginSubtitle">Join E-Kachra Mitra and keep your e-waste journey in view.</p>

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

            <label htmlFor="email">Email address</label>
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
            <div className="passwordField">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                required
              />
              <button
                className="passwordToggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="fieldHint">Use at least 8 characters.</p>

            <label htmlFor="phone">Phone <span>(optional)</span></label>
            <input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={20}
              autoComplete="tel"
            />

            <label htmlFor="address">Address <span>(optional)</span></label>
            <input
              id="address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              maxLength={255}
              autoComplete="street-address"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"} <span aria-hidden="true">↗</span>
            </button>
          </form>}

          {message && <p className={registered ? "successMessage" : "loginMessage"} role={registered ? "status" : "alert"}>{message}</p>}
          <p className="authSwitch">Already have an account? <Link href="/login">Sign in</Link></p>
        </div>
        <p className="authLegal">Your details are used to manage your account and device collection.</p>
      </section>
    </main>
  );
}
