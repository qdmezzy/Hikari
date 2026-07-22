"use client"

import { useCallback, useEffect, useState } from "react"
import { foundingFetch } from "@/lib/founding-api"

export const useFoundingMe = (user) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(user))
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    if (!user) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const response = await foundingFetch("/api/founding/me")
      const body = await response.json().catch(() => ({}))
      if (!response.ok && response.status !== 401) throw new Error(body?.error || "Membership unavailable.")
      setData(body)
    } catch (requestError) {
      setError(requestError?.message || "Membership unavailable.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
