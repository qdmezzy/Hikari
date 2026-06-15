"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, Home, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 size-[55%] rounded-full bg-gradient-to-br from-destructive/15 to-transparent blur-3xl" />
      </div>

      <div className="relative">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-muted-foreground">
          An unexpected error occurred. You can try again, or head back home.
        </p>
        {error?.digest ? (
          <p className="mt-2 text-xs text-muted-foreground/70">Reference: {error.digest}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} className="gap-2">
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/">
              <Home className="size-4" />
              Go home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
