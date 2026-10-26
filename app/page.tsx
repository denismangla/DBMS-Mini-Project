import Link from "next/link";

export default function HomePage() {
  return (
    <main className="publicHome">
      <header className="publicHeader">
        <div>
          <h1>Smart E-Waste Management System</h1>
          <p>Collection, recycling and refurbishment management platform</p>
        </div>

        <Link href="/login" className="loginButton">
          Login
        </Link>
      </header>

      <section className="heroSection">
        <div className="heroContent">
          <span className="eyebrow">Smart E-Waste</span>
          <h2>Manage the complete e-waste lifecycle in one place.</h2>
          <p>
            Track electronic waste from registration and pickup through
            inspection, recycling and refurbishment using a connected
            MySQL, MongoDB and Next.js platform.
          </p>

          <div className="heroActions">
            <Link href="/login" className="primaryAction">
              Login to System
            </Link>
          </div>
        </div>
      </section>

      <section className="publicFeatures">
        <div className="publicFeatureCard">
          <h3>♻️ E-Waste Collection</h3>
          <p>
            Register electronic waste and manage pickup requests through
            collection centers and collectors.
          </p>
        </div>

        <div className="publicFeatureCard">
          <h3>🔍 Inspection</h3>
          <p>
            Record inspection outcomes and determine whether collected items
            should be recycled or refurbished.
          </p>
        </div>

        <div className="publicFeatureCard">
          <h3>🌱 Recycling</h3>
          <p>
            Track recycling activity, recovered materials, quantities and
            values.
          </p>
        </div>

        <div className="publicFeatureCard">
          <h3>🛠️ Refurbishment</h3>
          <p>
            Manage reusable devices and monitor their sale and payment status.
          </p>
        </div>
      </section>

      <section className="publicInfo">
        <h2>How the system works</h2>
        <div className="workflow">
          <span>Register</span>
          <span>→</span>
          <span>Pickup</span>
          <span>→</span>
          <span>Inspect</span>
          <span>→</span>
          <span>Recycle / Refurbish</span>
        </div>
        <p>
          The public landing page is available without authentication. The
          operational dashboard and database-backed modules require login.
        </p>
      </section>

      <footer className="publicFooter">
        <p>Smart E-Waste Collection, Recycling and Refurbishment System</p>
      </footer>
    </main>
  );
}
