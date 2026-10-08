import type { EmergencyContacts } from "./types";

export const VERIFIED_EMERGENCY_DATA: Record<string, EmergencyContacts> = {
  india: {
    country: "India",
    police: "112",
    ambulance: "112 (also 102)",
    fire: "112 (also 101)",
    touristPolice: "1363 (Tourist Infoline)",
    note: "112 is India's pan-national single emergency response number."
  },
  "united states": {
    country: "United States",
    police: "911",
    ambulance: "911",
    fire: "911",
    note: "911 connects to all public safety dispatchers across the US."
  },
  usa: {
    country: "United States",
    police: "911",
    ambulance: "911",
    fire: "911",
    note: "911 connects to all public safety dispatchers across the US."
  },
  "united kingdom": {
    country: "United Kingdom",
    police: "999 / 112",
    ambulance: "999 / 112",
    fire: "999 / 112",
    medicalHelpline: "111 (non-emergency NHS)",
    note: "999 is standard UK emergency; 112 is also supported."
  },
  uk: {
    country: "United Kingdom",
    police: "999 / 112",
    ambulance: "999 / 112",
    fire: "999 / 112",
    medicalHelpline: "111 (non-emergency NHS)",
    note: "999 is standard UK emergency; 112 is also supported."
  },
  japan: {
    country: "Japan",
    police: "110",
    ambulance: "119",
    fire: "119",
    touristPolice: "+81 3-3501-0110",
    note: "110 for police; 119 for fire and ambulance service."
  },
  australia: {
    country: "Australia",
    police: "000",
    ambulance: "000",
    fire: "000",
    note: "000 (Triple Zero) is Australia's primary emergency call service."
  },
  thailand: {
    country: "Thailand",
    police: "191",
    ambulance: "1669",
    fire: "199",
    touristPolice: "1155 (English-speaking Tourist Police)",
    note: "Tourist Police at 1155 have multilingual operators."
  },
  france: {
    country: "France",
    police: "17 / 112",
    ambulance: "15 / 112 (SAMU)",
    fire: "18 / 112 (Pompiers)",
    note: "112 is the EU-wide emergency number operating in France."
  },
  italy: {
    country: "Italy",
    police: "112 / 113",
    ambulance: "118 / 112",
    fire: "115 / 112",
    note: "112 serves as the single European emergency number across Italy."
  },
  spain: {
    country: "Spain",
    police: "091 / 112",
    ambulance: "061 / 112",
    fire: "080 / 112",
    touristPolice: "+34 902 102 112 (SATE Tourist Assistance)",
    note: "112 connects to emergency services in all regions of Spain."
  },
  germany: {
    country: "Germany",
    police: "110",
    ambulance: "112",
    fire: "112",
    medicalHelpline: "116 117 (On-call medical service)",
    note: "112 for ambulance/fire, 110 for police."
  },
  singapore: {
    country: "Singapore",
    police: "999",
    ambulance: "995",
    fire: "995",
    note: "999 for Police, 995 for SCDF Ambulance and Fire."
  },
  "united arab emirates": {
    country: "United Arab Emirates",
    police: "999",
    ambulance: "998",
    fire: "997",
    touristPolice: "901 (Dubai Tourist Police inquiry)",
    note: "Dubai / UAE emergency response numbers are unified across the emirates."
  },
  uae: {
    country: "United Arab Emirates",
    police: "999",
    ambulance: "998",
    fire: "997",
    touristPolice: "901 (Dubai Tourist Police inquiry)",
    note: "Dubai / UAE emergency response numbers are unified across the emirates."
  },
  indonesia: {
    country: "Indonesia",
    police: "110 / 112",
    ambulance: "118 / 119",
    fire: "113",
    note: "112 has been implemented in Bali, Jakarta, and several major regencies."
  },
  bali: {
    country: "Indonesia (Bali)",
    police: "110 / 112",
    ambulance: "118 / 112",
    fire: "113",
    touristPolice: "+62 361 224111",
    note: "112 is available in Denpasar, Badung and throughout Bali."
  },
  switzerland: {
    country: "Switzerland",
    police: "117 / 112",
    ambulance: "144",
    fire: "118",
    note: "144 for medical emergency, 117 for police, 1414 for REGA air rescue."
  },
  vietnam: {
    country: "Vietnam",
    police: "113",
    ambulance: "115",
    fire: "114",
    note: "Dial 113 for police, 115 for emergency medical assistance."
  },
  canada: {
    country: "Canada",
    police: "911",
    ambulance: "911",
    fire: "911",
    note: "911 is the universal emergency number throughout Canada."
  }
};

export function lookupEmergency(locationOrCountry: string): EmergencyContacts | null {
  if (!locationOrCountry) return null;
  const lower = locationOrCountry.toLowerCase().trim();
  
  for (const [key, val] of Object.entries(VERIFIED_EMERGENCY_DATA)) {
    if (lower.includes(key) || key.includes(lower)) {
      return val;
    }
  }
  return null;
}
