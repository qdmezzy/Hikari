"use client";

import { ReactNode, useState } from "react";

import { SiteFooter } from "./SiteFooter";

const nav = [
  { label: "Home", href: "/home" },
  { label: "Discover", href: "/" },
  { label: "Browse", href: "/browse" },
  { label: "Library", href: "/library" },
  { label: "Schedule", href: "/schedule" },
  { label: "Community", href: "/community" },
];

export function AppShell({ active, children, search, onSearch, showFooter = true }: { active: string; children: ReactNode; search?: string; onSearch?: (value: string) => void; showFooter?: boolean }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className={`app-frame ${active === "Discover" ? "" : "studio-frame"}`}>
      <header className="topline">
        <a className="wordmark" href="/" aria-label="Hikari"><img src="/brand/hikari-wordmark.svg" alt="Hikari" /></a>
        <nav className="main-nav" aria-label="Primary navigation">
          {nav.map((item) => <a key={item.label} className={item.label === active ? "active" : ""} aria-current={item.label === active ? "page" : undefined} href={item.href}>{item.label === "Library" ? "My list" : item.label}</a>)}
        </nav>
        <div className="nav-right">
          {!onSearch && <a className="studio-search-link" href="/browse" aria-label="Search anime"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg></a>}
          {onSearch ? (
            <label className="nav-search">
              <span>⌕</span><input value={search ?? ""} onChange={(event) => onSearch(event.target.value)} placeholder="Search titles" aria-label="Search Hikari" />
            </label>
          ) : null}
          <div className="notification-wrap"><button className="notification-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Open notifications" aria-expanded={notificationsOpen}>◔<i>3</i></button>{notificationsOpen && <div className="notification-menu"><header><strong>Notifications</strong><button onClick={() => setNotificationsOpen(false)}>Close</button></header><a href="/anime/21"><b>New episode</b><span>ONE PIECE episode 1147 is airing.</span><small>9 min ago</small></a><a href="/community"><b>@maya replied</b><span>“Okay, you were right about Jaadugar.”</span><small>1h ago</small></a><a href="/lists/rainy-night-anime"><b>List saved</b><span>Ren saved Rainy night anime.</span><small>Yesterday</small></a></div>}</div>
          <div className="account-menu-wrap">
            <button className="avatar" onClick={() => setAccountOpen((open) => !open)} aria-label="Open profile menu" aria-expanded={accountOpen}>R</button>
            {accountOpen && <div className="account-menu"><div><strong>rays</strong><span>@rays · 12 watching</span></div><a href="/home">Your space</a><a href="/profile">Edit profile</a><a href="/settings">Account & settings</a><a href="/import">Import & history</a><a href="/favorites">Saved from Discover</a><a className="account-menu-signout" href="/login">Sign out</a></div>}
          </div>
        </div>
      </header>
      <div className="site-area">
        {active !== "Discover" && <div className="studio-preview-label">Design preview <span>Sample account · changes stay on this device</span></div>}
        {children}
      </div>
      {showFooter && <SiteFooter />}
    </div>
  );
}

export function PageHeader({ code, title, description, action }: { code: string; title: string; description: string; action?: ReactNode }) {
  const eyebrow = code.replace("HKR / ", "").replace(/\s*\/\s*\d+$/, "");

  return (
    <header className="page-header">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </header>
  );
}
