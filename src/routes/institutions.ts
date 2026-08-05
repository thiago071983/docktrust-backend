// ============================================================================
// Rotas de Instituição
// ============================================================================

import { Router, Request, Response as ExpressResponse } from "express";
import bcrypt from "bcryptjs";
import { requireInstitutionAccess, requireAnyDockUser, requireCanManageInstitutionUsers } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { prisma } from "../db";
import { dockTrustFrameworkV3 } from "../seed/frameworkSeedV3";
import { CLIENT_SEGMENTS } from "../seed/segmentsCatalog";
import { APPLICABILITY_CONDITIONS } from "../seed/conditionsCatalog";
import { countApplicableQuestions, filterFrameworkForInstitution } from "../scoring/applicability";
import { calculateScore } from "../scoring/engine";
import { parseImportPayload, matchImportEntries } from "../import/parseResponses";
import { RawResponse, InstitutionProfileDTO } from "../types/domain";
import { assessmentsRouter } from "./assessments";
import { buildTrendSeries, CycleSnapshotDTO } from "../scoring/compareCycles";

export const institutionsRouter = Router();

// Helper compartilhado — carrega o perfil de aplicabilidade real de uma
// instituição a partir do banco (nunca assume perfil vazio quando dá pra
// buscar de verdade).
async function loadInstitutionProfile(institutionId: string): Promise<InstitutionProfileDTO | null> {
  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) return null;
  return {
    segments: institution.segments,
    conditionFlags: (institution.applicabilityFlags as Record<string, boolean>) || {},
  };
}

// GET /institutions/segments — catálogo de segmentos (para a UI de
// onboarding renderizar os 16 códigos sem precisar hardcodar a lista).
institutionsRouter.get("/segments", requireAnyDockUser, (req: Request, res: ExpressResponse) => {
  res.json({ segments: CLIENT_SEGMENTS });
});

// GET /institutions/applicability-conditions — catálogo das 12 condições
// usadas pelas perguntas CONDITIONAL (idem, para renderizar o checklist).
institutionsRouter.get("/applicability-conditions", requireAnyDockUser, (req: Request, res: ExpressResponse) => {
  res.json({ conditions: APPLICABILITY_CONDITIONS });
});

// Todas as rotas de assessment de uma instituição (/questions, /responses,
// /submit) passam pelo mesmo guard: cliente só acessa a própria instituição,
// Dock acessa qualquer uma.
institutionsRouter.use(
  "/:institutionId/assessments",
  requireInstitutionAccess,
  assessmentsRouter
);

// GET /institutions/:institutionId/score-history — série histórica com
// deltas já calculados entre ciclos consecutivos (Trust Score Contínuo).
institutionsRouter.get(
  "/:institutionId/score-history",
  requireInstitutionAccess,
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const snapshots = await prisma.scoreSnapshot.findMany({
      where: { assessment: { institutionId: req.params.institutionId } },
      include: { assessment: true, pillarScores: { include: { pillar: true } } },
      orderBy: { createdAt: "asc" },
    });

    const snapshotsChronological: CycleSnapshotDTO[] = snapshots.map((snap) => ({
      id: snap.id,
      cycleLabel: snap.assessment.cycleLabel,
      frameworkId: snap.assessment.frameworkId,
      createdAt: snap.createdAt.toISOString(),
      overallScore: snap.overallScore,
      maturityLevel: snap.maturityLevel,
      pillarScores: snap.pillarScores.map((ps) => ({
        pillarId: ps.pillarId,
        code: ps.pillar.code,
        name: ps.pillar.name,
        score: ps.score,
        maturityLevel: ps.maturityLevel,
      })),
    }));

    const trend = buildTrendSeries(snapshotsChronological);
    res.json({ trend });
  })
);

// GET /institutions — só equipe Dock enxerga a lista completa de clientes.
institutionsRouter.get("/", requireAnyDockUser, asyncHandler(async (req: Request, res: ExpressResponse) => {
  const institutions = await prisma.institution.findMany({
    select: { id: true, name: true, segments: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ institutions });
}));

// POST /institutions — onboarding de um novo cliente. `initialAdmin` agora
// exige senha própria (autenticação real) — em versão futura isso vira um
// convite por e-mail com definição de senha pelo próprio usuário; por ora,
// a Dock define a senha inicial diretamente e repassa ao cliente.
institutionsRouter.post("/", requireAnyDockUser, asyncHandler(async (req: Request, res: ExpressResponse) => {
  const { name, segments, applicabilityFlags, initialAdmin } = req.body as {
    name: string;
    segments: string[];
    applicabilityFlags?: Record<string, boolean>;
    initialAdmin: { name: string; email: string; password: string };
  };

  if (!name || !initialAdmin?.name || !initialAdmin?.email || !initialAdmin?.password) {
    return res.status(400).json({ error: "name e initialAdmin (name, email, password) são obrigatórios" });
  }
  if (initialAdmin.password.length < 8) {
    return res.status(400).json({ error: "A senha do admin inicial precisa ter ao menos 8 caracteres" });
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: "segments é obrigatório — pelo menos um código do catálogo de segmentos" });
  }
  const validCodes = new Set(CLIENT_SEGMENTS.map((s) => s.code));
  const invalidCodes = segments.filter((s) => !validCodes.has(s));
  if (invalidCodes.length > 0) {
    return res.status(400).json({ error: `Segmento(s) inválido(s): ${invalidCodes.join(", ")}` });
  }

  const normalizedEmail = initialAdmin.email.trim().toLowerCase();
  const existing = await prisma.institutionUser.findFirst({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: "Já existe um usuário com esse e-mail" });
  }

  const passwordHash = await bcrypt.hash(initialAdmin.password, 10);

  const institution = await prisma.$transaction(async (tx) => {
    const created = await tx.institution.create({
      data: {
        name,
        segments,
        applicabilityFlags: applicabilityFlags ?? {},
      },
    });
    await tx.institutionUser.create({
      data: {
        institutionId: created.id,
        name: initialAdmin.name,
        email: normalizedEmail,
        role: "admin",
        passwordHash,
      },
    });
    return created;
  });

  const profile = { segments, conditionFlags: applicabilityFlags ?? {} };
  const applicableQuestionsCount = countApplicableQuestions(dockTrustFrameworkV3, profile);

  res.status(201).json({
    id: institution.id,
    name: institution.name,
    segments: institution.segments,
    applicabilityFlags: institution.applicabilityFlags,
    initialAdmin: { name: initialAdmin.name, email: normalizedEmail, role: "admin" },
    applicableQuestionsCount,
    totalQuestionsInFramework: 232,
  });
}));

// GET /institutions/:institutionId/users
institutionsRouter.get(
  "/:institutionId/users",
  requireInstitutionAccess,
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const users = await prisma.institutionUser.findMany({
      where: { institutionId: req.params.institutionId },
      select: { id: true, name: true, email: true, role: true }, // nunca devolve passwordHash
    });
    res.json({ users });
  })
);

// POST /institutions/:institutionId/users — inclui um novo usuário NAQUELA
// instituição. Agora exige senha própria (mesma observação do onboarding).
institutionsRouter.post(
  "/:institutionId/users",
  requireInstitutionAccess,
  requireCanManageInstitutionUsers,
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const { name, email, role, password } = req.body as {
      name: string;
      email: string;
      role?: string;
      password: string;
    };

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email e password são obrigatórios" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "A senha precisa ter ao menos 8 caracteres" });
    }
    const allowedRoles = ["admin", "executivo", "operacional"];
    const finalRole = role && allowedRoles.includes(role) ? role : "operacional";
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.institutionUser.findFirst({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: "Já existe um usuário com esse e-mail" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // institutionId vem do parâmetro de rota (já validado pelo
    // requireInstitutionAccess) — nunca do body, mesmo que o body venha
    // com outro institutionId.
    const user = await prisma.institutionUser.create({
      data: { institutionId: req.params.institutionId, name, email: normalizedEmail, role: finalRole, passwordHash },
    });

    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, institutionId: user.institutionId });
  })
);

// GET /institutions/:institutionId
institutionsRouter.get(
  "/:institutionId",
  requireInstitutionAccess,
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const institution = await prisma.institution.findUnique({ where: { id: req.params.institutionId } });
    if (!institution) return res.status(404).json({ error: "Instituição não encontrada" });
    res.json(institution);
  })
);

// POST /institutions/:institutionId/assessments/:assessmentId/responses/bulk-import
institutionsRouter.post(
  "/:institutionId/assessments/:assessmentId/responses/bulk-import",
  requireInstitutionAccess,
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const { fileContent, fileFormat } = req.body as { fileContent: string; fileFormat: "json" | "csv" };
    if (!fileContent || !fileFormat) {
      return res.status(400).json({ error: "fileContent e fileFormat são obrigatórios" });
    }

    let entries;
    try {
      entries = parseImportPayload(fileContent, fileFormat);
    } catch (err) {
      return res.status(400).json({ error: "Arquivo inválido — não foi possível fazer parse." });
    }

    const profile = await loadInstitutionProfile(req.params.institutionId);
    if (!profile) return res.status(404).json({ error: "Instituição não encontrada" });

    const institutionFramework = filterFrameworkForInstitution(dockTrustFrameworkV3, profile);
    const { matched, unmatched } = matchImportEntries(entries, institutionFramework);

    const assessmentId = req.params.assessmentId;
    await prisma.$transaction(
      matched.map((m) =>
        prisma.response.upsert({
          where: { assessmentId_questionId: { assessmentId, questionId: m.questionId } },
          update: { rawValue: m.optionId, normalizedScore: 0 }, // normalizado de verdade após recálculo abaixo
          create: { assessmentId, questionId: m.questionId, rawValue: m.optionId, normalizedScore: 0 },
        })
      )
    );

    const allResponses = await prisma.response.findMany({ where: { assessmentId } });
    const rawResponses: RawResponse[] = allResponses.map((r) => ({ questionId: r.questionId, value: r.rawValue as any }));
    const scoreResult = calculateScore(institutionFramework, rawResponses);

    res.json({
      importedCount: matched.length,
      unmatchedQuestionIds: unmatched,
      currentScore: scoreResult,
    });
  })
);
