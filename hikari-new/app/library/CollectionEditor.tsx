"use client";

import { FormEvent, useState } from "react";
import { Icon, Modal } from "../components/Studio";
import { anime } from "../lib/data";
import { Collection } from "../lib/preview-state";

export function CollectionEditor({ collection, close, save }: { collection?: Collection; close: () => void; save: (value: Collection) => boolean }) {
  const [name, setName] = useState(collection?.name ?? "");
  const [note, setNote] = useState(collection?.note ?? "");
  const [ids, setIds] = useState(collection?.ids ?? []);
  const [visibility, setVisibility] = useState<Collection["visibility"]>(collection?.visibility ?? "Private");
  const [color, setColor] = useState(collection?.color ?? "violet");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const results = anime.filter((a) => !ids.includes(a.id) && a.title.toLowerCase().includes(query.toLowerCase()));
  function reorder(index: number, direction: number) { setIds((old) => { const next = [...old]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; }); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError("Give your collection a name."); return; }
    const slug = collection?.slug ?? `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "collection"}-${crypto.randomUUID().slice(0, 8)}`;
    if (save({ slug, name: name.trim(), note: note.trim(), ids, visibility, color })) close(); else setError("Couldn’t save your collection. Please try again.");
  }
  return <Modal wide title={collection ? "Edit collection" : "New collection"} close={close}><form onSubmit={submit}>
    <div className="collection-editor-body"><div className="collection-editor-meta"><label>Name<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Anime I’d lend a friend" autoFocus /></label><label>Description <small>optional</small><textarea maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What brings these stories together?" /></label><div className="form-two"><label>Visibility<select value={visibility} onChange={(e) => setVisibility(e.target.value as Collection["visibility"])}><option>Private</option><option>Public</option></select></label><fieldset className="collection-colors"><legend>Cover color</legend>{["violet", "orange", "green", "blue"].map((item) => <button key={item} type="button" className={`swatch-${item} ${color === item ? "selected" : ""}`} aria-label={`${item} cover`} aria-pressed={color === item} onClick={() => setColor(item)}>{color === item && <Icon name="check" size={14} />}</button>)}</fieldset></div><p className="editor-hint">This is a local draft. Visibility is a design preference; nothing is published.</p></div>
    <div className="collection-editor-titles"><h3>Build your collection <small>{ids.length} titles</small></h3>{ids.length > 0 && <ol className="selected-picks">{ids.map((id, index) => { const item = anime.find((a) => a.id === id)!; return <li key={id}><span className="pick-order">{index + 1}</span><img src={item.cover} alt="" /><strong>{item.title}</strong><div><button className="icon-button" type="button" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Move ${item.title} up`}>↑</button><button className="icon-button" type="button" disabled={index === ids.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move ${item.title} down`}>↓</button><button className="icon-button" type="button" onClick={() => setIds(ids.filter((v) => v !== id))} aria-label={`Remove ${item.title}`}><Icon name="close" size={16} /></button></div></li>; })}</ol>}<label className="studio-search"><Icon name="search" /><input aria-label="Find titles to add" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a title to add…" /></label><div className="collection-picker">{results.map((item) => <button type="button" key={item.id} onClick={() => setIds([...ids, item.id])}><img src={item.cover} alt="" /><span>{item.title}<small>{item.year} · {item.genres[0]}</small></span><Icon name="plus" size={18} /></button>)}{results.length === 0 && <p>{ids.length === anime.length ? "All catalog titles have been added." : "No matching titles in the preview catalog."}</p>}</div></div></div>
    {error && <p className="studio-error">{error}</p>}<footer className="dialog-actions"><button className="studio-button ghost" type="button" onClick={close}>Cancel</button><button className="studio-button primary">{collection ? "Save changes" : "Create collection"}</button></footer>
  </form></Modal>;
}
