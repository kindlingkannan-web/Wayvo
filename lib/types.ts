export type Src = "AI estimate" | "Sample data" | "Live";

export type GroupType = "Solo" | "Friends" | "Family" | "Couple" | "Other";
export type FoodPreference = "Vegetarian" | "Non-vegetarian" | "Vegan";

export interface Cost {
  label: string;
  amount: number | null;
  kind: "known" | "estimated" | "unknown";
  category?: "ticket" | "locker" | "booking_fee" | "service_fee" | "permit" | "transport" | "other";
}

export interface Transportation {
  method: "Walking" | "Metro" | "Bus" | "Taxi/cab" | "Auto rickshaw" | "Train" | "Private vehicle";
  durationMin: number;
  cost: number | null;
  departureTime?: string;
  notes?: string;
  bookingAvailable?: boolean;
}

export interface Activity {
  id: string;
  name: string;
  description?: string;
  kind: "attraction" | "meal";
  indoor: boolean;
  priority: 1 | 2 | 3; // 1 = Must-see / High, 2 = Medium, 3 = Flexible / Low
  fixed?: boolean; // Kept by user
  ticket: number | null;
  waitMin: number | null;
  waitLabel: "Estimated waiting time" | "Waiting time unavailable" | "No queue expected";
  visitMin: number;
  open: string;
  close: string;
  start: string;
  end?: string;
  reason: string; // Concise "Why recommended"
  transport: Transportation | string;
  extras: Cost[];
  done: boolean;
  warning?: string;
}

export interface Accommodation {
  id: string;
  name: string;
  rating: number | null;
  pricePerNight: number | null;
  currency?: string;
  description?: string;
  keyFacilities: string[];
  reason: string; // Concise "Why recommended" (suitability for group/comfort/location only)
  availabilityStatus: "available" | "limited" | "estimated" | "unavailable";
}

export interface Day {
  date: string;
  dayNumber: number;
  activities: Activity[];
  weatherSummary?: string;
  severeAlerts?: string[];
}

export interface Plan {
  id: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  durationDays: number;
  travelers: number;
  group: GroupType;
  budget: number;
  diet: FoodPreference;
  language: string;
  source: Src;
  hotel: Accommodation;
  alternativeHotels?: Accommodation[];
  transportPerDay: number | null;
  days: Day[];
  alternatives: Activity[];
}

export interface WeatherDay {
  date: string;
  max: number;
  min: number;
  rain: number;
  gust: number;
  code: number;
  bad: boolean;
  severe: string[];
}

export interface WeatherForecast {
  place: string;
  days: WeatherDay[];
  note: string;
}

export interface EmergencyContacts {
  country: string;
  police: string;
  ambulance: string;
  fire: string;
  touristPolice?: string;
  medicalHelpline?: string;
  note?: string;
}

export interface BudgetSummary {
  acc: number;
  transport: number;
  food: number;
  attractions: number;
  known: number;
  est: number;
  unknown: number;
  planned: number;
  remaining: number;
  over: boolean;
  overAmount: number;
}
