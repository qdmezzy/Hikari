"use client";

import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { anime } from "../lib/data";

export default function WrappedPage() {
  const [year, setYear] = useState(2026);
  return <AppShell active=""><main className="wrapped-page"><header><span className="eyebrow">RAYS’ YEAR IN ANIME</span><h1>{year} looked like this.</h1><p>More adventures, longer nights, and one absolutely unreasonable pirate streak.</p><div><button className={year === 2026 ? "active" : ""} onClick={() => setYear(2026)}>2026</button><button className={year === 2025 ? "active" : ""} onClick={() => setYear(2025)}>2025</button></div></header><section className="wrapped-grid"><article className="wrapped-big"><img src={anime[3].banner} alt="" /><div><span>THE BIG ONE</span><h2>{anime[3].title}</h2><p>216 episodes this year. You spent more time with the Straw Hats than anyone else.</p></div></article><article className="wrapped-stat banana"><strong>{year === 2026 ? "66.4" : "49.2"}</strong><span>days watched</span></article><article className="wrapped-stat"><strong>{year === 2026 ? "148" : "112"}</strong><span>anime completed</span></article><article className="wrapped-stat"><strong>17</strong><span>day best streak</span></article><article className="wrapped-mood"><span>YOUR MOOD</span><h2>Adventure with feelings.</h2><div><i style={{ height: "82%" }} /><i style={{ height: "64%" }} /><i style={{ height: "41%" }} /></div><p>Adventure · Fantasy · Drama</p></article></section></main></AppShell>;
}
