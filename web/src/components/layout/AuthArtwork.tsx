import Image from "next/image"
import Link from "next/link"

const covers = [
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg",
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iwfIsLu.png",
  "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx150672-2WWJVXIAOG11.png",
]

export function AuthArtwork({ steps, currentStep }: { steps?: Array<{ id: number; name: string; description?: string }>; currentStep?: number }) {
  return <aside className="rv-auth-art">
    <Link href="/" className="rv-auth-brand"><Image src="/brand/hikari-wordmark.svg" alt="Hikari home" width={150} height={70} priority /><span>アニメとマンガ</span></Link>
    <div className="rv-auth-posters" aria-hidden="true">{covers.map((src, index) => <div key={src}><Image src={src} alt="" fill sizes="260px" priority={index === 1} /></div>)}</div>
    <div className="rv-auth-caption">
      {steps ? <ol aria-label="Registration progress">{steps.map(step => <li key={step.id} aria-current={currentStep === step.id ? "step" : undefined} data-complete={Boolean(currentStep && currentStep > step.id)}><span>{String(step.id).padStart(2,"0")}</span><div><strong>{step.name}</strong><p>{step.description}</p></div></li>)}</ol> : <><p className="rv-kicker">あなたのアニメ記録</p><h2>Keep your place.</h2><p>Your watches, reads, reviews, and collections.<br />All here when you get back.</p></>}
      <Link href="/">← Back to Hikari</Link>
    </div>
  </aside>
}
