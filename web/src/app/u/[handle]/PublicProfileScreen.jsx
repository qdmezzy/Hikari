"use client"

import Link from "next/link"
import { ArrowUpRight, Share2 } from "lucide-react"
import { Navigation } from "@/components/layout/Navigation"
import { Button } from "@/components/ui/button"
import { FoundingBadge } from "@/components/founding/FoundingBadge"
import { FoundingName } from "@/components/founding/FoundingName"
import { getMediaHref, getMediaTitle } from "@/lib/anilist"
import { toast } from "sonner"
import "./public-profile.css"

const statuses = [
  { id: "watching", label: "In progress", stat: "watching" },
  { id: "completed", label: "Completed", stat: "completed" },
  { id: "planned", label: "Planned", stat: "planToWatch" },
  { id: "onhold", label: "On hold", stat: "onHold" },
  { id: "dropped", label: "Dropped", stat: "dropped" },
]

export function PublicProfileScreen({ userData, authUser, canFollow, followBusy, isFollowing, onFollow, activeTab, setActiveTab, MediaListView }) {
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Profile link copied")
    } catch {
      toast.error("Could not copy the profile link")
    }
  }
  const website = (() => {
    try {
      if (!userData.website) return null
      const url = new URL(userData.website.startsWith("http") ? userData.website : `https://${userData.website}`)
      return ["https:", "http:"].includes(url.protocol) ? url.href : null
    } catch { return null }
  })()

  return <div className="hikari-revamp hk-profile hk-public-profile min-h-screen bg-background">
    <Navigation />
    <main><div className="rv-container">
      <div className="hk-profile-dossier">
        <div className="hk-profile-portrait">
          {userData.banner || userData.avatar ? <img src={userData.banner || userData.avatar} alt="" /> : <span lang="ja">光</span>}
          <div><span lang="ja">みんなの記録</span><p>HIKARI / @{userData.username}</p></div>
        </div>
        <div className="hk-profile-dossier-info">
          <div className="hk-profile-dossier-name">
            <div className="hk-profile-dossier-avatar">{userData.avatar ? <img src={userData.avatar} alt="" /> : <span>{userData.name.slice(0, 1)}</span>}</div>
            <div><span className="hk-page-jp" lang="ja">プロフィール</span><h1><FoundingName handle={userData.username} memberNumber={userData.foundingMemberNumber} showBadge={false}>{userData.name}</FoundingName></h1><p>@{userData.username}</p></div>
            {userData.foundingMemberNumber ? <FoundingBadge memberNumber={userData.foundingMemberNumber} /> : null}
          </div>
          {userData.bio ? <p className="hk-profile-bio">{userData.bio}</p> : null}
          <div className="hk-profile-meta">{userData.location ? <span>{userData.location}</span> : null}{userData.joinedDate ? <span>Joined {userData.joinedDate}</span> : null}{website ? <a href={website} target="_blank" rel="noopener noreferrer">Website ↗</a> : null}</div>
          <div className="hk-profile-dossier-actions">
            {canFollow ? <Button variant="outline" onClick={onFollow} disabled={followBusy}>{isFollowing ? "Following" : "Follow"}</Button> : null}
            {authUser?.id === userData.userId ? <Button variant="ghost" asChild><Link href="/profile">My profile <ArrowUpRight size={14} /></Link></Button> : null}
            <Button variant="ghost" onClick={share}><Share2 size={15} /> Share profile</Button>
          </div>
          {userData.privacy.showStats ? <div className="hk-public-record"><span>{userData.stats.totalTitles} titles tracked</span><span>{userData.stats.completed} completed</span><span>{userData.stats.meanScore || "—"} mean score</span></div> : null}
        </div>
      </div>

      <nav className="hk-personal-tabs" aria-label="Public profile sections">
        {[["overview", "Overview"], ["library", "Library"], ["stats", "Statistics"]].map(([id, label]) => <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}>{label}</button>)}
      </nav>

      {activeTab === "overview" ? <div className="hk-profile-overview"><div>
        {userData.privacy.showFavorites ? <section className="hk-profile-section"><header><div><span className="hk-page-jp" lang="ja">好きな作品</span><h2>Favorite titles</h2></div></header>
          {userData.favorites.length ? <div className="hk-profile-favorites">{userData.favorites.map((item) => <Link href={getMediaHref(item.media)} key={item.id}><img src={item.media?.coverImage?.large || item.media?.coverImage?.extraLarge || "/placeholder.svg"} alt="" loading="lazy" /><h3>{getMediaTitle(item.media)}</h3></Link>)}</div> : <p className="hk-personal-muted">No favorite titles shared yet.</p>}
        </section> : null}
        {userData.privacy.showActivity ? <section className="hk-profile-section"><header><div><span className="hk-page-jp" lang="ja">最近の記録</span><h2>Recent activity</h2></div></header>
          {userData.recentActivity.length ? userData.recentActivity.map((item) => <Link className="hk-profile-activity" href={item.href} key={item.id}><img src={item.image || "/placeholder.svg"} alt="" loading="lazy" /><div><h3>{item.anime}</h3><p>{item.action}</p></div><small>{item.time}</small></Link>) : <p className="hk-personal-muted">No recent updates shared yet.</p>}
        </section> : null}
      </div><aside>
        {userData.privacy.showStats ? <section className="hk-profile-section"><header><h2>Your library</h2></header><dl className="hk-profile-counts">{statuses.map((status) => <div key={status.id}><dt>{status.label}</dt><dd>{userData.stats[status.stat]}</dd></div>)}</dl></section> : null}
        {!userData.privacy.showFavorites && !userData.privacy.showActivity && !userData.privacy.showStats ? <p className="hk-personal-muted">This member hasn’t shared any profile sections.</p> : null}
      </aside></div> : null}

      {activeTab === "library" ? <div className="hk-public-library">
        {userData.privacy.showActivity ? statuses.map((status) => userData.lists[status.id]?.length ? <section className="hk-profile-section" key={status.id}><header><h2>{status.label}</h2></header><MediaListView listType={status.id} items={userData.lists[status.id]} /></section> : null) : <p className="hk-personal-muted">This member keeps their watch and reading lists private.</p>}
        {userData.privacy.showActivity && statuses.every((status) => !userData.lists[status.id]?.length) ? <p className="hk-personal-muted">No titles shared yet.</p> : null}
      </div> : null}

      {activeTab === "stats" ? <div className="hk-profile-statistics"><span className="hk-page-jp" lang="ja">これまでの記録</span><h2>Viewing record</h2>
        {userData.privacy.showStats ? <dl className="hk-profile-stat-grid">{[["Titles tracked", userData.stats.totalTitles], ["Completed titles", userData.stats.completed], ["Episodes tracked", userData.stats.totalEpisodes], ["Mean score", userData.stats.meanScore || "—"], ["Estimated days watched", userData.stats.daysWatched], ["Current tracking streak", `${userData.stats.currentStreak} days`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="hk-personal-muted">This member keeps their statistics private.</p>}
      </div> : null}
    </div></main>
  </div>
}
