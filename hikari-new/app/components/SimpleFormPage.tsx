"use client";

import { FormEvent, useState } from "react";
import { AppShell, PageHeader } from "./AppShell";

type Mode = "login" | "register" | "forgot" | "reset" | "feedback";
const content = {
  login: { code: "Welcome back", title: "Pick up where you left off.", description: "Your list, streak, and people are waiting.", submit: "Log in" },
  register: { code: "Join Hikari", title: "Make anime more social.", description: "Track what you watch and trade better recommendations.", submit: "Create account" },
  forgot: { code: "Account recovery", title: "Let’s get you back in.", description: "Enter your email and we’ll prepare a secure reset link.", submit: "Send reset link" },
  reset: { code: "New password", title: "Choose something memorable.", description: "Your new password needs at least six characters.", submit: "Update password" },
  feedback: { code: "Talk to us", title: "What should feel better?", description: "Good, bad, oddly specific—we read every note.", submit: "Send feedback" },
};

export function SimpleFormPage({ mode }: { mode: Mode }) {
  const [sent, setSent] = useState(false);
  const copy = content[mode];
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSent(true); }
  return <AppShell active=""><main className="inner-page utility-page"><PageHeader code={copy.code} title={copy.title} description={copy.description} /><form className="simple-form" onSubmit={submit}>
    {sent ? <div className="form-success"><span>✓</span><strong>{mode === "feedback" ? "Got it. Thanks for being honest." : "You’re all set for this preview."}</strong><a href={mode === "feedback" ? "/home" : "/library"}>Continue →</a></div> : <>
      {mode === "register" && <label>Display name<input required placeholder="What should people call you?" /></label>}
      {(mode === "login" || mode === "register" || mode === "forgot") && <label>Email<input required type="email" placeholder="you@example.com" /></label>}
      {(mode === "login" || mode === "register" || mode === "reset") && <label>{mode === "reset" ? "New password" : "Password"}<input required type="password" minLength={6} placeholder="At least 6 characters" /></label>}
      {mode === "feedback" && <><label>What part of Hikari?<select defaultValue="Product"><option>Product</option><option>Discover</option><option>Community</option><option>Tracking</option></select></label><label>Tell us everything<textarea required placeholder="The specific thing that felt off was…" /></label></>}
      <button className="signal-action" type="submit">{copy.submit}</button>
      {mode === "login" && <div className="form-links"><a href="/forgot-password">Forgot password?</a><a href="/register">Create an account</a></div>}
      {mode === "register" && <div className="form-links"><span>Already have an account?</span><a href="/login">Log in</a></div>}
    </>}
  </form></main></AppShell>;
}
