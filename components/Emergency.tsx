"use client";
import {useState} from "react";
export function Emergency({def}:{def:string}){
 const [c,setC]=useState(def);const [r,setR]=useState<any>(undefined);
 async function go(){const j=await(await fetch("/api/emergency?country="+encodeURIComponent(c))).json();setR(j)}
 return <div className="space-y-3"><div className="flex gap-2"><input className="inp" value={c} onChange={e=>setC(e.target.value)} placeholder="Country"/><button className="btn" onClick={go}>Find</button></div>
  {r===undefined&&<div className="card">Enter the country you're visiting.</div>}
  {r===null&&<div className="card">Numbers not in built-in list. Check official government or embassy source.</div>}
  {r&&<div className="grid gap-3 sm:grid-cols-3">{([["Police",r.police],["Ambulance",r.ambulance],["Fire",r.fire]]).map(([k,v])=><a key={k} href={"tel:"+String(v).split(/[ /(]/)[0]} className="card text-center"><div className="text-sm">{k}</div><div className="text-2xl font-extrabold">{v}</div></a>)}{r.note&&<p className="col-span-full text-sm">{r.note}</p>}<p className="col-span-full text-xs text-ink/60">Verify against official sources before travel.</p></div>}</div>}
