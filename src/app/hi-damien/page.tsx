import type { Metadata } from "next";
import Link from "next/link";
import GreetingPlayer from "./greeting-player";

export const metadata: Metadata = {
  title: "Hi Damien",
  description: "A little spoken hello, just for Damien.",
};

export default function HiDamienPage() {
  return (
    <main className="page-shell greeting-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="My Next App home">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span>My Next App</span>
        </Link>
        <Link className="back-link" href="/">
          Back home <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <section className="greeting-card" aria-labelledby="greeting-title">
        <p className="eyebrow">A little hello for you</p>
        <h1 id="greeting-title">
          Hi <span>Damien.</span>
        </h1>
        <p className="greeting-copy">
          Some things are even better when you hear them.
        </p>
        <GreetingPlayer name="Damien" />
        <p className="greeting-footnote">
          Spoken by your browser. Tap play to hear it.
        </p>
      </section>
    </main>
  );
}
