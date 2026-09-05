export const FEATURED_ROTATION_MS = 8000

export function getFeaturedRotationDelay({ itemCount, paused, focused, reducedMotion }) {
  return itemCount > 1 && !paused && !focused && !reducedMotion ? FEATURED_ROTATION_MS : null
}
