import Link from "next/link";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <strong>Hikari</strong>
            <Link href="/">Home</Link>
            <Link href="/search">Search</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
            <Link href="/anime/1">Test Anime</Link>
          </div>
        </nav>

        <div style={{ padding: 16 }}>{children}</div>
      </body>
    </html>
  );
}
