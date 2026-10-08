import "./globals.css";import {Bricolage_Grotesque} from "next/font/google";
const f=Bricolage_Grotesque({subsets:["latin"],variable:"--font-body"});
export const metadata = {
  title: "Wayvo — AI Travel Agent & Co-Pilot",
  description: "Autonomous AI travel planner with geographical clustering and dynamic itinerary optimization.",
};
export default function L({children}:{children:React.ReactNode}){return <html lang="en"><body className={f.variable+" font-sans"}>{children}</body></html>}
