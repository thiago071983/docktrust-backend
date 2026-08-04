// ============================================================================
// Catálogo de condições de aplicabilidade — os 12 flags booleanos que, junto
// com o segmento, determinam quais perguntas "Condicional" entram no
// assessment de uma instituição. Gerado a partir da planilha oficial —
// não editar à mão, regenerar via scripts/xlsx_to_framework.py.
//
// Capturados no onboarding (ou editáveis depois, no perfil da instituição):
// é isso que alimenta InstitutionProfileDTO.conditionFlags.
// ============================================================================

import conditionsData from "./data/conditionsV3.json";

export interface ApplicabilityCondition {
  key: string;
  description: string;
}

export const APPLICABILITY_CONDITIONS: ApplicabilityCondition[] = conditionsData;
