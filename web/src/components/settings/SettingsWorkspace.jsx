"use client"

import Link from "next/link"
import { useId } from "react"
import { ArrowUpRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AccountCredentials } from "./AccountCredentials"

function Field({label, hint, value, onChange, options, type="text", multiline=false, maxLength}) {
  const id = useId()
  return <div className="hk-setting-field"><label htmlFor={id}>{label}</label><div>{options ? <Select value={String(value ?? "")} onValueChange={onChange}><SelectTrigger id={id} className="hk-setting-select focus:ring-0"><SelectValue /></SelectTrigger><SelectContent className="hk-setting-select-content">{options.map(([v,l]) => <SelectItem key={v} value={String(v)}>{l}</SelectItem>)}</SelectContent></Select> : multiline ? <textarea id={id} rows={3} value={value} maxLength={maxLength} onChange={e => onChange(e.target.value)} /> : <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} />}{hint ? <p>{hint}</p> : null}</div></div>
}
function Setting({label, hint, checked, onChange}) {
  const id=useId()
  return <div className="hk-setting-toggle"><div><label htmlFor={id}>{label}</label>{hint ? <p>{hint}</p> : null}</div><Switch id={id} checked={checked} onCheckedChange={onChange} /></div>
}
function Group({title, note, children}) {
  return <section className="hk-settings-group"><header><h2>{title}</h2>{note ? <p>{note}</p> : null}</header><div>{children}</div></section>
}
const audience=[['everyone','Everyone'],['followers','Followers only'],['nobody','Nobody']]
const languages=[['en','English'],['es','Spanish'],['fr','French'],['ja','Japanese']]
const privacyFields=[['publicProfile','Public profile','Allow others to visit your profile.'],['showActivity','Recent activity','Show your watch and reading updates.'],['showStats','Statistics','Show totals and rating statistics.'],['showFavorites','Favorites','Include favorite titles on your profile.'],['showScores','Ratings','Show the scores you give titles.']]
const visibilityFields=[['showWatching','In progress'],['showCompleted','Completed'],['showPlanned','Planned'],['showOnHold','On hold'],['showDropped','Dropped']]
const alertRows=[['New episodes','emailNewEpisode','pushNewEpisode'],['Friend activity','emailFriendActivity','pushFriendActivity'],['Comments','emailComments','pushComments'],['Messages','emailMessages','pushMessages'],['Weekly digest','emailWeeklyDigest',null],['Recommendations','emailRecommendations',null],['Announcements','emailAnnouncements',null],['Before an episode airs',null,'pushAiring']]

export function SettingsWorkspace({model:m}) {
  const {activeSection,profile,privacy,notifications,display,listSettings,content}=m
  const profileField=(key,label,props={}) => <Field key={key} label={label} value={profile[key]} onChange={value => m.updateProfileState({[key]:value})} {...props} />
  const displayField=(key,label,options) => <Field label={label} value={display[key]} options={options} onChange={value => m.updateDisplayState({[key]:value})} />
  const listField=(key,label,options) => <Field label={label} value={listSettings[key]} options={options} onChange={value => m.updateListSettingsState({[key]:value})} />

  if(activeSection==='profile') return <>
    <Group title="Your profile" note="This is how other people see you.">
      <div className="hk-profile-editor">
        <div className="hk-profile-editor-cover">{profile.bannerImage ? <img src={profile.bannerImage} alt="Profile cover" /> : <span>No cover image</span>}<button type="button" onClick={m.handleBannerPrompt}>Change cover</button></div>
        <div className="hk-profile-editor-identity">{m.avatarUrl ? <img src={m.avatarUrl} alt="Your avatar" /> : <span>{(profile.displayName || 'H').charAt(0)}</span>}<div><strong>{profile.displayName || 'Your name'}</strong><p>@{profile.username || 'username'}</p></div><Button variant="outline" size="sm" onClick={() => m.fileInputRef.current?.click()} disabled={m.avatarUploading}>{m.avatarUploading ? 'Uploading…' : 'Edit photo'}</Button></div>
        <input ref={m.fileInputRef} type="file" accept="image/*" className="hidden" onChange={m.handleAvatarSelected} />
        {m.avatarUrl ? <button className="hk-settings-textlink" type="button" disabled={m.avatarUploading} onClick={m.handleRemoveAvatar}>Remove photo</button> : null}
        {m.avatarError ? <p role="alert" className="text-destructive">{m.avatarError}</p> : null}
      </div>
      {profileField('displayName','Display name')}
      {profileField('username','Username',{hint:'Your public address: /u/'+(profile.username || 'username')})}
      {profileField('bio','Bio',{multiline:true,maxLength:240,hint:profile.bio.length+' / 240'})}
    </Group>
    <Group title="About you" note="Optional details for your public profile.">
      {profileField('location','Location')}{profileField('website','Website',{type:'url'})}{profileField('birthday','Birthday',{type:'date'})}
      <Link className="hk-settings-textlink" href={`/u/${encodeURIComponent(m.user?.user_metadata?.username || m.user?.user_metadata?.handle || profile.username || 'user')}`}>View public profile <ArrowUpRight size={14}/></Link>
    </Group>
  </>

  if(activeSection==='privacy') return <>
    <Group title="On your profile" note="Choose what is visible to other people.">{privacyFields.map(([key,label,hint]) => <Setting key={key} label={label} hint={hint} checked={privacy[key]} onChange={value => m.updatePrivacyState({[key]:value})}/>)}</Group>
    <Group title="Visible lists" note="Your private collections keep their own visibility settings.">{visibilityFields.map(([key,label]) => <Setting key={key} label={label} checked={privacy[key]} onChange={value => m.updatePrivacyState({[key]:value})}/>)}</Group>
    <Group title="Your presence">
      {[['showOnline','Show online status'],['showLastSeen','Show last seen'],['hideFromSearch','Hide profile from search']].map(([key,label]) => <Setting key={key} label={label} checked={privacy[key]} onChange={value => m.updatePrivacyState({[key]:value})}/>)}
      <Field label="Messages from" value={privacy.allowMessages} options={audience} onChange={value => m.updatePrivacyState({allowMessages:value})}/><Field label="Comments from" value={privacy.allowComments} options={audience} onChange={value => m.updatePrivacyState({allowComments:value})}/>
    </Group>
    <Group title="Muted people" note="Unmuting takes effect immediately.">{m.mutedLoading ? <p role="status">Loading…</p> : m.mutedUsers.length ? m.mutedUsers.map(person => <div className="hk-settings-linkrow" key={person.userId}><div><strong>{person.displayName}</strong><p>{person.handle}</p></div><Button variant="outline" onClick={() => m.handleUnmuteUser(person.userId)}>Unmute</Button></div>) : <p className="hk-settings-note">You haven't muted anyone.</p>}{m.mutedError ? <p role="alert">{m.mutedError}</p> : null}</Group>
  </>

  if(activeSection==='notifications') return <>
    <Group title="Delivery" note="Choose how Hikari can reach you."><Setting label="Email" checked={notifications.emailEnabled} onChange={value => m.updateNotificationState({emailEnabled:value})}/><Setting label="Push notifications" hint="Browser permission is also required." checked={notifications.pushEnabled} onChange={value => m.updateNotificationState({pushEnabled:value})}/></Group>
    <Group title="What reaches you" note="Set each type of update independently."><table className="hk-notification-matrix"><thead><tr><th scope="col">Update</th><th scope="col">Email</th><th scope="col">Push</th></tr></thead><tbody>{alertRows.map(([label,email,push]) => <tr key={label}><th scope="row">{label}</th>{[email,push].map((key,index) => <td key={index}>{key ? <input type="checkbox" aria-label={`${label}: ${index===0?'email':'push'}`} checked={notifications[key]} onChange={e => m.updateNotificationState({[key]:e.target.checked})}/> : <span aria-label="Not available">—</span>}</td>)}</tr>)}</tbody></table></Group>
    <Group title="Quiet hours" note="Pause push alerts during these hours."><Setting label="Enable quiet hours" checked={notifications.quietHoursEnabled} onChange={value => m.updateNotificationState({quietHoursEnabled:value})}/><Field label="From" type="time" value={notifications.quietHoursStart} onChange={value => m.updateNotificationState({quietHoursStart:value})}/><Field label="Until" type="time" value={notifications.quietHoursEnd} onChange={value => m.updateNotificationState({quietHoursEnd:value})}/></Group>
  </>

  if(activeSection==='display') return <>
    <Group title="Appearance" note="A comfortable place to keep your library."><div className="hk-theme-options">{['light','dark','system'].map(value => <button key={value} type="button" aria-pressed={display.theme===value} onClick={() => m.updateDisplayState({theme:value})}><span className={`hk-theme-preview hk-theme-${value}`}><i/><b/><b/><b/></span><span>{value}<Check size={13}/></span></button>)}</div><p className="hk-settings-note">Applied when you save your changes.</p><div className="hk-accent-options" aria-label="Accent color">{m.accentColors.map(color => <button key={color.id} type="button" aria-pressed={display.accentColor===color.id} aria-label={color.id+' accent'} onClick={() => m.updateDisplayState({accentColor:color.id})}><span className={color.className}/>{color.id}</button>)}</div></Group>
    <Group title="Reading & display">{displayField('language','Language',languages)}{displayField('titleLanguage','Title language',[['romaji','Romaji'],['english','English'],['native','Native']])}{displayField('scoreFormat','Rating scale',[['10point','10 points'],['100point','100 points'],['5star','5 stars']])}{displayField('defaultListView','Library layout',[['grid','Grid'],['list','List'],['compact','Compact']])}<Field label="Cards per row" value={display.cardsPerRow} options={[3,4,5,6,7,8].map(n=>[n,String(n)])} onChange={value => m.updateDisplayState({cardsPerRow:Number(value)})}/></Group>
    <Group title="Motion & accessibility">{[['reduceMotion','Reduce motion'],['highContrast','High contrast'],['showTrailers','Show trailers'],['autoplayTrailers','Autoplay muted trailers']].map(([key,label]) => <Setting key={key} label={label} checked={display[key]} onChange={value => m.updateDisplayState({[key]:value})}/>)}</Group>
  </>

  if(activeSection==='lists') return <>
    <Group title="Tracking defaults">{listField('defaultStatus','New title status',[['watching','In progress'],['plan_to_watch','Planned'],['completed','Completed']])}{listField('sortBy','Sort by',[['last-updated','Last updated'],['title','Title'],['score','Rating'],['progress','Progress']])}{listField('sortDirection','Order',[['desc','Descending'],['asc','Ascending']])}{[['confirmStatusChange','Confirm status changes'],['autoAddToList','Add titles when you start them'],['showProgressBar','Show progress bars'],['showAiringCountdown','Show airing countdowns']].map(([key,label]) => <Setting key={key} label={label} checked={listSettings[key]} onChange={value=>m.updateListSettingsState({[key]:value})}/>)}</Group>
    <Group title="Your collections" note="Curated separately from your tracking status.">{m.customLists.length ? m.customLists.map(list => <Link className="hk-settings-linkrow" href={`/lists/${list.id}`} key={list.id}><strong>{list.name}</strong><ArrowUpRight size={16}/></Link>) : <p className="hk-settings-note">No collections yet.</p>}<Link className="hk-settings-textlink" href="/lists?view=collections">Manage collections <ArrowUpRight size={14}/></Link></Group>
  </>

  if(activeSection==='content') return <Group title="Content controls" note="Choose what you want to see."><Setting label="Include adult titles" hint="Allow 18+ titles in supported search and recommendation views." checked={content.adultContent} onChange={value=>m.updateContentState({adultContent:value})}/><Setting label="Blur sensitive artwork" checked={content.blurNSFW} onChange={value=>m.updateContentState({blurNSFW:value})}/><Field label="Spoilers" value={content.showSpoilers} options={['hide','blur','show'].map(value=>[value,value[0].toUpperCase()+value.slice(1)])} onChange={value=>m.updateContentState({showSpoilers:value})}/></Group>

  if(activeSection==='import-export') return <>
    <Group title="Bring your library" note="Import titles and progress from another service.">{[['mal','MyAnimeList'],['anilist','AniList'],['kitsu','Kitsu']].map(([id,label])=><Link className="hk-settings-linkrow" key={id} href={`/import?source=${id}`}><strong>{label}</strong><ArrowUpRight size={17}/></Link>)}<Link href="/import" className="hk-settings-textlink">Open import center <ArrowUpRight size={14}/></Link></Group>
    <Group title="Take a copy" note="This download contains preferences, not your anime library."><div className="hk-settings-linkrow"><div><strong>Settings backup</strong><p>Profile and preferences · JSON</p></div><Button variant="outline" onClick={m.handleExportSettings}>Download</Button></div><Link href="/lists" className="hk-settings-textlink">Open your full library <ArrowUpRight size={14}/></Link></Group>
  </>

  return <>
    <Group title="Sign-in details" note="Keep your account accessible."><div className="hk-settings-linkrow"><div><strong>Account email</strong><p>{m.user?.email || 'No email on file'}</p></div></div><AccountCredentials currentEmail={m.user?.email}/></Group>
    <Group title="Connected accounts" note="Manage alternative ways to sign in.">{m.providerOptions.map(provider => {const connected=m.linkedProviders.has(provider.id);return <div className="hk-settings-linkrow" key={provider.id}><div><strong>{provider.label}</strong><p>{connected?'Connected':'Not connected'}</p></div><Button variant="outline" disabled={m.connectionPending===provider.id} onClick={()=>connected?m.handleDisconnectProvider(provider.id):m.handleConnectProvider(provider.id)}>{m.connectionPending===provider.id?'Working…':connected?'Disconnect':'Connect'}</Button></div>})}{m.connectionError?<p role="alert" className="text-destructive">{m.connectionError}</p>:null}{m.connectionMessage?<p role="status">{m.connectionMessage}</p>:null}</Group>
    <Group title="Account actions"><div className="hk-settings-linkrow"><div><strong>Sign out</strong><p>End your session on this browser.</p></div><Button variant="outline" onClick={m.logout}>Sign out</Button></div><div className="hk-settings-linkrow"><div><strong>Delete account</strong><p>Permanently removes your profile, lists, reviews, and posts.</p></div><Button variant="outline" className="text-destructive" onClick={m.onDeleteAccount}>Delete…</Button></div></Group>
  </>
}
