import { ReactNode } from "react";
import { AppShell, PageHeader } from "./AppShell";

export function InfoPage({ code, title, description, children }: { code: string; title: string; description: string; children: ReactNode }) {
  return <AppShell active=""><main className="inner-page utility-page"><PageHeader code={code} title={title} description={description} /><section className="utility-copy">{children}</section></main></AppShell>;
}
