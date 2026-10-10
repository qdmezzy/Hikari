import {ImageResponse} from "next/og"
import {createClient} from "@supabase/supabase-js"
export const alt="A Hikari collection"
export const size={width:1200,height:630}
export const contentType="image/png"
export const dynamic="force-dynamic"

export default async function CollectionImage({params}:{params:Promise<{id:string}>}){
 const {id}=await params
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
 if(!url||!key)return new Response("Unavailable",{status:503})
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:collection,error}=await db.from("custom_lists").select("id,name,description,user_id,is_public,cover_media_id").eq("id",id).eq("is_public",true).maybeSingle()
 if(error||!collection)return new Response("Collection unavailable",{status:404,headers:{"Cache-Control":"no-store"}})
 const [items,creator]=await Promise.all([
  db.from("custom_list_items").select("media_id").eq("list_id",id).order("position",{nullsFirst:false}).order("added_at",{ascending:false}).limit(5),
  db.from("public_profiles").select("handle,display_name").eq("user_id",collection.user_id).eq("public_profile",true).maybeSingle(),
 ])
 let ids=(items.data||[]).map(item=>Number(item.media_id))
 if(collection.cover_media_id){
  const {data:cover}=await db.from("custom_list_items").select("media_id").eq("list_id",id).eq("media_id",collection.cover_media_id).maybeSingle()
  if(cover)ids=[Number(cover.media_id),...ids.filter(value=>value!==Number(cover.media_id))].slice(0,5)
 }
 let posters:string[]=[]
 if(ids.length)try{
  const response=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:"query($ids:[Int]){Page(perPage:5){media(id_in:$ids,isAdult:false){id coverImage{large}}}}",variables:{ids}}),signal:AbortSignal.timeout(6000)})
  const data=await response.json();const media=new Map<number,string>((data?.data?.Page?.media||[]).map((item:any)=>[Number(item.id),String(item.coverImage?.large||"")]))
  posters=ids.map(id=>media.get(id)||"").filter(value=>{try{const link=new URL(value);return link.protocol==="https:"&&link.hostname==="s4.anilist.co"}catch{return false}})
 }catch{/* Typography-only cover is still useful when artwork is unavailable. */}
 return new ImageResponse(<div style={{display:"flex",width:"100%",height:"100%",background:"#e8e3d5",color:"#202820",padding:52,flexDirection:"column",justifyContent:"space-between"}}>
  <div style={{display:"flex",justifyContent:"space-between",fontSize:18,letterSpacing:3}}><span>HIKARI / PERSONAL SHELVES</span><span>OPEN SHELF</span></div>
  <div style={{display:"flex",gap:35,alignItems:"center"}}><div style={{display:"flex",flexDirection:"column",width:480,gap:20}}><div style={{display:"flex",fontSize:52,lineHeight:1.06}}>{collection.name}</div><div style={{display:"flex",fontSize:19,lineHeight:1.5}}>{(collection.description||"").slice(0,150)}</div><div style={{display:"flex",fontSize:17}}>By {creator.data?.display_name||creator.data?.handle||"a Hikari member"}</div></div><div style={{display:"flex",gap:9,flex:1}}>{posters.slice(0,3).map((src,index)=><img key={src} src={src} width={155} height={230} style={{objectFit:"cover",transform:`rotate(${index%2?3:-3}deg)`}} alt=""/>)}</div></div>
  <div style={{display:"flex",borderTop:"1px solid #889180",paddingTop:20,fontSize:16}}>hikari.raycodes.me/lists/{id}</div>
 </div>,{...size,headers:{"Cache-Control":"no-store"}})
}
