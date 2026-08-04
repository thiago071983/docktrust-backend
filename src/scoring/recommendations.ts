// ============================================================================
// Motor de recomendação — a ponte entre "score baixo" e "proposta comercial"
// ============================================================================
// Função pura: recebe os control scores já calculados (saída do engine.ts)
// e devolve uma lista priorizada de recomendações de serviço. Prioriza pelo
// tamanho do gap (100 - score), não pela ordem dos pilares — o que está
// pior é o que aparece primeiro, é isso que orienta a conversa comercial.
// ============================================================================

import { ControlScoreResult } from "../types/domain";
import { TRUST_SERVICES, getService, TrustService } from "../seed/servicesCatalog";

export interface ServiceRecommendation {
  service: TrustService;
  triggeredByControls: { controlId: string; name?: string; score: number }[];
  worstScore: number; // menor score entre os controles que dispararam essa recomendação
}

const GAP_THRESHOLD = 65; // abaixo disso, o controle é considerado "gap acionável"

export function recommendServices(
  controlScores: ControlScoreResult[],
  overallMaturityLevel: number
): ServiceRecommendation[] {
  const byService = new Map<string, ServiceRecommendation>();

  for (const control of controlScores) {
    if (control.score >= GAP_THRESHOLD || !control.recommendedServiceId) continue;

    const service = getService(control.recommendedServiceId);
    if (!service) continue;

    const existing = byService.get(service.id);
    if (existing) {
      existing.triggeredByControls.push({ controlId: control.controlId, name: control.name, score: control.score });
      existing.worstScore = Math.min(existing.worstScore, control.score);
    } else {
      byService.set(service.id, {
        service,
        triggeredByControls: [{ controlId: control.controlId, name: control.name, score: control.score }],
        worstScore: control.score,
      });
    }
  }

  // Instituição em nível 1 (Protected) de maturidade geral: sempre inclui
  // Trust Enablement como ponto de entrada, mesmo que nenhum controle
  // isolado tenha disparado — ela precisa de uma jornada estruturada, não
  // de correções pontuais.
  if (overallMaturityLevel === 1 && !byService.has("trust-enablement")) {
    const enablement = getService("trust-enablement")!;
    byService.set(enablement.id, {
      service: enablement,
      triggeredByControls: [],
      worstScore: 0,
    });
  }

  return Array.from(byService.values()).sort((a, b) => a.worstScore - b.worstScore);
}
