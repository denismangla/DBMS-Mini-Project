import Link from "next/link";
import BrandLockup from "./components/brand-lockup";

const journeySteps = [
  { number: "01", title: "Register", detail: "Tell us what you are ready to pass on." },
  { number: "02", title: "Collect", detail: "Choose a center and arrange a pickup." },
  { number: "03", title: "Inspect", detail: "Every device gets a considered assessment." },
  { number: "04", title: "Give it a next life", detail: "Reuse what we can. Recover what we cannot." },
];

export default function HomePage() {
  return (
    <main className="publicHome">
      <header className="publicHeader">
        <BrandLockup href="/" variant="public" />
        <nav className="publicNav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#our-approach">Our approach</a>
        </nav>
        <div className="publicHeaderActions">
          <Link href="/login" className="publicLoginLink">Log in</Link>
          <Link href="/register" className="primaryAction">Start a journey <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      <section className="heroSection">
        <div className="heroGrid" aria-hidden="true" />
        <div className="heroContent">
          <div className="heroCopy">
            <span className="heroKicker"><span /> A smarter circle for electronics</span>
            <h1>Good tech<br />deserves a<br /><em>next life.</em></h1>
            <p>
              Make responsible e-waste collection feel simple. Register a device,
              follow its journey, and see how it can be reused or recovered.
            </p>
            <div className="heroActions">
              <Link href="/register" className="primaryAction primaryAction-large">
                Start with a device <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/login" className="heroTextLink">
                Already with us? Log in <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="heroTrust">
              <span className="trustGlyph" aria-hidden="true">◎</span>
              <span>One clear journey, from collection to a better outcome.</span>
            </div>
          </div>

          <div className="heroVisual" aria-label="Illustration of a device in a circular reuse journey">
            <div className="visualOrbit visualOrbitOuter" />
            <div className="visualOrbit visualOrbitInner" />
            <div className="visualGlow" />
            <div className="visualLabel visualLabelTop"><span className="visualLabelDot" /> COLLECTION → CIRCULARITY</div>
            <svg className="deviceIllustration" viewBox="0 0 360 430" role="img" aria-labelledby="device-title">
              <title id="device-title">A phone being renewed for its next life</title>
              <defs>
                <linearGradient id="phoneShell" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#c8f89b" />
                  <stop offset="1" stopColor="#36c8a1" />
                </linearGradient>
                <linearGradient id="screenFill" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#193a34" />
                  <stop offset="1" stopColor="#0d2222" />
                </linearGradient>
              </defs>
              <path className="deviceAura" d="M75 103a132 132 0 0 1 199-24" />
              <path className="deviceAura deviceAuraSecond" d="M293 302a132 132 0 0 1-211 9" />
              <circle className="deviceOrbitDot" cx="278" cy="71" r="8" />
              <circle className="deviceOrbitDot deviceOrbitDotSecond" cx="73" cy="309" r="6" />
              <g className="phoneBody" transform="rotate(-8 181 216)">
                <rect x="104" y="52" width="154" height="326" rx="32" fill="url(#phoneShell)" />
                <rect x="112" y="60" width="138" height="310" rx="26" fill="#091917" />
                <rect x="119" y="68" width="124" height="294" rx="21" fill="url(#screenFill)" />
                <rect x="158" y="79" width="47" height="7" rx="4" fill="#385e53" />
                <circle cx="181" cy="335" r="10" fill="#54dda9" fillOpacity=".85" />
                <path d="M135 260c18-44 70-52 96-3" fill="none" stroke="#92e879" strokeWidth="4" strokeLinecap="round" />
                <path d="m219 248 13 3-7 11" fill="none" stroke="#92e879" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M224 284c-19 42-69 49-94 2" fill="none" stroke="#44c7ba" strokeWidth="4" strokeLinecap="round" />
                <path d="m139 298-13-3 7-11" fill="none" stroke="#44c7ba" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="181" cy="215" r="24" fill="#b9f27e" fillOpacity=".1" />
                <path d="m181 196 6 11 12 2-9 9 2 12-11-6-11 6 2-12-9-9 12-2z" fill="#d2fa86" />
              </g>
            </svg>
            <div className="visualLabel visualLabelBottom">
              <span className="visualLabelIcon" aria-hidden="true">↻</span>
              <span><strong>Keep value in motion</strong><small>Reuse first. Recover responsibly.</small></span>
            </div>
            <div className="visualChip visualChipLeft"><span>01</span> Repairable</div>
            <div className="visualChip visualChipRight"><span>02</span> Recoverable</div>
          </div>
        </div>
        <a className="scrollCue" href="#how-it-works"><span /> Scroll to explore</a>
      </section>

      <section className="publicPrinciples" id="our-approach">
        <div className="sectionOverline"><span>THE E-KACHRA MITRA APPROACH</span><i /></div>
        <div className="principleGrid">
          <article className="principleCard">
            <span className="principleNumber">01 / TRACK</span>
            <span className="principleIcon" aria-hidden="true">⌁</span>
            <h2>One device. One clear journey.</h2>
            <p>Keep registration, collection, inspection and processing updates together in one place.</p>
          </article>
          <article className="principleCard principleCardAccent">
            <span className="principleNumber">02 / EXTEND</span>
            <span className="principleIcon" aria-hidden="true">↗</span>
            <h2>Make room for another life.</h2>
            <p>When a device can be refurbished, its useful life can continue beyond your home.</p>
          </article>
          <article className="principleCard">
            <span className="principleNumber">03 / RECOVER</span>
            <span className="principleIcon" aria-hidden="true">◌</span>
            <h2>Recover materials with care.</h2>
            <p>Items that cannot be reused can move through a documented recycling process.</p>
          </article>
        </div>
      </section>

      <section className="journeySection" id="how-it-works">
        <div className="journeyHeading">
          <div>
            <div className="sectionOverline"><span>A SMALL STEP, A BETTER LOOP</span><i /></div>
            <h2>From your hands,<br /><em>back into the world.</em></h2>
          </div>
          <p>Stay informed at every step. Your account keeps device updates and next actions easy to find.</p>
        </div>
        <ol className="journeySteps">
          {journeySteps.map((step) => (
            <li className="journeyStep" key={step.number}>
              <span className="journeyStepNumber">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
        <Link href="/register" className="journeyCta">Begin your device journey <span aria-hidden="true">↗</span></Link>
      </section>

      <footer className="publicFooter">
        <BrandLockup href="/" variant="public" />
        <p>Thoughtful collection. Better reuse. A more circular future.</p>
        <div className="footerLinks"><Link href="/login">Log in</Link><Link href="/register">Create account</Link></div>
        <span className="footerCopyright">© {new Date().getFullYear()} E-Kachra Mitra</span>
      </footer>
    </main>
  );
}
