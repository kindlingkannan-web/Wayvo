"use client";
import React, { useState, useEffect } from "react";
import type { Plan } from "@/lib/types";
import { MicIcon, SpeakerIcon } from "./Icons";

const LANGUAGE_SPECS: Record<string, { label: string; code: string; localName: string }> = {
  English: { label: "English", code: "en-US", localName: "English" },
  Hindi: { label: "Hindi", code: "hi-IN", localName: "हिन्दी" },
  Tamil: { label: "Tamil", code: "ta-IN", localName: "தமிழ்" },
  Japanese: { label: "Japanese", code: "ja-JP", localName: "日本語" },
  French: { label: "French", code: "fr-FR", localName: "Français" },
  Spanish: { label: "Spanish", code: "es-ES", localName: "Español" },
  German: { label: "German", code: "de-DE", localName: "Deutsch" },
  Thai: { label: "Thai", code: "th-TH", localName: "ไทย" },
  Italian: { label: "Italian", code: "it-IT", localName: "Italiano" },
};

interface MessageEntry {
  id: string;
  who: "user" | "local";
  fromLang: string;
  toLang: string;
  originalText: string;
  translatedText: string;
  detectedLang?: string;
  source?: string;
  timestamp: string;
}

interface VoiceTranslatorProps {
  plan: Plan | null;
}

const QUICK_TEST_PHRASES = [
  "Where is the nearest train station?",
  "How much does this cost?",
  "Is this vegetarian food?",
  "Please call a taxi for me.",
  "Can you help me with directions to the palace?",
];

export function VoiceTranslator({ plan }: VoiceTranslatorProps) {
  const [userLang, setUserLang] = useState<string>(plan?.language || "English");
  const [localLang, setLocalLang] = useState<string>("Hindi");

  // Determine intelligent local language based on destination
  useEffect(() => {
    if (plan?.destination) {
      const d = plan.destination.toLowerCase();
      if (d.includes("japan") || d.includes("tokyo") || d.includes("kyoto")) setLocalLang("Japanese");
      else if (d.includes("france") || d.includes("paris")) setLocalLang("French");
      else if (d.includes("spain") || d.includes("madrid") || d.includes("barcelona")) setLocalLang("Spanish");
      else if (d.includes("germany") || d.includes("berlin") || d.includes("munich")) setLocalLang("German");
      else if (d.includes("italy") || d.includes("rome") || d.includes("venice")) setLocalLang("Italian");
      else if (d.includes("thailand") || d.includes("bangkok") || d.includes("phuket")) setLocalLang("Thai");
      else if (d.includes("tamil") || d.includes("chennai")) setLocalLang("Tamil");
      else setLocalLang("Hindi");
    }
  }, [plan?.destination]);

  const [recordingWho, setRecordingWho] = useState<"user" | "local" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [textInput, setTextInput] = useState("");
  const [textInputWho, setTextInputWho] = useState<"user" | "local">("user");
  const [isTranslating, setIsTranslating] = useState(false);

  const [conversation, setConversation] = useState<MessageEntry[]>([
    {
      id: "init_1",
      who: "user",
      fromLang: "English",
      toLang: "Hindi",
      originalText: "Hello, could you please tell me where the entrance to the museum is?",
      translatedText: "नमस्ते, क्या आप कृपया मुझे बता सकते हैं कि संग्रहालय का प्रवेश द्वार कहाँ है?",
      detectedLang: "English",
      source: "Live HTTP Translation Engine",
      timestamp: "Ready for live audio",
    },
  ]);

  const speakText = (text: string, langName: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const spec = LANGUAGE_SPECS[langName] || { code: "en-US" };
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = spec.code;
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  };

  const processTranslation = async (
    transcript: string,
    who: "user" | "local"
  ) => {
    if (!transcript || !transcript.trim()) return;
    const from = who === "user" ? userLang : localLang;
    const to = who === "user" ? localLang : userLang;

    setIsTranslating(true);
    setStatusMessage(`Translating live into ${to}...`);
    setErrorMessage("");

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript.trim(),
          to,
          from,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Translation API failed");

      const translated = data.translation;
      const detected = data.detected || from;

      const newEntry: MessageEntry = {
        id: "msg_" + Date.now(),
        who,
        fromLang: from,
        toLang: to,
        originalText: transcript.trim(),
        translatedText: translated,
        detectedLang: detected,
        source: data.source || "Live Engine",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setConversation((prev) => [newEntry, ...prev]);
      setStatusMessage("Playing translated audio...");
      speakText(translated, to);
    } catch (err: any) {
      console.error("Translation processing error:", err);
      setErrorMessage(err.message || "Failed to translate. Please retry.");
    } finally {
      setIsTranslating(false);
      setTimeout(() => setStatusMessage(""), 1500);
      setRecordingWho(null);
    }
  };

  const startVoiceInput = (who: "user" | "local") => {
    setErrorMessage("");
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        "Microphone speech recognition is not supported in this browser. Please use Chrome/Edge or use the instant translation bar below."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const fromLang = who === "user" ? userLang : localLang;
      const spec = LANGUAGE_SPECS[fromLang] || { code: "en-US" };
      recognition.lang = spec.code;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setRecordingWho(who);
      setStatusMessage(
        who === "user" ? `Listening to you in ${userLang}...` : `Listening to local speaker in ${localLang}...`
      );

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          processTranslation(transcript, who);
        } else {
          setErrorMessage("No speech detected. Please speak clearly into the microphone.");
          setRecordingWho(null);
          setStatusMessage("");
        }
      };

      recognition.onerror = (event: any) => {
        setErrorMessage(`Microphone notice (${event.error}). You can type below for instant live translation.`);
        setRecordingWho(null);
        setStatusMessage("");
      };

      recognition.onend = () => {
        if (recordingWho === who) {
          setRecordingWho(null);
        }
      };

      recognition.start();
    } catch (e: any) {
      setErrorMessage("Could not start microphone: " + e.message);
      setRecordingWho(null);
      setStatusMessage("");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const text = textInput.trim();
    setTextInput("");
    processTranslation(text, textInputWho);
  };

  return (
    <div className="space-y-5">
      {/* Language Header & Selector */}
      <div className="rounded-3xl bg-white dark:bg-darkcard p-6 shadow-sm ring-1 ring-ink/10 dark:ring-white/10 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink/10 dark:border-white/10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lagoon">
              Real-Time Two-Way Audio
            </span>
            <h2 className="text-xl font-black text-ink dark:text-white">AI Voice &amp; Text Translator</h2>
            <p className="text-xs text-ink/60 dark:text-slate-400 mt-0.5">
              Live HTTP multi-language translation engine with instant Text-to-Speech audio output.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-paper dark:bg-darkpaper px-3 py-1 font-semibold text-lagoon ring-1 ring-lagoon/20">
              ● Live Engine Connected
            </span>
          </div>
        </div>

        {/* Language Selection Bars */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-3.5 space-y-1">
            <label className="text-[11px] font-bold uppercase text-ink/50 dark:text-slate-400 block">
              Your Language
            </label>
            <select
              value={userLang}
              onChange={(e) => setUserLang(e.target.value)}
              className="inp text-xs font-bold"
            >
              {Object.keys(LANGUAGE_SPECS).map((name) => (
                <option key={name} value={name}>
                  {name} ({LANGUAGE_SPECS[name].localName})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-paper dark:bg-darkpaper p-3.5 space-y-1">
            <label className="text-[11px] font-bold uppercase text-ink/50 dark:text-slate-400 block">
              Local Language
            </label>
            <select
              value={localLang}
              onChange={(e) => setLocalLang(e.target.value)}
              className="inp text-xs font-bold"
            >
              {Object.keys(LANGUAGE_SPECS).map((name) => (
                <option key={name} value={name}>
                  {name} ({LANGUAGE_SPECS[name].localName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* BIG TWO-WAY AUDIO MICROPHONE BUTTONS */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* USER -> LOCAL BUTTON */}
          <button
            type="button"
            onClick={() => startVoiceInput("user")}
            disabled={recordingWho !== null || isTranslating}
            className={`group relative flex flex-col items-center justify-center rounded-3xl p-6 text-white shadow-lg transition transform active:scale-95 ${
              recordingWho === "user"
                ? "bg-red-500 animate-pulse ring-4 ring-red-300"
                : "bg-ink hover:bg-ink/90 dark:bg-slate-800 dark:hover:bg-slate-700"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 group-hover:scale-110 transition">
              <MicIcon className="w-8 h-8 text-white" />
            </div>
            <span className="mt-3 text-base font-black">
              {recordingWho === "user" ? "Listening to You..." : "I Speak (Traveler)"}
            </span>
            <span className="text-xs text-white/70">
              Speaks in {userLang} ➔ Plays in {localLang}
            </span>
          </button>

          {/* LOCAL -> USER BUTTON */}
          <button
            type="button"
            onClick={() => startVoiceInput("local")}
            disabled={recordingWho !== null || isTranslating}
            className={`group relative flex flex-col items-center justify-center rounded-3xl p-6 text-white shadow-lg transition transform active:scale-95 ${
              recordingWho === "local"
                ? "bg-red-500 animate-pulse ring-4 ring-red-300"
                : "bg-lagoon hover:bg-lagoon/90"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 group-hover:scale-110 transition">
              <MicIcon className="w-8 h-8 text-white" />
            </div>
            <span className="mt-3 text-base font-black">
              {recordingWho === "local" ? "Listening to Local..." : "Local Person Speaks"}
            </span>
            <span className="text-xs text-white/70">
              Speaks in {localLang} ➔ Plays in {userLang}
            </span>
          </button>
        </div>

        {/* Real-time Status or Error Banner */}
        {statusMessage && (
          <div className="mt-4 rounded-2xl bg-lagoon/15 p-3 text-xs font-bold text-lagoon text-center animate-pulse">
            🎙️ {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-2xl bg-alert/15 p-3 text-xs font-bold text-alert text-center">
            ℹ️ {errorMessage}
          </div>
        )}

        {/* Quick Test Phrases */}
        <div className="mt-5 pt-4 border-t border-ink/10 dark:border-white/10">
          <div className="text-[11px] font-bold uppercase text-ink/50 dark:text-slate-400 mb-2">
            Quick 1-Tap Test Phrases (Instant Live Translation &amp; Speech):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TEST_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => processTranslation(phrase, "user")}
                className="rounded-xl bg-paper dark:bg-darkpaper px-3 py-1.5 text-xs font-medium text-ink/80 dark:text-slate-200 hover:bg-lagoon/15 hover:text-lagoon transition ring-1 ring-ink/5 dark:ring-white/5"
              >
                "{phrase}"
              </button>
            ))}
          </div>
        </div>

        {/* Live Text Translation Form */}
        <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
          <select
            value={textInputWho}
            onChange={(e) => setTextInputWho(e.target.value as any)}
            className="rounded-2xl border border-ink/20 dark:border-white/20 bg-paper dark:bg-darkpaper px-3 py-2 text-xs font-bold text-ink dark:text-white"
          >
            <option value="user">You ({userLang})</option>
            <option value="local">Local ({localLang})</option>
          </select>
          <input
            type="text"
            placeholder="Type any phrase to translate & speak audio..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="inp text-xs flex-1"
          />
          <button
            type="submit"
            disabled={isTranslating || !textInput.trim()}
            className="btn !bg-lagoon text-white !rounded-2xl text-xs whitespace-nowrap"
          >
            {isTranslating ? "Translating…" : "Translate & Speak"}
          </button>
        </form>
      </div>

      {/* Conversation Audio Log */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 dark:text-slate-400">
          Live Audio Translation History
        </h3>

        <div className="space-y-3">
          {conversation.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-3xl p-5 shadow-sm ring-1 transition ${
                msg.who === "user"
                  ? "bg-white dark:bg-darkcard ring-ink/10 dark:ring-white/10 ml-0 mr-6"
                  : "bg-lagoon/5 dark:bg-lagoon/10 ring-lagoon/30 ml-6 mr-0"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-ink/50 dark:text-slate-400 pb-2 border-b border-ink/5 dark:border-white/5">
                <span className="font-bold text-ink dark:text-white">
                  {msg.who === "user" ? "🗣️ You (Traveler)" : "🤝 Local Person"} · {msg.fromLang} ➔ {msg.toLang}
                </span>
                <span className="text-[11px]">{msg.timestamp}</span>
              </div>

              {/* Original Transcript */}
              <div className="mt-2 text-xs text-ink/70 dark:text-slate-300">
                <span className="font-semibold text-ink/50 dark:text-slate-400 block text-[10px] uppercase">
                  Spoken ({msg.fromLang})
                </span>
                <p className="mt-0.5">{msg.originalText}</p>
              </div>

              {/* Translated Transcript & Audio Replay */}
              <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl bg-paper dark:bg-darkpaper p-3 text-sm">
                <div>
                  <span className="font-bold text-[10px] uppercase text-lagoon block">
                    Live Translation ({msg.toLang})
                  </span>
                  <p className="mt-0.5 font-bold text-ink dark:text-white">{msg.translatedText}</p>
                  {msg.source && (
                    <span className="text-[10px] text-ink/40 dark:text-slate-500 block mt-1">
                      via {msg.source}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => speakText(msg.translatedText, msg.toLang)}
                  className="rounded-xl bg-white dark:bg-darkcard p-2 text-ink dark:text-white shadow-sm ring-1 ring-ink/10 dark:ring-white/10 hover:bg-lagoon hover:text-white transition"
                  title="Replay translated audio"
                >
                  <SpeakerIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
