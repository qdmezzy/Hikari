

const groups = [
  { title: "Find anime", links: [["Discover feed", "/"], ["Search", "/search"], ["Browse all", "/browse"], ["Airing schedule", "/schedule"]] },
  { title: "Hang out", links: [["Community", "/community"], ["Public profiles", "/u/rays"], ["Shared lists", "/lists"], ["Discord Bot", "/discord-bot"], ["Discord Server ↗", "https://discord.com"]] },
  { title: "Hikari", links: [["The Founding 25", "/founding"], ["Browser extension", "/extension"], ["Service status", "/status"], ["Send feedback", "/feedback"]] },
  { title: "Your space", links: [["My library", "/library"], ["Edit profile", "/profile"], ["Import a list", "/import"], ["Settings", "/settings"], ["Log in", "/login"], ["Sign up", "/register"]] },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand"><img src="/brand/hikari-wordmark.svg" alt="Hikari" /><span>アニメをもっと楽しく</span><h2>See you after<br />the credits.</h2><p>Find the next obsession, keep your place,<br />and share the good stuff with friends.</p><div><a href="/register">Join Hikari</a><a href="/">Start scrolling ↓</a></div></div>
        {groups.map((group) => <div className="footer-group" key={group.title}><h2>{group.title}</h2>{group.links.map(([label, href]) => href.startsWith("http") ? <a href={href} target="_blank" rel="noreferrer" key={label}>{label}</a> : <a href={href} key={label}>{label}</a>)}</div>)}
      </div>
      <div className="footer-bottom"><span>Made with care for anime fans everywhere · Hikari 2026</span><nav><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/status">Status</a><a href="/feedback">Feedback</a></nav></div>
    </footer>
  );
}
