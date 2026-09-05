"use client"

import Link from "next/link"
import { ArrowUpRight, Check, Share2, Settings2 } from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import { ScrollReveal } from "@/components/common/ScrollReveal"
import { Button } from "@/components/ui/button"
import { FoundingBadge } from "@/components/founding/FoundingBadge"
import { FoundingName } from "@/components/founding/FoundingName"
import { getMediaHref } from "@/lib/anilist"

const statuses = [
  { key: "watching", label: "In progress", count: "watching" },
  { key: "completed", label: "Completed", count: "completed" },
  { key: "plan_to_watch", label: "Planned", count: "planToWatch" },
  { key: "on_hold", label: "On hold", count: "onHold" },
  { key: "dropped", label: "Dropped", count: "dropped" },
]
function safeWebsite(value: string) {
  try { const url = new URL(value.startsWith("http") ? value : "https://"+value); return ["https:","http:"].includes(url.protocol) ? url.href : null } catch { return null }
}

export function ProfileScreen({ model: m }: { model: any }) {
  const p = m.profile
  const website = p.website ? safeWebsite(p.website) : null
  const stats = [
    ["Episodes tracked", p.stats.totalEpisodes.toLocaleString()], ["Completed titles", p.stats.completed],
    ["Mean score", p.stats.meanScore || "—"], ["Estimated days watched", p.stats.daysWatched],
    ["Current tracking streak", p.stats.currentStreak+" days"], ["Longest tracking streak", p.stats.longestStreak+" days"],
    ["Rewatching", p.stats.rewatches], ["Planned titles", p.stats.planToWatch],
  ]
  return <div className="hikari-revamp hk-profile min-h-screen bg-background"><Navigation/>
    <main>
      <div className="rv-container">
        <div className="hk-profile-dossier">
          <div className="hk-profile-portrait">{p.banner || p.avatar ? <img src={p.banner || p.avatar} alt=""/> : <span lang="ja">光</span>}<div><span lang="ja">私の記録</span><p>HIKARI / @{p.username}</p></div></div>
          <div className="hk-profile-dossier-info"><div className="hk-profile-dossier-name"><div className="hk-profile-dossier-avatar">{p.avatar ? <img src={p.avatar} alt=""/>:<span>{p.name.slice(0,1)}</span>}</div><div><span className="hk-page-jp" lang="ja">プロフィール</span><h1><FoundingName handle={p.username} memberNumber={m.foundingNumber} showBadge={false}>{p.name}</FoundingName></h1><p>@{p.username}{p.isPremium?" · Premium":""}</p></div>{m.foundingNumber?<FoundingBadge memberNumber={m.foundingNumber}/>:null}</div>
            {p.bio ? <p className="hk-profile-bio">{p.bio}</p>:<Link href="/settings?section=profile" className="hk-profile-add-bio">Add a little about yourself ↗</Link>}
            <div className="hk-profile-meta">{p.location?<span>{p.location}</span>:null}{p.joinedDate?<span>Joined {p.joinedDate}</span>:null}{website?<a href={website} target="_blank" rel="noopener noreferrer">Website ↗</a>:null}</div>
            <div className="hk-profile-dossier-actions"><Button asChild variant="outline"><Link href="/settings?section=profile"><Settings2 size={15}/>Edit profile</Link></Button><Button variant="ghost" disabled={m.syncing || !m.sharingReady} onClick={m.onPublicView}>Public view <ArrowUpRight size={14}/></Button><Button variant="ghost" onClick={m.onShare} disabled={m.syncing} aria-label={m.copied?"Profile link copied":"Copy public profile link"}>{m.copied?<Check size={15}/>:<Share2 size={15}/>}</Button></div>
            <div className="hk-profile-level"><span>Level {p.level}<small>{p.xp.toLocaleString()} / {p.xpToNext.toLocaleString()} XP</small></span><div role="progressbar" aria-label="Level progress" aria-valuemin={0} aria-valuemax={p.xpToNext || 1000} aria-valuenow={Math.min(p.xp,p.xpToNext || 1000)}><i style={{width:Math.min(100,Math.max(0,m.xpPercentage))+"%"}}/></div></div>
          </div>
        </div>
        <nav className="hk-personal-tabs" aria-label="Profile sections">{[["overview","Overview"],["lists","Library"],["stats","Statistics"]].map(([id,label])=><button type="button" key={id} aria-pressed={m.activeTab===id} onClick={()=>m.setActiveTab(id)}>{label}</button>)}</nav>
        <ScrollReveal key={m.activeTab}>
          {m.activeTab==="overview" ? <div className="hk-profile-overview"><div>
            <section className="hk-profile-section"><header><div><span className="hk-page-jp" lang="ja">好きな作品</span><h2>Favorite titles</h2></div><Link href="/favorites">All favorites <ArrowUpRight size={14}/></Link></header>{m.favoritesLoading ? <p role="status">Loading favorites…</p> : !p.favorites.length ? <p className="hk-personal-muted">Favorite a title on its anime or manga page to feature it here.</p> : <div className="hk-profile-favorites">{p.favorites.map((title:any)=><Link href={getMediaHref(title.id,title.title)} key={title.id}><img src={title.image || "/placeholder.svg"} alt="" loading="lazy"/><h3>{title.title}</h3>{title.score ? <small>Your score · {title.score}</small>:null}</Link>)}</div>}</section>
            <section className="hk-profile-section"><header><div><span className="hk-page-jp" lang="ja">最近の記録</span><h2>Recent activity</h2></div><Link href="/history">History <ArrowUpRight size={14}/></Link></header>{m.entriesLoading ? <p role="status">Loading activity…</p> : !p.recentActivity.length ? <p className="hk-personal-muted">Your latest tracked titles will appear here.</p> : <div>{p.recentActivity.map((entry:any)=><Link className="hk-profile-activity" href={getMediaHref(entry.id,entry.anime)} key={entry.id}><img src={entry.image || "/placeholder.svg"} alt="" loading="lazy"/><div><h3>{entry.anime}</h3><p>{entry.status.replaceAll("_"," ")} · {entry.manga ? "Chapter" : "Episode"} {entry.episode}</p></div><small>{entry.time}</small></Link>)}</div>}</section>
          </div><aside><section className="hk-profile-section"><header><h2>Your library</h2><Link href="/lists"><ArrowUpRight size={16}/><span className="sr-only">Open My List</span></Link></header><dl className="hk-profile-counts">{statuses.map(status=><div key={status.key}><dt>{status.label}</dt><dd>{m.entriesLoading ? "—" : p.stats[status.count]}</dd></div>)}</dl></section><section className="hk-profile-section"><header><h2>Most tracked genres</h2></header>{m.topGenres.map((genre:any)=><div className="hk-genre-bar" key={genre.name}><span>{genre.name}<small>{genre.count}</small></span><div><i style={{width:(genre.count / Math.max(1,m.topGenres[0]?.count))*100+"%"}}/></div></div>)}{!m.topGenres.length ? <p className="hk-personal-muted">Add titles to see your genre mix.</p>:null}</section></aside></div> : null}
          {m.activeTab==="lists" ? <div className="hk-profile-library"><section className="hk-profile-section"><header><h2>Watch & read lists</h2><Link href="/lists">Manage <ArrowUpRight size={14}/></Link></header>{statuses.map(status=><Link className="hk-profile-list-link" key={status.key} href={"/lists?status="+status.key}><span>{status.label}</span><strong>{m.entriesLoading ? "—" : p.stats[status.count]}</strong><ArrowUpRight size={17}/></Link>)}</section><section className="hk-profile-section"><header><div><span className="hk-page-jp" lang="ja">コレクション</span><h2>Collections</h2></div><Link href="/lists?view=collections">Manage <ArrowUpRight size={14}/></Link></header>{m.customLists.length ? m.customLists.map((list:any)=><Link className="hk-profile-list-link" href={"/lists/"+list.id} key={list.id}><span>{list.name}</span><ArrowUpRight size={17}/></Link>):<p className="hk-personal-muted">Create a collection in My List to organize titles your way.</p>}</section></div>:null}
          {m.activeTab==="stats" ? <div className="hk-profile-statistics"><span className="hk-page-jp" lang="ja">これまでの記録</span><h2>Your viewing record</h2><dl className="hk-profile-stat-grid">{stats.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{m.entriesLoading ? "—" : value}</dd></div>)}</dl><p className="hk-personal-muted">Viewing time estimates use 24 minutes per episode. Streaks reflect the tracking dates available in your library.</p><section className="hk-profile-section"><header><h2>Milestones</h2></header><div className="hk-profile-milestones">{p.achievements.map((item:any)=><div key={item.name} data-unlocked={item.unlocked}><item.icon size={20}/><div><h3>{item.name}</h3><p>{item.desc}</p></div><small>{item.unlocked ? "Reached" : "In progress"}</small></div>)}</div></section>{m.showWrapped ? <Button asChild variant="outline"><Link href="/wrapped">Your year in anime · Moderator preview <ArrowUpRight size={15}/></Link></Button>:null}</div>:null}
        </ScrollReveal>
      </div>
    </main>
  </div>
}
