import type { Metadata } from "next";
import Link from "next/link";
import GreetingPlayer from "../hi-damien/greeting-player";

export const metadata: Metadata = {
  title: "Hi Alvaro",
  description: "A little spoken hello, just for Alvaro.",
};

export default function HiAlvaroPage() {
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
          Hi <span>Alvaro.</span>
        </h1>
        <p className="greeting-copy">
          Some things are even better when you hear them.
        </p>
        <GreetingPlayer name="Alvaro" />
        <p className="greeting-footnote">
          Spoken by your browser. Tap play to hear it.
        </p>
      </section>
    </main>
  );
}
