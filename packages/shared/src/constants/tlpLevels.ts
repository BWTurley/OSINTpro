import type { TLPLevel } from "../types/entities.js";

export interface TLPDefinition {
  level: TLPLevel;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  textColor: string;
  sharing: string;
}

export const TLP_DEFINITIONS: Record<TLPLevel, TLPDefinition> = {
  WHITE: {
    level: "WHITE",
    label: "TLP:WHITE",
    description: "Information can be shared freely without restriction.",
    color: "#FFFFFF",
    bgColor: "#F5F5F5",
    textColor: "#333333",
    sharing: "Unlimited distribution. No restrictions on sharing.",
  },
  GREEN: {
    level: "GREEN",
    label: "TLP:GREEN",
    description: "Information can be shared within the community but not publicly.",
    color: "#33FF00",
    bgColor: "#E8FFE0",
    textColor: "#1A6B00",
    sharing: "Community-wide sharing. Not for public disclosure.",
  },
  AMBER: {
    level: "AMBER",
    label: "TLP:AMBER",
    description: "Information can be shared with members of the recipient's organization who need to know.",
    color: "#FFC000",
    bgColor: "#FFF8E0",
    textColor: "#8B6914",
    sharing: "Limited to the recipient's organization on a need-to-know basis.",
  },
  AMBER_STRICT: {
    level: "AMBER_STRICT",
    label: "TLP:AMBER+STRICT",
    description: "Information is restricted to the recipient only, not to be shared within their organization.",
    color: "#FF8C00",
    bgColor: "#FFF0D0",
    textColor: "#8B4500",
    sharing: "Restricted to individual recipients only. No further sharing.",
  },
  RED: {
    level: "RED",
    label: "TLP:RED",
    description: "Information is restricted to the specific recipients only. No sharing whatsoever.",
    color: "#FF0033",
    bgColor: "#FFE0E5",
    textColor: "#8B0000",
    sharing: "Eyes only. For named recipients only. No further dissemination.",
  },
};

export const TLP_LEVELS_ORDERED: TLPLevel[] = [
  "WHITE",
  "GREEN",
  "AMBER",
  "AMBER_STRICT",
  "RED",
];

export function getTLPSeverityIndex(level: TLPLevel): number {
  return TLP_LEVELS_ORDERED.indexOf(level);
}

export function isMoreRestrictive(a: TLPLevel, b: TLPLevel): boolean {
  return getTLPSeverityIndex(a) > getTLPSeverityIndex(b);
}

export function getMostRestrictive(levels: TLPLevel[]): TLPLevel {
  if (levels.length === 0) return "WHITE";
  return levels.reduce((most, current) =>
    isMoreRestrictive(current, most) ? current : most
  );
}
