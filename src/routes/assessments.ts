// ============================================================================
// Rotas de Assessment
// ============================================================================

import { Router, Request, Response as ExpressResponse } from "express";
import { calculateScore } from "../scoring/engine";
import { recommendServices } from "../scoring/recommendations";
import { filterFrameworkForInstitution } from "../scoring/applicability";
import { dockTrustFrameworkV3 } from "../seed/frameworkSeedV3";
import { prisma } from "../db";
import { RawResponse, InstitutionProfileDTO, FrameworkDTO } from "../types/domain";

export const assessmentsRouter = Router({ mergeParams: true });

async function loadInstitutionProfile(institutionId: string): Promise<InstitutionProfileDTO | null> {
  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) return null;
  return {
    segments: institution.segments,
    conditionFlags: (institution.applicabilityFlags as Record<string, boolean>) || {},
  };
}

async function getFilteredFrameworkForInstitution(institutionId: string): Promise<FrameworkDTO | null> {
  const profile = await loadInstitutionProfile(institutionId);
  if (!profile) return null;
  return filterFrameworkForInstitution(dockTrustFrameworkV3, profile);
}

function findQuestionById(framework: FrameworkDTO, questionId: string) {
  for (const pillar of framework.pillars) {
    for (const control of pillar.controls) {
      const question = control.questions.find((q) => q.id === questionId);
      if (question) return question;
    }
  }
  return null;
}

// Mapa código-de-pilar ("T1", "R", "U", "S", "T2") -> id real do Pillar no
// banco, do Framework ativo. Precisa disso porque o framework em memória
// (dockTrustFrameworkV3) usa o código como identificador, mas a tabela
// PillarScore precisa do id de verdade gerado pelo Prisma no seed.
async function getPillarCodeToDbId(): Promise<Record<string, string>> {
  const pillars = await prisma.pillar.findMany({
    where: { framework: { isActive: true } },
    select: { id: true, code: true },
  });
  return Object.fromEntries(pillars.map((p) => [p.code, p.id]));
}

// GET /institutions/:institutionId/assessments/current — devolve o
// assessment em andamento da instituição, criando um novo se não existir
// nenhum (DRAFT/IN_PROGRESS). É o ponto de entrada: o frontend chama isso
// ao abrir a aba Assessment, pega o id, e usa nas rotas abaixo.
assessmentsRouter.get("/current", async (req: Request, res: ExpressResponse) => {
  const institutionId = req.params.institutionId;

  let assessment = await prisma.assessment.findFirst({
    where: { institutionId, status: { in: ["DRAFT", "IN_PROGRESS"] } },
    orderBy: { startedAt: "desc" },
  });

  if (!assessment) {
    const activeFramework = await prisma.framework.findFirst({ where: { isActive: true } });
    if (!activeFramework) {
      return res.status(500).json({ error: "Nenhum framework ativo cadastrado — rode o seed primeiro." });
    }
    const cycleCount = await prisma.assessment.count({ where: { institutionId } });
    assessment = await prisma.assessment.create({
      data: {
        institutionId,
        frameworkId: activeFramework.id,
        cycleLabel: cycleCount === 0 ? "Assessment Inicial" : `Ciclo ${cycleCount + 1}`,
        status: "IN_PROGRESS",
      },
    });
  }

  res.json(assessment);
});

// GET /assessments/:id/questions — devolve o framework JÁ FILTRADO pelo
// segmento e pelas condições de aplicabilidade da instituição.
assessmentsRouter.get("/:id/questions", async (req: Request, res: ExpressResponse) => {
  const framework = await getFilteredFrameworkForInstitution(req.params.institutionId);
  if (!framework) return res.status(404).json({ error: "Instituição não encontrada" });
  res.json(framework);
});

// GET /assessments/:id/responses — devolve todas as respostas já salvas
// desse assessment, pra UI pré-popular o formulário (retomar de onde parou).
assessmentsRouter.get("/:id/responses", async (req: Request, res: ExpressResponse) => {
  const responses = await prisma.response.findMany({
    where: { assessmentId: req.params.id },
    select: { questionId: true, rawValue: true },
  });
  res.json({ responses: responses.map((r) => ({ questionId: r.questionId, value: r.rawValue })) });
});

// PUT /assessments/:id/responses/:questionId — salva UMA resposta
// imediatamente. É a rota que a UI chama a cada resposta dada — garante que
// nada se perde mesmo se o cliente fechar a aba logo em seguida.
assessmentsRouter.put("/:id/responses/:questionId", async (req: Request, res: ExpressResponse) => {
  const { value } = req.body as { value: RawResponse["value"] };
  if (value === undefined) {
    return res.status(400).json({ error: "value é obrigatório" });
  }

  const framework = await getFilteredFrameworkForInstitution(req.params.institutionId);
  if (!framework) return res.status(404).json({ error: "Instituição não encontrada" });

  const question = findQuestionById(framework, req.params.questionId);
  if (!question) {
    return res.status(404).json({ error: "Pergunta não encontrada ou não aplicável a esta instituição" });
  }

  // Score normalizado de UMA resposta isolada (mesma regra do motor
  // completo, só que aplicada a uma única pergunta).
  let normalizedScore = 0;
  if (question.type === "METRIC" && question.metricConfig) {
    const { target, direction, worst } = question.metricConfig;
    const numeric = Number(value);
    const floor = worst ?? 0;
    normalizedScore =
      direction === "higher_is_better"
        ? Math.max(0, Math.min(100, ((numeric - floor) / (target - floor)) * 100))
        : Math.max(0, Math.min(100, ((floor - numeric) / (floor - target)) * 100));
  } else {
    const option = question.options?.find((o) => o.id === value);
    normalizedScore = option ? option.scoreValue : 0;
  }

  const assessmentId = req.params.id;
  await prisma.response.upsert({
    where: { assessmentId_questionId: { assessmentId, questionId: req.params.questionId } },
    update: { rawValue: value as any, normalizedScore, updatedAt: new Date() },
    create: { assessmentId, questionId: req.params.questionId, rawValue: value as any, normalizedScore },
  });

  res.json({ questionId: req.params.questionId, saved: true, savedAt: new Date().toISOString() });
});

// POST /assessments/:id/responses — upsert em lote + score recalculado com
// TODAS as respostas já salvas no banco (não só o payload deste request).
assessmentsRouter.post("/:id/responses", async (req: Request, res: ExpressResponse) => {
  const { responses } = req.body as { responses: RawResponse[] };
  if (!Array.isArray(responses)) {
    return res.status(400).json({ error: "responses deve ser um array" });
  }

  const framework = await getFilteredFrameworkForInstitution(req.params.institutionId);
  if (!framework) return res.status(404).json({ error: "Instituição não encontrada" });

  const assessmentId = req.params.id;
  const upserts = responses
    .map((r) => {
      const question = findQuestionById(framework, r.questionId);
      if (!question) return null;
      const option = question.options?.find((o) => o.id === r.value);
      const normalizedScore = option ? option.scoreValue : 0;
      return prisma.response.upsert({
        where: { assessmentId_questionId: { assessmentId, questionId: r.questionId } },
        update: { rawValue: r.value as any, normalizedScore, updatedAt: new Date() },
        create: { assessmentId, questionId: r.questionId, rawValue: r.value as any, normalizedScore },
      });
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  await prisma.$transaction(upserts);

  const allSaved = await prisma.response.findMany({ where: { assessmentId } });
  const rawResponses: RawResponse[] = allSaved.map((r) => ({ questionId: r.questionId, value: r.rawValue as any }));
  const result = calculateScore(framework, rawResponses);
  const recommendations = recommendServices(result.controlScores, result.maturityLevel);

  res.json({ ...result, recommendations });
});

// POST /assessments/:id/submit — fecha o ciclo: recalcula com tudo que está
// salvo no banco (ignora qualquer coisa que só exista em memória no
// navegador), congela o ScoreSnapshot, e marca o assessment como SUBMITTED.
assessmentsRouter.post("/:id/submit", async (req: Request, res: ExpressResponse) => {
  const assessmentId = req.params.id;

  const framework = await getFilteredFrameworkForInstitution(req.params.institutionId);
  if (!framework) return res.status(404).json({ error: "Instituição não encontrada" });

  const allSaved = await prisma.response.findMany({ where: { assessmentId } });
  const rawResponses: RawResponse[] = allSaved.map((r) => ({ questionId: r.questionId, value: r.rawValue as any }));
  const result = calculateScore(framework, rawResponses);
  const recommendations = recommendServices(result.controlScores, result.maturityLevel);

  const pillarCodeToDbId = await getPillarCodeToDbId();

  await prisma.$transaction(async (tx) => {
    await tx.assessment.update({
      where: { id: assessmentId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    const snapshot = await tx.scoreSnapshot.create({
      data: {
        assessmentId,
        overallScore: result.overallScore,
        maturityLevel: result.maturityLevel,
      },
    });

    await tx.pillarScore.createMany({
      data: result.pillarScores
        .filter((p) => pillarCodeToDbId[p.code]) // ignora pilar sem correspondente no banco (não deveria acontecer)
        .map((p) => ({
          snapshotId: snapshot.id,
          pillarId: pillarCodeToDbId[p.code],
          score: p.score,
          maturityLevel: p.maturityLevel,
        })),
    });
  });

  res.json({ status: "SUBMITTED", ...result, recommendations });
});
