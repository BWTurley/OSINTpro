import type { AdmiraltySourceReliability, AdmiraltyInformationCredibility } from "../types/entities.js";

export interface SourceReliabilityDefinition {
  code: AdmiraltySourceReliability;
  label: string;
  description: string;
}

export interface InformationCredibilityDefinition {
  code: AdmiraltyInformationCredibility;
  label: string;
  description: string;
}

export const SOURCE_RELIABILITY: Record<AdmiraltySourceReliability, SourceReliabilityDefinition> = {
  A: {
    code: "A",
    label: "Completely Reliable",
    description: "No doubt of authenticity, trustworthiness, or competency; has a history of complete reliability.",
  },
  B: {
    code: "B",
    label: "Usually Reliable",
    description: "Minor doubt about authenticity, trustworthiness, or competency; has a history of valid information most of the time.",
  },
  C: {
    code: "C",
    label: "Fairly Reliable",
    description: "Doubt of authenticity, trustworthiness, or competency but has provided valid information in the past.",
  },
  D: {
    code: "D",
    label: "Not Usually Reliable",
    description: "Significant doubt about authenticity, trustworthiness, or competency but has provided valid information in the past.",
  },
  E: {
    code: "E",
    label: "Unreliable",
    description: "Lacking in authenticity, trustworthiness, and competency; history of invalid information.",
  },
  F: {
    code: "F",
    label: "Reliability Cannot Be Judged",
    description: "No basis exists for evaluating the reliability of the source.",
  },
};

export const INFORMATION_CREDIBILITY: Record<AdmiraltyInformationCredibility, InformationCredibilityDefinition> = {
  "1": {
    code: "1",
    label: "Confirmed",
    description: "Confirmed by other independent sources; logical in itself; consistent with other information on the subject.",
  },
  "2": {
    code: "2",
    label: "Probably True",
    description: "Not confirmed; logical in itself; consistent with other information on the subject.",
  },
  "3": {
    code: "3",
    label: "Possibly True",
    description: "Not confirmed; reasonably logical in itself; agrees with some other information on the subject.",
  },
  "4": {
    code: "4",
    label: "Doubtfully True",
    description: "Not confirmed; possible but not logical; no other information on the subject.",
  },
  "5": {
    code: "5",
    label: "Improbable",
    description: "Not confirmed; not logical in itself; contradicted by other information on the subject.",
  },
  "6": {
    code: "6",
    label: "Truth Cannot Be Judged",
    description: "No basis exists for evaluating the validity of the information.",
  },
};

export function formatAdmiraltyCodeFull(
  source: AdmiraltySourceReliability,
  credibility: AdmiraltyInformationCredibility
): string {
  return `${source}${credibility} - ${SOURCE_RELIABILITY[source].label} / ${INFORMATION_CREDIBILITY[credibility].label}`;
}

export function formatAdmiraltyCodeShort(
  source: AdmiraltySourceReliability,
  credibility: AdmiraltyInformationCredibility
): string {
  return `${source}${credibility}`;
}

export function admiraltyToConfidence(
  source: AdmiraltySourceReliability,
  credibility: AdmiraltyInformationCredibility
): number {
  const sourceScores: Record<AdmiraltySourceReliability, number> = {
    A: 1.0,
    B: 0.8,
    C: 0.6,
    D: 0.4,
    E: 0.2,
    F: 0.5,
  };
  const credibilityScores: Record<AdmiraltyInformationCredibility, number> = {
    "1": 1.0,
    "2": 0.8,
    "3": 0.6,
    "4": 0.4,
    "5": 0.2,
    "6": 0.5,
  };
  return Math.round(sourceScores[source] * credibilityScores[credibility] * 100) / 100;
}

export function confidenceToAdmiralty(confidence: number): {
  source: AdmiraltySourceReliability;
  credibility: AdmiraltyInformationCredibility;
} {
  if (confidence >= 0.9) return { source: "A", credibility: "1" };
  if (confidence >= 0.75) return { source: "B", credibility: "2" };
  if (confidence >= 0.6) return { source: "B", credibility: "3" };
  if (confidence >= 0.45) return { source: "C", credibility: "3" };
  if (confidence >= 0.3) return { source: "D", credibility: "4" };
  if (confidence >= 0.15) return { source: "E", credibility: "5" };
  return { source: "F", credibility: "6" };
}
