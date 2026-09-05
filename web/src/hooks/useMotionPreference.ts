"use client"

import { useEffect, useState } from "react"
import { useReducedMotion } from "framer-motion"

/** Honor both the operating system and Hikari's own accessibility setting. */
export function useMotionPreference() {
  const systemReduced = useReducedMotion()
  const [appReduced, setAppReduced] = useState(false)
  useEffect(() => {
    const read = () => setAppReduced(document.documentElement.classList.contains("reduce-motion"))
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return Boolean(systemReduced || appReduced)
}
