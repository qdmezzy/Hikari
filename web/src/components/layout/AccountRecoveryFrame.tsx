import Link from "next/link"
import { AuthArtwork } from "./AuthArtwork"
import { ScrollReveal } from "@/components/common/ScrollReveal"
import type { ReactNode } from "react"

export function AccountRecoveryFrame({ children, loginHref }: { children: ReactNode; loginHref: string }) {
  return <div className="hikari-revamp rv-auth min-h-screen"><AuthArtwork/><main className="rv-auth-form hk-recovery"><ScrollReveal><Link href="/" className="hk-recovery-brand"><img src="/brand/hikari-wordmark.svg" alt="Hikari home"/></Link><span className="hk-page-jp" lang="ja">アカウントの復旧</span>{children}<Link href={loginHref} className="hk-recovery-back">← Back to sign in</Link></ScrollReveal></main></div>
}
