// ============================================================================
// Rotas de Assessment
// Skeleton funcional — troque os stubs de "TODO: Prisma" pelas chamadas
// reais ao PrismaClient assim que o banco estiver provisionado.
// ============================================================================

import { Router, Request, Response as ExpressResponse } from "express";
import { calculateScore } from "../scoring/engine";
import { recommendServices } from "../scoring/recommendations";
import { filterFrameworkForInstitution } from "../scoring/applicability";
import { dockTrustFrameworkV3 } from "../seed/frameworkSeedV3";
import { RawResponse, InstitutionProfileDTO } from "../types/domain";

export const assessmentsRouter = Router({ mergeParams: true });

// TODO: Prisma — substituir por SELECT segments, applicabilityFlags FROM
// Institution WHERE id = :institutionId (o :institutionId já chega aqui via
// mergeParams, herdado do mount em institutions.ts). Enquanto não há banco,
// assume um perfil "tudo aplicável" — ou seja, filtro não remove nada, o que
// é seguro (nunca esconde pergunta por engano), mas não reflete o segmento
// real do cliente até isso ser plugado.
function loadInstitutionProfileStub(institutionId: string): InstitutionProfileDTO {
  return { segments: [], conditionFlags: {} };
}

function getFrameworkForRequest(req: Request) {
  const institutionId = req.params.institutionId;
  const profile = loadInstitutionProfileStub(institutionId);
  // Perfil vazio (sem segments) só deixaria passar UNIVERSAL — por isso o
  // stub acima é proposital: até a Prisma query existir, o comportamento
  // seguro é "não sabemos o perfil" != "aplica tudo". Ajuste quando plugar.
  return filterFrameworkForInstitution(dockTrustFrameworkV3, profile);
}

// GET /assessments/:id/questions — devolve o framework JÁ FILTRADO pelo
// segmento e pelas condições de aplicabilidade da instituição (agrupado por
// pilar > controle > pergunta). Duas instituições de segmentos diferentes
// recebem conjuntos de perguntas diferentes a partir das mesmas 232
// perguntas-fonte — ver src/scoring/applicability.ts.
assessmentsRouter.get("/:id/questions", (req: Request, res: ExpressResponse) => {
  res.json(getFrameworkForRequest(req));
});

// GET /assessments/:id/responses — devolve todas as respostas já salvas
// desse assessment. É isso que permite ao cliente fechar a aba no meio do
// preenchimento e continuar depois exatamente de onde parou: a UI carrega
// esse resultado e pré-popula o formulário antes de renderizar as perguntas.
assessmentsRouter.get("/:id/responses", (req: Request, res: ExpressResponse) => {
  // TODO: Prisma — SELECT questionId, rawValue FROM Response WHERE assessmentId = :id
  res.json({ responses: [] });
});

// PUT /assessments/:id/responses/:questionId — salva UMA resposta imediatamente.
// Esta é a rota que a UI deve chamar a cada resposta (não em lote ao final),
// exatamente para garantir que nada se perde: se o cliente fechar a aba logo
// depois de responder uma pergunta, aquela resposta específica já está em
// disco, não só em memória do navegador.
assessmentsRouter.put("/:id/responses/:questionId", (req: Request, res: ExpressResponse) => {
  const { value } = req.body as { value: RawResponse["value"] };
  if (value === undefined) {
    return res.status(400).json({ error: "value é obrigatório" });
  }

  // TODO: Prisma — upsert em Response por (assessmentId, questionId) — usar
  // a constraint @@unique([assessmentId, questionId]) do schema, então:
  //   prisma.response.upsert({
  //     where: { assessmentId_questionId: { assessmentId: req.params.id, questionId: req.params.questionId } },
  //     update: { rawValue: value, normalizedScore, updatedAt: new Date() },
  //     create: { assessmentId: req.params.id, questionId: req.params.questionId, rawValue: value, normalizedScore },
  //   })
  // Depois recarregar TODAS as respostas do assessment (não só a payload
  // deste request) para recalcular o score com o estado completo salvo.

  res.json({ questionId: req.params.questionId, saved: true, savedAt: new Date().toISOString() });
});

// POST /assessments/:id/responses — upsert EM LOTE (várias respostas de uma
// vez). Usado por bulk-import e por "salvar rascunho" de múltiplas respostas
// pendentes (ex: reconectou depois de ficar offline). Nunca substitui as
// respostas já salvas que não vierem nesta chamada — é sempre upsert por
// questionId, nunca um DELETE + INSERT do assessment inteiro.
assessmentsRouter.post("/:id/responses", (req: Request, res: ExpressResponse) => {
  const { responses } = req.body as { responses: RawResponse[] };

  if (!Array.isArray(responses)) {
    return res.status(400).json({ error: "responses deve ser um array" });
  }

  // TODO: Prisma — upsert de cada item em Response (mesma constraint acima),
  // depois recarregar TODAS as respostas do assessment (salvas + as deste
  // payload) antes de calcular (aqui simplificado: usa só o payload enviado)
  const result = calculateScore(getFrameworkForRequest(req), responses);
  const recommendations = recommendServices(result.controlScores, result.maturityLevel);

  res.json({ ...result, recommendations });
});

// POST /assessments/:id/submit — fecha o ciclo, congela o ScoreSnapshot
assessmentsRouter.post("/:id/submit", (req: Request, res: ExpressResponse) => {
  const { responses } = req.body as { responses: RawResponse[] };

  const result = calculateScore(getFrameworkForRequest(req), responses);
  const recommendations = recommendServices(result.controlScores, result.maturityLevel);

  // TODO: Prisma — dentro de uma transação:
  // 1. assessment.status = SUBMITTED, submittedAt = now()
  // 2. criar ScoreSnapshot com overallScore + maturityLevel
  // 3. criar um PillarScore por pilar em result.pillarScores
  // 4. opcionalmente persistir as recomendações geradas (auditável: "isso foi
  //    sugerido nesse ciclo, com base nesse score")

  res.json({
    status: "SUBMITTED",
    ...result,
    recommendations,
  });
});

// (histórico de score por instituição foi movido para institutions.ts —
// GET /institutions/:institutionId/score-history — onde o guard de acesso
// por instituição já se aplica naturalmente)
