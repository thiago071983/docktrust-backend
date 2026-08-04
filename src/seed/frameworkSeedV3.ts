// ============================================================================
// Dock Trust Framework v3 — gerado a partir da planilha oficial
// (Dock_Trust_Framework_Segmentado.xlsx) via scripts/xlsx_to_framework.py.
//
// NÃO EDITE OS ARQUIVOS EM ./data À MÃO. Quando a planilha for atualizada
// pelo time de produto, rode de novo:
//   python3 scripts/xlsx_to_framework.py <planilha.xlsx> src/seed/data
//
// 232 perguntas · 5 pilares · 30 controles (áreas/disciplinas) · 16 segmentos
// de cliente · 12 condições de aplicabilidade.
// ============================================================================

import { FrameworkDTO } from "../types/domain";
import frameworkData from "./data/frameworkV3.json";

export const dockTrustFrameworkV3 = frameworkData as unknown as FrameworkDTO;
