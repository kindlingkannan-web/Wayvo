"use client";
import React, { useState } from "react";
import type { Transportation } from "@/lib/types";

interface CabBookingModalProps {
  destination: string;
  transport: Transportation | string;
  fromName: string;
  toName: string;
  onClose: () => void;
}

export function CabBookingModal({
  destination,
  transport,
  fromName,
  toName,
  onClose,
}: CabBookingModalProps) {
  const [selectedRide, setSelectedRide] = useState<string>("Sedan");
  const [bookedStatus, setBookedStatus] = useState<string | null>(null);

  const duration = typeof transport === "object" ? transport.durationMin : 25;
  const baseCost = typeof transport === "object" && transport.cost ? transport.cost : 350;

  const rides = [
    { type: "Auto Rickshaw / Economy", fare: Math.round(baseCost * 0.65), eta: "3 min away", desc: "Quick & budget-friendly for 1-2 passengers" },
    { type: "Sedan / Standard Cab", fare: baseCost, eta: "5 min away", desc: "Air-conditioned 4-seater with boot space" },
    { type: "SUV / Group Cab", fare: Math.round(baseCost * 1.4), eta: "8 min away", desc: "Spacious 6-seater suited for families and luggage" },
  ];

  const handleSimulate = (rideName: string) => {
    setSelectedRide(rideName);
    setBookedStatus(`API Dispatch Placeholder: Pre-booking request prepared for ${rideName} from '${fromName}' to '${toName}'. In live production, this dispatches via Uber/Ola/Grab API.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-ink/10">
        <div className="flex items-center justify-between pb-3 border-b border-ink/10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lagoon">Transit Partner</span>
            <h2 className="text-xl font-bold text-ink">Book Cab / Transport</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-paper p-3 text-xs text-ink/70">
          <div className="font-semibold text-ink">Route Details:</div>
          <div className="mt-1 flex items-center justify-between">
            <span>Pickup: <b>{fromName}</b></span>
            <span>→</span>
            <span>Dropoff: <b>{toName}</b></span>
          </div>
          <div className="mt-1 text-ink/50">Estimated travel time: {duration} minutes ({destination})</div>
        </div>

        <div className="mt-4 space-y-2">
          {rides.map((r) => (
            <div
              key={r.type}
              onClick={() => handleSimulate(r.type)}
              className={`cursor-pointer rounded-2xl p-3.5 ring-1 transition ${
                selectedRide === r.type
                  ? "bg-lagoon/10 ring-lagoon"
                  : "bg-white ring-ink/10 hover:bg-paper"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-ink">{r.type}</div>
                  <div className="text-xs text-ink/60">{r.desc} · <span className="text-lagoon font-semibold">{r.eta}</span></div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-base text-ink">₹{r.fare}</div>
                  <div className="text-[10px] text-ink/50">estimated</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {bookedStatus && (
          <div className="mt-4 rounded-2xl bg-amber/20 p-3 text-xs text-ink/90 border border-amber/40">
            <span className="font-bold">⚠️ Integration Notice:</span> {bookedStatus}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn2 !rounded-2xl">
            Close
          </button>
          <button
            onClick={() => handleSimulate(selectedRide)}
            className="btn !rounded-2xl !bg-lagoon text-white"
          >
            Confirm Dispatch Intent
          </button>
        </div>
      </div>
    </div>
  );
}
