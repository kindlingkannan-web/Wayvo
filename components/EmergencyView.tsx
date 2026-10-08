"use client";
import React, { useState, useEffect } from "react";
import { lookupEmergency } from "@/lib/emergencyData";
import { PhoneIcon, ShieldAlertIcon } from "./Icons";
import type { EmergencyContacts } from "@/lib/types";

interface EmergencyViewProps {
  destination: string;
}

export function EmergencyView({ destination }: EmergencyViewProps) {
  const [countryQuery, setCountryQuery] = useState(destination || "India");
  const [contacts, setContacts] = useState<EmergencyContacts | null>(null);
  const [searched, setSearched] = useState(false);

  // Custom user contacts
  const [customList, setCustomList] = useState<{ label: string; phone: string }[]>([
    { label: "Hotel Front Desk", phone: "+91 141 220 1234" },
    { label: "Travel Insurance Hotline", phone: "+1 800 555 0199" },
  ]);
  const [newLabel, setNewLabel] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const searchCountry = (term: string) => {
    setSearched(true);
    const res = lookupEmergency(term);
    setContacts(res);
  };

  useEffect(() => {
    if (destination) {
      setCountryQuery(destination);
      searchCountry(destination);
    }
  }, [destination]);

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newPhone.trim()) return;
    setCustomList([...customList, { label: newLabel.trim(), phone: newPhone.trim() }]);
    setNewLabel("");
    setNewPhone("");
  };

  return (
    <div className="space-y-5">
      {/* Header and Lookup */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/10">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink/10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-alert">
              Destination Safety
            </span>
            <h2 className="text-xl font-black text-ink">Emergency Assistance</h2>
            <p className="text-xs text-ink/60 mt-0.5">
              Verified national emergency dispatch numbers. Tap any number to place an immediate call.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchCountry(countryQuery);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="Country or territory..."
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              className="inp text-xs !w-44"
            />
            <button type="submit" className="btn !bg-ink text-white !rounded-xl !py-1 text-xs">
              Search
            </button>
          </form>
        </div>

        {/* Verified Country Cards */}
        {contacts ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-ink">
                Official Numbers for {contacts.country}
              </span>
              <span className="rounded-full bg-lagoon/15 text-lagoon px-2.5 py-0.5 font-bold text-[10px] uppercase">
                Verified Directory ✓
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {/* Police */}
              <a
                href={`tel:${contacts.police.replace(/\D/g, "")}`}
                className="group rounded-3xl bg-paper p-5 transition ring-1 ring-ink/10 hover:bg-alert/10 hover:ring-alert block"
              >
                <div className="text-xs font-bold text-ink/60 uppercase">Police / Law Enforcement</div>
                <div className="mt-2 text-3xl font-black text-ink group-hover:text-alert">
                  {contacts.police}
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-lagoon group-hover:text-alert">
                  <PhoneIcon className="w-3.5 h-3.5" />
                  <span>Tap to Dial Dispatch</span>
                </div>
              </a>

              {/* Ambulance */}
              <a
                href={`tel:${contacts.ambulance.replace(/\D/g, "")}`}
                className="group rounded-3xl bg-paper p-5 transition ring-1 ring-ink/10 hover:bg-alert/10 hover:ring-alert block"
              >
                <div className="text-xs font-bold text-ink/60 uppercase">Ambulance / Medical</div>
                <div className="mt-2 text-3xl font-black text-ink group-hover:text-alert">
                  {contacts.ambulance}
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-lagoon group-hover:text-alert">
                  <PhoneIcon className="w-3.5 h-3.5" />
                  <span>Tap to Dial Dispatch</span>
                </div>
              </a>

              {/* Fire */}
              <a
                href={`tel:${contacts.fire.replace(/\D/g, "")}`}
                className="group rounded-3xl bg-paper p-5 transition ring-1 ring-ink/10 hover:bg-alert/10 hover:ring-alert block"
              >
                <div className="text-xs font-bold text-ink/60 uppercase">Fire Rescue Services</div>
                <div className="mt-2 text-3xl font-black text-ink group-hover:text-alert">
                  {contacts.fire}
                </div>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-lagoon group-hover:text-alert">
                  <PhoneIcon className="w-3.5 h-3.5" />
                  <span>Tap to Dial Dispatch</span>
                </div>
              </a>
            </div>

            {/* Special Tourist Police or Notes */}
            {(contacts.touristPolice || contacts.note) && (
              <div className="rounded-2xl bg-paper p-4 text-xs space-y-1">
                {contacts.touristPolice && (
                  <p className="text-ink">
                    👮 <b>Tourist Assistance &amp; Police:</b> {contacts.touristPolice}
                  </p>
                )}
                {contacts.note && (
                  <p className="text-ink/70">
                    ℹ️ <b>Dispatch Guidance:</b> {contacts.note}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          searched && (
            <div className="mt-5 rounded-2xl border border-amber/40 bg-amber/10 p-5 text-xs text-ink space-y-2">
              <span className="font-bold text-amber block">
                Official emergency numbers for "{countryQuery}" are not in the built-in verified registry.
              </span>
              <p className="text-ink/80">
                To prevent dangerous misinformation, we never fabricate emergency contact data. Please
                verify local dispatch with your hotel concierge or official embassy consulate.
              </p>
            </div>
          )
        )}
      </div>

      {/* Traveler's Personal Emergency Contacts */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/10 space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-ink/50">
            Personal &amp; Embassy Contacts
          </span>
          <h3 className="text-base font-bold text-ink">Trip Safety Directory</h3>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {customList.map((c, i) => (
            <a
              key={i}
              href={`tel:${c.phone}`}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-paper hover:bg-paper/80 transition text-xs border border-ink/5"
            >
              <div>
                <div className="font-bold text-ink">{c.label}</div>
                <div className="text-ink/60 font-mono mt-0.5">{c.phone}</div>
              </div>
              <span className="rounded-xl bg-ink/10 p-2 text-ink">
                <PhoneIcon className="w-4 h-4" />
              </span>
            </a>
          ))}
        </div>

        {/* Add custom contact form */}
        <form onSubmit={handleAddCustom} className="mt-4 pt-3 border-t border-ink/10 flex gap-2">
          <input
            type="text"
            placeholder="Contact Name (e.g. Local Embassy)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="inp text-xs flex-1"
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="inp text-xs !w-40"
          />
          <button type="submit" className="btn !bg-ink !rounded-xl !py-1 text-xs whitespace-nowrap">
            + Add Contact
          </button>
        </form>
      </div>
    </div>
  );
}
