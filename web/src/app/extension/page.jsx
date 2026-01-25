"use client"

import { Navigation } from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Chrome, Sparkles } from "lucide-react"

export default function ExtensionPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="pt-24 pb-24 md:pb-8">
        <section className="relative px-4 md:px-8 pb-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />

          <div className="relative mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <Badge className="mb-4 px-4 py-1.5 bg-primary/10 text-primary border-primary/20 text-sm">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Browser Extension
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                Track Anime <span className="text-gradient">Everywhere</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                The ultimate browser companion for anime fans. Auto-track, get notified, and never miss an episode again.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="gap-3 h-14 px-8 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 rounded-2xl"
                  onClick={() => {
                    const section = document.getElementById("install-extension")
                    section?.scrollIntoView({ behavior: "smooth" })
                  }}
                >
                  <Chrome className="h-6 w-6" />
                  Install Extension
                  <Badge className="ml-1 bg-white/20 text-white text-xs">Free</Badge>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="install-extension" className="px-4 md:px-8 py-16">
          <div className="mx-auto max-w-3xl">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center">
                    <Chrome className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Install from this repo</h2>
                    <p className="text-sm text-muted-foreground">Load the unpacked extension while we prep store builds.</p>
                  </div>
                </div>

                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">1.</span> In a terminal, run{" "}
                    <span className="text-foreground">`npm install`</span> inside{" "}
                    <span className="text-foreground">`Hikari Extension`</span>.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">2.</span> Build the extension with{" "}
                    <span className="text-foreground">`npm run build:win`</span>.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">3.</span> Open Chrome &gt; Extensions &gt; Enable
                    Developer mode &gt; Load unpacked &gt; select{" "}
                    <span className="text-foreground">`Hikari Extension/dist/webextension`</span>.
                  </li>
                </ol>

                <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4">
                  <p className="text-sm text-muted-foreground">
                    Supports auto-tracking, spoiler shield, and quick list updates on enabled sites.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
