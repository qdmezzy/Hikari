export const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function buildYearbook(history,year,media=new Map()){
 const events=(history||[]).filter(event=>{
  const date=new Date(event.recorded_at)
  return Number.isFinite(date.getTime())&&date.getUTCFullYear()===year
 }).sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at)||Number(a.id)-Number(b.id))
 const titles=new Set(),completed=new Set(),days=new Set(),progress=new Map(),genres=new Map(),months=Array(12).fill(0)
 for(const event of events){
  const id=Number(event.media_id);if(!Number.isSafeInteger(id)||id<1)continue
  titles.add(id);days.add(new Date(event.recorded_at).toISOString().slice(0,10));months[new Date(event.recorded_at).getUTCMonth()]++
  // Adding/importing an existing list is a baseline, not watching its whole history today.
  if(event.action==='updated'){
   if(Number.isFinite(Number(event.old_progress))&&event.old_progress!==null&&Number.isFinite(Number(event.new_progress))&&event.new_progress!==null)
    progress.set(id,(progress.get(id)||0)+Number(event.new_progress)-Number(event.old_progress))
   if(event.new_status==='completed'&&event.old_status!=='completed')completed.add(id)
  }
 }
 let episodes=0,chapters=0,films=0,knownMinutes=0,unknownRuntimeTitles=0,unknownTypeTitles=0
 for(const [id,delta] of progress){
  const amount=Math.max(0,delta),item=media.get(id),entry=events.find(event=>Number(event.media_id)===id)
  if(!amount)continue
  if(entry?.media_type==='MANGA'){chapters+=amount;continue}
  if(!item?.format){unknownTypeTitles++;continue}
  if(item.format==='MOVIE')films+=Math.min(amount,1);else episodes+=amount
  if(Number(item.duration)>0)knownMinutes+=(item.format==='MOVIE'?Math.min(amount,1):amount)*Number(item.duration);else unknownRuntimeTitles++
 }
 for(const id of titles)for(const genre of new Set(media.get(id)?.genres||[]))genres.set(genre,(genres.get(genre)||0)+1)
 const dates=[...days].sort();let streak=0,run=0,previous=null
 for(const day of dates){const date=new Date(day).getTime();run=previous!==null&&date-previous===86400000?run+1:1;streak=Math.max(streak,run);previous=date}
 return {year,eventCount:events.length,titleIds:[...titles],completed:completed.size,activeDays:days.size,streak,episodes,chapters,films,knownMinutes,unknownRuntimeTitles,unknownTypeTitles,months,topGenres:[...genres].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5),firstRecorded:events[0]?.recorded_at||null}
}
