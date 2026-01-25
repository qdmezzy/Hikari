const POSTS_EVENT = "hikari:social-posts"
const FOLLOW_EVENT = "hikari:social-following"

const emitEvent = (name) => {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(name))
}

export const emitSocialPosts = () => emitEvent(POSTS_EVENT)
export const emitSocialFollowing = () => emitEvent(FOLLOW_EVENT)

export const subscribeSocialPosts = (callback) => {
  if (typeof window === "undefined") return () => {}
  const handler = () => callback()
  window.addEventListener(POSTS_EVENT, handler)
  return () => window.removeEventListener(POSTS_EVENT, handler)
}

export const subscribeSocialFollowing = (callback) => {
  if (typeof window === "undefined") return () => {}
  const handler = () => callback()
  window.addEventListener(FOLLOW_EVENT, handler)
  return () => window.removeEventListener(FOLLOW_EVENT, handler)
}
