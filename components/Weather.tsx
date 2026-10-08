"use client";
import {useState} from "react";import type {Plan} from "@/lib/types";
export function Weather({place,plan,setSevere}:{place:string;plan:Plan|null;setSevere:(s:string[])=>void}){
 const [q,setQ]=useState(place);const [w,setW]=useState<any>(null);const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
 async function go(){setBusy(true);setErr("");try{const r=await fetch("/api/weather?q="+encodeURIComponent(q.split(",")[0]));const j=await r.json();
  if(!r.ok)throw new Error(j.error);setW(j);setSevere(j.days.filter((d:any)=>d.severe.length).map((d:any)=>`${d.date}: ${d.severe.join(", ")}`))}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 return <div className="space-y-3"><div className="flex gap-2"><input className="inp" value={q} onChange={e=>setQ(e.target.value)} placeholder="City"/><button className="btn" onClick={go} disabled={busy||!q}>{busy?"…":"Check"}</button></div>
  {err&&<p role="alert" className="text-alert">{err}</p>}{!w&&!err&&<div className="card">Check the forecast to enable weather alerts.</div>}
  {w&&<><p className="text-sm text-ink/60">Live forecast: {w.place}. {w.note}</p>
   {w.days.map((d:any)=><div key={d.date} className={"card "+(d.severe.length?"border-2 border-alert":"")}>
    <b>{d.date}</b> · {d.min}–{d.max}°C · rain {d.rain} mm · gusts {d.gust} km/h
    {d.severe.length>0&&<p className="font-bold text-alert">⚠ Severe: {d.severe.join(", ")}.</p>}
    {d.bad&&!d.severe.length&&<p className="text-sm">Rain likely. Prefer indoor activities.</p>}</div>)}</>}</div>}
