"use client"

import { useEffect, useState } from "react"
import { ModNavigation } from "@/components/layout/ModNavigation"
import RequireAuth from "@/components/common/RequireAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

const SETTINGS_KEY = "hikari-mod-settings"

const loadSettings = () => {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}")
  } catch {
    return {}
  }
}

const saveSettings = (value) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(value))
}

export default function ModSettingsPage() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [confirmRemovals, setConfirmRemovals] = useState(true)
  const [escalateOnRepeat, setEscalateOnRepeat] = useState(false)

  useEffect(() => {
    const stored = loadSettings()
    setAutoRefresh(stored.autoRefresh ?? true)
    setConfirmRemovals(stored.confirmRemovals ?? true)
    setEscalateOnRepeat(stored.escalateOnRepeat ?? false)
  }, [])

  useEffect(() => {
    saveSettings({ autoRefresh, confirmRemovals, escalateOnRepeat })
  }, [autoRefresh, confirmRemovals, escalateOnRepeat])

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <ModNavigation />
        <main className="pb-24 md:pb-8">
          <div className="px-4 py-6 md:px-8">
            <div className="mx-auto max-w-4xl space-y-6">
              <Card className="bg-card/60 border-border/50">
                <CardHeader>
                  <CardTitle className="text-2xl">Moderation Settings</CardTitle>
                  <p className="text-sm text-muted-foreground">Customize how the mod tools behave.</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                    <div>
                      <Label className="text-base">Auto-refresh queue</Label>
                      <p className="text-sm text-muted-foreground">
                        Keep the queue synced with new reports automatically.
                      </p>
                    </div>
                    <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                    <div>
                      <Label className="text-base">Confirm removals</Label>
                      <p className="text-sm text-muted-foreground">
                        Require confirmation before queue removals.
                      </p>
                    </div>
                    <Switch checked={confirmRemovals} onCheckedChange={setConfirmRemovals} />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                    <div>
                      <Label className="text-base">Escalate repeat offenders</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically escalate content reported multiple times.
                      </p>
                    </div>
                    <Switch checked={escalateOnRepeat} onCheckedChange={setEscalateOnRepeat} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}
