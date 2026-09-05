"use client";

import { useState } from "react";

import { anime } from "../lib/data";

const steps = ["Bring your history", "Choose your social level", "Set your rhythm"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [visibility, setVisibility] = useState("Public");
  const [reminders, setReminders] = useState(true);
  return <main className="onboarding-experience">
    <header><a href="/"><img src="/brand/hikari-wordmark.svg" alt="Hikari" /></a><button onClick={() => setStep(steps.length)}>Skip setup</button></header>
    <img className="onboarding-art" src={anime[0].banner} alt="" /><div className="onboarding-shade" />
    <section className="onboarding-card">
      {step < steps.length && <><div className="onboarding-progress"><span>{String(step + 1).padStart(2, "0")} / 03</span><i><b style={{ width: `${(step + 1) / 3 * 100}%` }} /></i></div><span className="eyebrow">A two-minute setup</span><h1>{steps[step]}</h1></>}
      {step === 0 && <><p>Starting fresh is fine. If your history lives somewhere else, bring it over without replacing better Hikari data.</p><div className="onboard-choices import-choices"><a href="/import"><b>A</b><strong>AniList</strong><span>Username or JSON</span></a><a href="/import"><b>M</b><strong>MyAnimeList</strong><span>Connect or XML</span></a><button onClick={() => setStep(1)}><b>→</b><strong>Start fresh</strong><span>I’ll build it here</span></button></div><div className="onboard-actions"><span /><button className="auth-primary" onClick={() => setStep(1)}>Continue without import →</button></div></>}
      {step === 1 && <><p>This controls your default profile. Every individual list can still be public, followers-only, or private.</p><div className="onboard-choices visibility-choices">{["Public", "People I follow", "Private"].map((item) => <button key={item} className={visibility === item ? "active" : ""} onClick={() => setVisibility(item)}><b>{item === "Public" ? "◎" : item === "Private" ? "◉" : "◌"}</b><strong>{item}</strong><span>{item === "Public" ? "Anyone can see your watch activity" : item === "Private" ? "Only you see your library" : "Your circle sees your updates"}</span></button>)}</div><div className="onboard-actions"><button onClick={() => setStep(0)}>← Back</button><button className="auth-primary" onClick={() => setStep(2)}>Next →</button></div></>}
      {step === 2 && <><p>Hikari can remind you when episodes air. No marketing pile-up and quiet hours stay on by default.</p><button className={reminders ? "reminder-choice active" : "reminder-choice"} onClick={() => setReminders((value) => !value)}><span>◷</span><div><strong>Episode release reminders</strong><small>Watching list only · quiet from 11 PM to 8 AM</small></div><i>{reminders ? "ON" : "OFF"}</i></button><div className="onboard-actions"><button onClick={() => setStep(1)}>← Back</button><button className="auth-primary" onClick={() => setStep(3)}>Finish setup →</button></div></>}
      {step >= steps.length && <div className="onboard-done"><span>光</span><h1>You’re ready, rays.</h1><p>Discover has your taste, your profile is {visibility.toLowerCase()}, and reminders are {reminders ? "on" : "off"}.</p><a className="auth-primary" href="/home">Go home →</a></div>}
    </section>
  </main>;
}
