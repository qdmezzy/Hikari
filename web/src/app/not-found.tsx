import Link from "next/link"
import { Compass, Home, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 size-[55%] rounded-full bg-gradient-to-br from-primary/15 to-transparent blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 size-[55%] rounded-full bg-gradient-to-tl from-accent/15 to-transparent blur-3xl" />
      </div>

      <div className="relative">
        <p className="bg-gradient-to-r from-primary to-accent bg-clip-text text-7xl font-black tracking-tight text-transparent md:text-8xl">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">This page wandered off</h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved. Let&apos;s get you back to the good stuff.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="gap-2">
            <Link href="/">
              <Home className="size-4" />
              Go home
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/search">
              <Search className="size-4" />
              Browse anime
            </Link>
          </Button>
          <Button asChild variant="ghost" className="gap-2">
            <Link href="/discover">
              <Compass className="size-4" />
              Discover
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
