"use client";
import React, { useState } from "react";
import type { Plan, Accommodation } from "@/lib/types";

const inr = (n: number | null) =>
  n == null ? "Price unavailable" : "₹" + Math.round(n).toLocaleString("en-IN") + "/night";

interface HotelSelectorProps {
  plan: Plan;
  onUpdate: (updatedPlan: Plan) => void;
}

export function HotelSelector({ plan, onUpdate }: HotelSelectorProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const hotel = plan.hotel;
  const alternatives = plan.alternativeHotels || [];

  const handleSelectHotel = (alt: Accommodation) => {
    onUpdate({
      ...plan,
      hotel: alt,
      alternativeHotels: [hotel, ...alternatives.filter((h) => h.id !== alt.id)],
    });
    setIsChanging(false);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newHotel: Accommodation = {
      id: "h_cust_" + Date.now(),
      name: customName.trim(),
      rating: null,
      pricePerNight: customPrice ? Number(customPrice) : null,
      currency: "INR",
      description: "Custom accommodation provided by traveler.",
      keyFacilities: ["User-booked accommodation"],
      reason: "Added manually to match your booking.",
      availabilityStatus: "available",
    };

    onUpdate({
      ...plan,
      hotel: newHotel,
      alternativeHotels: [hotel, ...alternatives],
    });
    setCustomName("");
    setCustomPrice("");
    setIsChanging(false);
  };

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
      <div className="flex items-center justify-between pb-3 border-b border-ink/10">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-lagoon">Accommodation</span>
          <h2 className="text-lg font-bold text-ink">{hotel.name}</h2>
        </div>
        <button
          type="button"
          onClick={() => setIsChanging(!isChanging)}
          className="btn2 !rounded-xl !py-1 text-xs"
        >
          {isChanging ? "Done" : "Change Hotel"}
        </button>
      </div>

      {/* Main Hotel Details */}
      <div className="mt-3 space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold text-sm text-ink">{inr(hotel.pricePerNight)}</span>
          <span className="text-ink/50">·</span>
          <span className="font-semibold text-amber">
            ★ {hotel.rating != null ? hotel.rating : "Rating unavailable"}
          </span>
          <span className="text-ink/50">·</span>
          <span className="rounded-full bg-paper px-2 py-0.5 font-medium text-ink/70">
            Status: {hotel.availabilityStatus}
          </span>
        </div>

        {hotel.description && <p className="text-ink/70">{hotel.description}</p>}

        {hotel.keyFacilities && hotel.keyFacilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {hotel.keyFacilities.map((f, i) => (
              <span key={i} className="rounded-lg bg-paper px-2 py-0.5 text-[11px] text-ink/70 font-medium">
                ✓ {f}
              </span>
            ))}
          </div>
        )}

        {/* Explainable Why Recommended */}
        <div className="rounded-2xl bg-lagoon/5 p-3 text-ink/80 border border-lagoon/20">
          <span className="font-bold text-ink">Why recommended: </span>
          <span>{hotel.reason}</span>
        </div>
      </div>

      {/* Hotel Switching Drawer */}
      {isChanging && (
        <div className="mt-4 pt-4 border-t border-ink/10 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
            Available Recommendations
          </h3>

          {alternatives.length > 0 ? (
            <div className="space-y-2">
              {alternatives.map((alt) => (
                <div
                  key={alt.id}
                  className="rounded-2xl border border-ink/10 p-3 hover:bg-paper transition flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-ink">{alt.name}</div>
                    <div className="text-ink/60">
                      {inr(alt.pricePerNight)} · ★ {alt.rating ?? "N/A"} · {alt.reason}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectHotel(alt)}
                    className="btn !bg-lagoon text-white !rounded-xl !py-1 !px-3 text-xs"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink/50">No alternative hotels in quick cache.</p>
          )}

          {/* Add custom hotel form */}
          <form onSubmit={handleAddCustom} className="rounded-2xl bg-paper p-3 text-xs space-y-2">
            <div className="font-bold text-ink">Enter your own booked hotel:</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Hotel / Resort Name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="inp text-xs"
                required
              />
              <input
                type="number"
                placeholder="₹ Price / night (optional)"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="inp text-xs"
              />
            </div>
            <button type="submit" className="btn !bg-ink !rounded-xl !py-1 text-xs">
              Save Custom Hotel
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
