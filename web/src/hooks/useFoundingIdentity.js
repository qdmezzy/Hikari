"use client"

import { useEffect, useState } from "react"
import { normalizeFoundingHandle } from "@/lib/founding-domain.mjs"

const identityCache = new Map()
const pending = new Map()

const loadIdentity = async (handle) => {
  if (identityCache.has(handle)) return identityCache.get(handle)
  if (pending.has(handle)) return pending.get(handle)
  const request = fetch(`/api/founding/identities?handles=${encodeURIComponent(handle)}`, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : { identities: {} }))
    .then((body) => body?.identities?.[handle] || null)
    .catch(() => null)
    .then((identity) => {
      identityCache.set(handle, identity)
      pending.delete(handle)
      return identity
    })
  pending.set(handle, request)
  return request
}

export const useFoundingIdentity = (rawHandle, initialMemberNumber = null) => {
  const handle = normalizeFoundingHandle(rawHandle)
  const initial = Number.isInteger(Number(initialMemberNumber)) ? Number(initialMemberNumber) : null
  const [identity, setIdentity] = useState({ handle, memberNumber: initial })

  useEffect(() => {
    if (initial) {
      setIdentity({ handle, memberNumber: initial })
      return
    }
    if (!handle) {
      setIdentity({ handle: "", memberNumber: null })
      return
    }
    let cancelled = false
    void loadIdentity(handle).then((identity) => {
      if (!cancelled) setIdentity({ handle, memberNumber: identity?.memberNumber || null })
    })
    return () => {
      cancelled = true
    }
  }, [handle, initial])

  return identity.handle === handle ? identity.memberNumber : initial
}
