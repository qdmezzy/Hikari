// Provider acceptance is not proof a person saw the notification.
// A partial failure must remain retryable; durable per-endpoint deduplication
// is still required to avoid resending to successful devices on a later run.
export async function deliverEpisodePush(subscriptions, send) {
  let accepted=0, failed=0
  const expired=[]
  for(const subscription of subscriptions){
    try{await send(subscription);accepted++}
    catch(error){if(error?.statusCode===404||error?.statusCode===410)expired.push(subscription.endpoint);else failed++}
  }
  return {accepted,failed,expired,canAdvance:accepted>0&&failed===0}
}
