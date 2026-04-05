/**
 * Version du jeu de règles de conformité.
 * Incrémenter à chaque modification des règles ou des poids.
 */
export const RULES_VERSION = "1.0";

export { checkCompliance, getScoreBand } from "./engine";
export type {
  ComplianceReport,
  ComplianceResultRecord,
  RuleResult,
  RuleCategory,
  ScoreBand,
} from "./types";
