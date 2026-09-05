import assert from "node:assert/strict"
import test from "node:test"
import { FEATURED_ROTATION_MS, getFeaturedRotationDelay } from "../src/lib/featured-rotation.mjs"

const running = { itemCount: 3, paused: false, focused: false, reducedMotion: false }

test("featured titles rotate automatically every eight seconds", () => {
  assert.equal(getFeaturedRotationDelay(running), 8000)
  assert.equal(getFeaturedRotationDelay(running), FEATURED_ROTATION_MS)
})

test("pointer hover does not stop automatic rotation", () => {
  assert.equal(getFeaturedRotationDelay({ ...running, hovered: true }), 8000)
})

test("keyboard focus, explicit pause, and reduced motion each stop rotation", () => {
  for (const preference of ["paused", "focused", "reducedMotion"]) {
    assert.equal(getFeaturedRotationDelay({ ...running, [preference]: true }), null)
  }
})

test("empty and single-title feeds do not start a rotation timer", () => {
  for (const itemCount of [0, 1]) assert.equal(getFeaturedRotationDelay({ ...running, itemCount }), null)
})
