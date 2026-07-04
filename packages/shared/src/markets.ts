export type MarketCode = "AU" | "SG" | "HK" | "CN" | "GLOBAL";

export type MarketProfile = {
  code: MarketCode;
  name: string;
  primaryLanguage: "English" | "Chinese" | "Bilingual";
  currency: string;
  focus: string[];
  riskSignals: string[];
};

export const marketProfiles: MarketProfile[] = [
  {
    code: "AU",
    name: "澳洲",
    primaryLanguage: "English",
    currency: "AUD",
    focus: ["graduate program", "work rights", "local experience", "hybrid roles"],
    riskSignals: ["PR", "citizen", "permanent resident", "baseline clearance"]
  },
  {
    code: "SG",
    name: "新加坡",
    primaryLanguage: "English",
    currency: "SGD",
    focus: ["EP/S Pass feasibility", "regional HQ roles", "fintech", "data roles"],
    riskSignals: ["Singaporean only", "PR preferred", "no sponsorship"]
  },
  {
    code: "HK",
    name: "香港",
    primaryLanguage: "Bilingual",
    currency: "HKD",
    focus: ["IANG", "fintech", "banking technology", "Mandarin/Cantonese signals"],
    riskSignals: ["Cantonese required", "HK permanent resident", "immediate availability"]
  },
  {
    code: "CN",
    name: "中国大陆",
    primaryLanguage: "Chinese",
    currency: "CNY",
    focus: ["campus recruitment", "new graduate identity", "written tests", "referrals"],
    riskSignals: ["985/211 preference", "fresh graduate only", "city restriction"]
  },
  {
    code: "GLOBAL",
    name: "远程/全球",
    primaryLanguage: "English",
    currency: "USD",
    focus: ["remote eligibility", "timezone overlap", "contract risk", "portfolio proof"],
    riskSignals: ["US only", "EU only", "existing work authorization"]
  }
];
