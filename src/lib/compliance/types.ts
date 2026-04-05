// --------------------------------------------------------------------------
// Types du moteur de conformité (T006)
// --------------------------------------------------------------------------

export type ScoreBand =
  | "conforme"                    // 90-100
  | "attention"                   // 70-89
  | "non_conforme_corrections"    // 50-69
  | "non_conforme_invalide";      // 0-49

export type RuleCategory = "blocking" | "warning" | "suggestion";

/**
 * Résultat de l'évaluation d'une règle individuelle.
 */
export interface RuleResult {
  rule_id:      string;
  category:     RuleCategory;
  field_name:   string;         // Champ ciblé par la règle
  message:      string;         // Message en français pour l'utilisateur
  passed:       boolean;        // true = règle respectée
  score_impact: number;         // ≤ 0 — appliqué uniquement si !passed
}

/**
 * Rapport complet de conformité d'une facture.
 */
export interface ComplianceReport {
  score:           number;        // 0-100
  band:            ScoreBand;
  blocking_errors: RuleResult[];  // Règles bloquantes non respectées
  warnings:        RuleResult[];  // Avertissements
  suggestions:     RuleResult[];  // Bonnes pratiques manquantes
  rules_version:   string;
  checked_at:      string;        // ISO 8601
}

/**
 * Enregistrement stocké dans la table compliance_results.
 */
export interface ComplianceResultRecord {
  id:             string;
  upload_id:      string;
  user_id:        string;
  score:          number;
  band:           ScoreBand;
  blocking_errors: RuleResult[];
  warnings:        RuleResult[];
  suggestions:     RuleResult[];
  rules_version:  string;
  checked_at:     string;
}
