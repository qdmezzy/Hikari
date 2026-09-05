"use client"

import { useEffect, useRef, type ReactNode } from "react"

/** Content stays readable without JavaScript and with reduced motion enabled. */
export function ScrollReveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!root.current || !window.IntersectionObserver) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.setAttribute("data-revealed", "true")
        observer.unobserve(entry.target)
      })
    }, { threshold: .08 })
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  return <div className="hk-scroll-reveal" ref={root}>{children}</div>
}
