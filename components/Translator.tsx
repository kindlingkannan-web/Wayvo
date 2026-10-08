"use client";
import {useState} from "react";import type {Plan} from "@/lib/types";
const LANGS:[string,string][]=[["English","en-US"],["Hindi","hi-IN"],["Tamil","ta-IN"],["Japanese","ja-JP"],["French","fr-FR"],["Spanish","es-ES"],["German","de-DE"],["Thai","th-TH"],["Italian","it-IT"]];
export function Translator({plan}:{plan:Plan|null}){
 const [mine,setMine]=useState(plan?.language||"English");const [local,setLocal]=useState("Hindi");const [log,setLog]=useState<any[]>([]);const [st,setSt]=useState("");const [err,setErr]=useState("");
 const code=(n:string)=>LANGS.find(l=>l[0]===n)![1];
 function listen(who:"me"|"local"){const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  if(!SR){setErr("Speech recognition isn't supported. Try Chrome or Edge.");return}setErr("");const from=who==="me"?mine:local,to=who==="me"?local:mine;const r=new SR();
  r.lang=code(from);setSt(who==="me"?"You are speaking…":"Local person is speaking…");
  r.onresult=async(e:any)=>{const text=e.results[0][0].transcript;setSt("Translating…");
   try{const res=await fetch("/api/translate",{method:"POST",body:JSON.stringify({text,to})});const j=await res.json();if(!res.ok)throw new Error(j.error);
    setLog(l=>[{who,text,from,to,detected:j.detected,out:j.translation},...l]);const u=new SpeechSynthesisUtterance(j.translation);u.lang=code(to);speechSynthesis.speak(u)}catch(x:any){setErr(x.message)}setSt("")};
  r.onerror=(e:any)=>{setErr("Microphone error: "+e.error);setSt("")};r.start()}
 const Sel=({v,s}:{v:string;s:(x:string)=>void})=><select className="inp" value={v} onChange={e=>s(e.target.value)}>{LANGS.map(l=><option key={l[0]}>{l[0]}</option>)}</select>;
 return <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><label>You speak<Sel v={mine} s={setMine}/></label><label>Local language<Sel v={local} s={setLocal}/></label></div>
  <div className="grid grid-cols-2 gap-3"><button className="btn !py-6" onClick={()=>listen("me")}>🎙 I speak</button><button className="btn !bg-lagoon !py-6" onClick={()=>listen("local")}>🎙 Local speaks</button></div>
  {st&&<p role="status" className="font-medium">{st}</p>}{err&&<p role="alert" className="text-alert">{err}</p>}
  <p className="text-xs text-ink/60">Speech runs in your browser; detected language is identified from the transcript.</p>
  {log.length===0&&<div className="card">Press a microphone to start.</div>}
  {log.map((m,i)=><div key={i} className={"card "+(m.who==="me"?"":"border-l-4 border-lagoon")}><div className="text-xs text-ink/60">{m.who==="me"?"You":"Local"} · detected: {m.detected} · {m.from} → {m.to}</div>
   <div>{m.text}</div><div className="font-bold">{m.out}</div><button className="btn2 mt-1" onClick={()=>{const u=new SpeechSynthesisUtterance(m.out);u.lang=code(m.to);speechSynthesis.speak(u)}}>▶ Play</button></div>)}</div>}
