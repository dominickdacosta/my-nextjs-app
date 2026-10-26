"use client";

import { useEffect, useState } from "react";

export default function GreetingPlayer({ name }: { name: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);

    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  function playGreeting() {
    if (!supported) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const greeting = new SpeechSynthesisUtterance(`Hi ${name}!`);
    greeting.lang = "en-US";
    greeting.onend = () => setSpeaking(false);
    greeting.onerror = () => setSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(greeting);
    setSpeaking(true);
  }

  return (
    <div className="audio-player">
      <button
        className="play-button"
        type="button"
        onClick={playGreeting}
        disabled={!supported}
        aria-label={speaking ? "Stop greeting audio" : "Play greeting audio"}
      >
        <span aria-hidden="true">{speaking ? "■" : "▶"}</span>
      </button>
      <div className="audio-details">
        <span className="audio-title">
          {speaking ? "Now playing" : "A spoken greeting"}
        </span>
        <span className="audio-subtitle">
          {supported
            ? `Hi ${name}!`
            : "Speech audio isn't supported in this browser."}
        </span>
      </div>
      <div className={`audio-wave${speaking ? " is-playing" : ""}`} aria-hidden="true">
        {[12, 22, 15, 28, 18, 25, 11, 20, 14, 24, 13, 19].map((height, index) => (
          <span key={index} style={{ height }} />
        ))}
      </div>
    </div>
  );
}
