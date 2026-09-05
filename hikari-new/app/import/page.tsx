"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "../components/AppShell";

const sources = [
  { id: "anilist", mark: "A", name: "AniList", description: "Import with a public username or JSON export.", file: ".json" },
  { id: "mal", mark: "M", name: "MyAnimeList", description: "Connect your account or use a MAL XML export.", file: ".xml" },
  { id: "kitsu", mark: "K", name: "Kitsu", description: "Bring over a Kitsu JSON export.", file: ".json" },
];

type Stage = "source" | "review" | "importing" | "done";

export default function ImportPage() {
  const [source, setSource] = useState("anilist");
  const [username, setUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("source");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const selected = useMemo(() => sources.find((item) => item.id === source) ?? sources[0], [source]);
  const estimate = file ? Math.max(24, Math.min(684, Math.round(file.size / 92))) : 238;

  useEffect(() => {
    if (stage !== "importing") return;
    const timer = window.setInterval(() => setProgress((value) => {
      const next = Math.min(100, value + 8);
      if (next === 100) { window.clearInterval(timer); window.setTimeout(() => setStage("done"), 350); }
      return next;
    }), 130);
    return () => window.clearInterval(timer);
  }, [stage]);

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    setFile(nextFile);
    setError("");
  }

  function review() {
    if (source === "anilist" && !username.trim() && !file) { setError("Enter an AniList username or choose an export file."); return; }
    if (source !== "anilist" && !file) { setError(`Choose a ${selected.file} export from ${selected.name}.`); return; }
    setError("");
    setStage("review");
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); chooseFile(event.dataTransfer.files?.[0]); }
  function onFile(event: ChangeEvent<HTMLInputElement>) { chooseFile(event.target.files?.[0]); }

  return <AppShell active="">
    <main className="inner-page import-page">
      <PageHeader code="Import" title="Bring your history with you." description="Move lists from AniList, MyAnimeList, or Kitsu without overwriting better Hikari data." action={<a className="quiet-action" href="/settings">Back to settings</a>} />
      <div className="import-steps" aria-label="Import progress"><span className={stage !== "source" ? "done" : "active"}>1 <b>Source</b></span><i /><span className={stage === "review" ? "active" : stage === "importing" || stage === "done" ? "done" : ""}>2 <b>Review</b></span><i /><span className={stage === "importing" ? "active" : stage === "done" ? "done" : ""}>3 <b>Import</b></span></div>

      {stage === "source" && <section className="import-workspace">
        <div className="import-source-grid">{sources.map((item) => <button key={item.id} className={source === item.id ? "active" : ""} onClick={() => { setSource(item.id); setFile(null); setError(""); }}><span>{item.mark}</span><strong>{item.name}</strong><p>{item.description}</p><i>{source === item.id ? "Selected ✓" : "Choose"}</i></button>)}</div>
        <div className="import-method">
          <div><span className="eyebrow">Import from {selected.name}</span><h2>{source === "anilist" ? "Username or export file" : `${selected.name} export file`}</h2><p>Existing Hikari status and scores win. Import only fills gaps and advances episode progress.</p></div>
          {source === "anilist" && <label className="import-username">AniList username<div><span>@</span><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="your-anilist-name" /></div></label>}
          {source === "anilist" && <div className="import-or"><span>or</span></div>}
          <label className={file ? "drop-zone has-file" : "drop-zone"} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><input type="file" accept=".xml,.json,application/json,text/xml" onChange={onFile} /><span>{file ? "✓" : "⇧"}</span><strong>{file ? file.name : `Drop a ${selected.file} export here`}</strong><small>{file ? `${Math.ceil(file.size / 1024)} KB · ready to review` : "or click to choose a file"}</small></label>
          {error && <p className="import-error">{error}</p>}
          <button className="signal-action import-next" onClick={review}>Review import →</button>
        </div>
      </section>}

      {stage === "review" && <section className="import-review">
        <div><span className="eyebrow">Ready to merge</span><h2>{estimate} entries found.</h2><p>Here is what Hikari will do before anything changes.</p></div>
        <div className="merge-rules"><article><span>01</span><div><strong>Keep your Hikari status</strong><p>Watching, completed, scores, and dates already on Hikari will not be downgraded.</p></div></article><article><span>02</span><div><strong>Advance episode progress</strong><p>Imported progress applies only when it is further ahead.</p></div></article><article><span>03</span><div><strong>Add missing titles</strong><p>Anything new lands in the closest matching library section.</p></div></article></div>
        <div className="import-review-actions"><button className="quiet-action" onClick={() => setStage("source")}>← Change source</button><button className="signal-action" onClick={() => { setProgress(0); setStage("importing"); }}>Import {estimate} entries</button></div>
      </section>}

      {stage === "importing" && <section className="import-running"><span className="import-spinner">光</span><h2>Moving your history…</h2><p>{progress < 40 ? "Matching titles" : progress < 78 ? "Merging progress and scores" : "Finishing your library"}</p><div><i><b style={{ width: `${progress}%` }} /></i><span>{progress}%</span></div><small>Keep this page open. Nothing is deleted from the source service.</small></section>}

      {stage === "done" && <section className="import-done"><span>✓</span><h2>Your history made it.</h2><p>{estimate - 7} titles added · 7 existing titles updated · 0 Hikari scores overwritten</p><div><a className="signal-action" href="/library">See your library</a><button className="quiet-action" onClick={() => { setStage("source"); setFile(null); setUsername(""); }}>Import another list</button></div></section>}
    </main>
  </AppShell>;
}
