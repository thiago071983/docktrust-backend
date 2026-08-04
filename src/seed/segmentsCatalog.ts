// ============================================================================
// Catálogo de segmentos de cliente — gerado a partir da aba "Perfis e
// Regras" da planilha oficial. Mesma regra do frameworkSeedV3.ts: não
// editar à mão, regenerar via scripts/xlsx_to_framework.py.
// ============================================================================

import segmentsData from "./data/segmentsV3.json";

export interface ClientSegment {
  code: string;
  name: string;
  description: string;
}

export const CLIENT_SEGMENTS: ClientSegment[] = segmentsData;

export function getSegment(code: string): ClientSegment | undefined {
  return CLIENT_SEGMENTS.find((s) => s.code === code);
}
