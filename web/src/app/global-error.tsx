"use client"

// Top-level fallback for errors in the root layout itself.
// Must render its own <html>/<body> and avoid app CSS dependencies.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e131c",
          color: "#e6ebf2",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#9aa6b8", margin: "0 0 24px", lineHeight: 1.6 }}>
            Hikari hit an unexpected error. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#171a40",
              background: "linear-gradient(90deg, #faf0c7, #f3d36b)",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
