"use client";

import { FormEvent, useState } from "react";

import { anime } from "../lib/data";

type AuthMode = "login" | "register" | "forgot" | "reset";

const copy = {
  login: {
    eyebrow: "WELCOME BACK",
    title: "Your next episode is waiting.",
    note: "Pick up your list, your progress, and the people you follow without hunting for any of it.",
  },
  register: {
    eyebrow: "MAKE A HIKARI",
    title: "Start with the stories you love.",
    note: "A small setup now gives you a home that feels like yours—not another feed to manage.",
  },
  forgot: {
    eyebrow: "ACCOUNT RECOVERY",
    title: "Let’s get you back in.",
    note: "Tell us which email you used and we’ll send a private recovery link.",
  },
  reset: {
    eyebrow: "NEW PASSWORD",
    title: "Give your account a new key.",
    note: "Choose something new, then head straight back to your library.",
  },
};

function ProviderButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button className="auth-provider" type="button" onClick={onClick}>{children}</button>;
}

export function AuthExperience({ mode }: { mode: AuthMode }) {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const details = copy[mode];
  const isRegister = mode === "register";

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRegister && step < 3) setStep((value) => value + 1);
    else setDone(true);
  }

  function toggleAnime(id: number) {
    setSelected((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  }

  return <div className="auth-experience">
    <header className="auth-top">
      <a href="/" aria-label="Hikari home"><img src="/brand/hikari-wordmark.svg" alt="Hikari" /></a>
      <div>{mode === "login" ? <><span>New to Hikari?</span><a href="/register">Create an account</a></> : <><span>Already keeping a list?</span><a href="/login">Log in</a></>}</div>
    </header>

    <aside className="auth-anime-panel" aria-label="A glimpse of a Hikari library">
      <img className="auth-anime-bg" src={anime[3].banner} alt="" />
      <div className="auth-anime-shade" />
      <div className="auth-anime-copy">
        <span className="scribble-note">Your shelf remembers ↘</span>
        <p>FROM YOUR LIBRARY</p>
        <h2>ONE PIECE</h2>
        <div><span>Adventure</span><span>Found family</span><span>EP 1146</span></div>
        <blockquote>“The show I always come home to.” <b>— rays</b></blockquote>
      </div>
      <div className="auth-poster-strip">{anime.slice(0, 4).map((item, index) => <img key={item.id} className={index === 3 ? "active" : ""} src={item.cover} alt="" />)}</div>
    </aside>

    <main className="auth-flow">
      <div className="auth-flow-inner">
        {isRegister && !done && <div className="auth-stepper"><span>{String(step).padStart(2, "0")} / 03</span><i><b style={{ width: `${step / 3 * 100}%` }} /></i><small>{step === 1 ? "You" : step === 2 ? "Secure it" : "Your taste"}</small></div>}
        <span className="eyebrow">{details.eyebrow}</span>
        <h1>{details.title}</h1>
        <p>{details.note}</p>

        {done ? <section className="auth-success">
          <span>光</span>
          <h2>{isRegister ? "Your Hikari is ready." : mode === "login" ? "Good to see you, rays." : "Check your inbox."}</h2>
          <p>{isRegister ? `${selected.size || 3} taste signals saved. We’ll use them to give your first Discover session some shape.` : mode === "login" ? "Your list and current progress are right where you left them." : "If that address belongs to a Hikari account, a recovery link is on its way."}</p>
          <a className="signal-action" href={isRegister ? "/onboarding" : mode === "login" ? "/home" : "/login"}>{isRegister ? "Finish a quick setup →" : mode === "login" ? "Go to your space →" : "Back to log in →"}</a>
        </section> : <form className="auth-form" onSubmit={next}>
          {mode === "login" && <>
            <div className="auth-provider-row">
              <ProviderButton onClick={() => setDone(true)}><b>G</b><span>Continue with Google</span></ProviderButton>
              <ProviderButton onClick={() => setDone(true)}><b>☁</b><span>Discord</span></ProviderButton>
            </div>
            <div className="auth-divider"><span>or use your email</span></div>
            <label>Email<input required type="email" autoComplete="email" placeholder="you@example.com" /></label>
            <label>Password<div className="password-label"><a href="/forgot-password">Forgot password?</a></div><input required type="password" autoComplete="current-password" minLength={6} placeholder="Your password" /></label>
            <label className="auth-check"><input type="checkbox" /><span>Keep me signed in on this device.</span></label>
            <button className="auth-primary" type="submit">Log in to Hikari <span>→</span></button>
            <p className="auth-legal">By continuing, you agree to the <a href="/terms">community rules</a> and <a href="/privacy">privacy policy</a>.</p>
          </>}

          {mode === "register" && step === 1 && <>
            <div className="auth-provider-row">
              <ProviderButton onClick={() => setDone(true)}><b>G</b><span>Use Google</span></ProviderButton>
              <ProviderButton onClick={() => setDone(true)}><b>☁</b><span>Use Discord</span></ProviderButton>
            </div>
            <div className="auth-divider"><span>or make one with email</span></div>
            <div className="field-pair"><label>Display name<input required autoComplete="name" placeholder="What should we call you?" /></label><label>Hikari handle<div className="handle-input"><span>@</span><input required autoComplete="username" placeholder="yourname" /></div></label></div>
            <label>Email<input required type="email" autoComplete="email" placeholder="you@example.com" /></label>
            <button className="auth-primary" type="submit">Continue <span>→</span></button>
          </>}

          {mode === "register" && step === 2 && <>
            <div className="auth-form-heading"><strong>Keep it yours.</strong><span>Use at least 8 characters. We’ll never ask you for it in a message.</span></div>
            <label>Password<input required type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" /></label>
            <label>Confirm password<input required type="password" autoComplete="new-password" minLength={8} placeholder="Type it once more" /></label>
            <label className="auth-check"><input required type="checkbox" /><span>I’m at least 13 and I agree to the <a href="/terms">community rules</a>.</span></label>
            <div className="auth-step-actions"><button type="button" onClick={() => setStep(1)}>← Back</button><button className="auth-primary" type="submit">Continue <span>→</span></button></div>
          </>}

          {mode === "register" && step === 3 && <>
            <div className="taste-intro"><strong>Choose three stories.</strong><span>This is the only homework.</span></div>
            <div className="taste-grid">{anime.map((item) => <button type="button" key={item.id} className={selected.has(item.id) ? "selected" : ""} onClick={() => toggleAnime(item.id)}><img src={item.cover} alt="" /><span>{selected.has(item.id) ? "✓" : "+"}</span><strong>{item.title}</strong></button>)}</div>
            <div className="auth-step-actions"><button type="button" onClick={() => setStep(2)}>← Back</button><button className="auth-primary" type="submit" disabled={selected.size < 3}>Create my Hikari <span>→</span></button></div>
          </>}

          {mode === "forgot" && <><label>Account email<input required type="email" autoComplete="email" placeholder="you@example.com" /></label><button className="auth-primary" type="submit">Send recovery link <span>→</span></button><a className="auth-back-link" href="/login">← Back to log in</a></>}
          {mode === "reset" && <><label>New password<input required type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" /></label><label>Confirm it<input required type="password" autoComplete="new-password" minLength={8} placeholder="Type it once more" /></label><button className="auth-primary" type="submit">Update password <span>→</span></button></>}
        </form>}
      </div>
    </main>
  </div>;
}
