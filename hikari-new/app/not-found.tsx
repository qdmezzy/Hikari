import { AppShell } from "./components/AppShell";

export default function NotFound() { return <AppShell active=""><main className="not-found-page"><span>404</span><h1>This episode went missing.</h1><p>The page may have moved, or the signal never existed.</p><div><a className="signal-action" href="/">Find an anime</a><a className="quiet-action" href="/home">Go home</a></div></main></AppShell>; }
