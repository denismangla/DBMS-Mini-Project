"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import BrandLockup from "../components/brand-lockup";

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
  const [showPassword, setShowPassword] = useState(false);

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
    <main className="authPage">
      <section className="authStory">
        <BrandLockup href="/" variant="public" />
        <div className="authStoryContent">
          <span className="heroKicker"><span /> A better loop starts here</span>
          <h1>Small actions.<br /><em>Lasting impact.</em></h1>
          <p>Keep your device journey clear, considered and moving toward its next useful chapter.</p>
          <div className="authStoryLine"><span>01</span><i /><span>COLLECT</span><i /><span>RENEW</span><i /><span>RECOVER</span></div>
        </div>
        <p className="authStoryFoot">Thoughtful collection. Better reuse.</p>
        <div className="authOrb authOrbOne" />
        <div className="authOrb authOrbTwo" />
      </section>
      <section className="authFormPanel">
        <div className="authFormTop">
          <span>WELCOME BACK</span>
          <Link href="/">Back to E-Kachra Mitra <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="loginCard">
          <span className="authFormEyebrow">YOUR CIRCULAR WORKSPACE</span>
          <h2>Sign in</h2>
          <p className="loginSubtitle">Pick up where your device journey left off.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <div className="passwordLabelRow">
              <label htmlFor="password">Password</label>
            </div>
            <div className="passwordField">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
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
            <button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in to your account"} <span aria-hidden="true">↗</span>
            </button>
          </form>
          {message && <p className="loginMessage" role="status">{message}</p>}
          <p className="authSwitch">New to E-Kachra Mitra? <Link href="/register">Create an account</Link></p>
        </div>
        <p className="authLegal">Your account keeps your device and collection updates together.</p>
      </section>
    </main>
  );
}
