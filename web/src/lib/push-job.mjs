// Provider acceptance does not prove display/read. A crash before the receipt
// can still duplicate delivery; the browser's stable tag is best-effort.
export async function processPushJob(job, adapter, now = Date.now()) {
  let state = 'pending', code = null
  if (now - Date.parse(job.airing_at) > 86400000 || job.attempts > 6) {
    state = 'dead'; code = 'expired'
  } else {
    try {
      const subscription = await adapter.currentSubscription(job)
      if (!subscription) { state = 'cancelled'; code = 'opt_out' }
      else {
        const minutes = Math.round((Date.parse(job.airing_at) - now) / 60000)
        await adapter.send(subscription, {
          title: job.title,
          body: minutes > 1 ? `Episode ${job.episode} airs in about ${minutes} minutes.`
            : minutes < -5 ? `Episode ${job.episode} has aired.` : `Episode ${job.episode} is airing now!`,
          url: `/media/${job.media_id}`,
          tag: `airing-${job.media_id}-${job.episode}`,
        })
        state = 'sent'
      }
    } catch (error) {
      const status = Number(error?.statusCode)
      code = Number.isInteger(status) && status >= 400 && status <= 599 ? `http_${status}` : 'transport_or_lookup'
      if (status === 404 || status === 410) state = 'cancelled'
      else if (status >= 400 && status < 500 && status !== 408 && status !== 429) state = 'dead'
    }
  }
  await adapter.finish(job, state, code)
  return state
}
