// ============================================================================
// Rotas de Instituição
// ============================================================================

import { Router, Request, Response as ExpressResponse } from "express";
import { requireInstitutionAccess, requireAnyDockUser, requireCanManageInstitutionUsers } from "../middleware/auth";
import { dockTrustFrameworkV3 } from "../seed/frameworkSeedV3";
import { CLIENT_SEGMENTS } from "../seed/segmentsCatalog";
import { APPLICABILITY_CONDITIONS } from "../seed/conditionsCatalog";
import { countApplicableQuestions, filterFrameworkForInstitution } from "../scoring/applicability";
import { calculateScore } from "../scoring/engine";
import { parseImportPayload, matchImportEntries } from "../import/parseResponses";
import { RawResponse } from "../types/domain";
import { assessmentsRouter } from "./assessments";
import { buildTrendSeries, CycleSnapshotDTO } from "../scoring/compareCycles";

export const institutionsRouter = Router();

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
// Dock acessa qualquer uma. Isso substitui o mount solto que existia antes
// em /assessments — agora o institutionId sempre faz parte da rota e é
// sempre validado antes de qualquer handler rodar.
institutionsRouter.use(
  "/:institutionId/assessments",
  requireInstitutionAccess,
  assessmentsRouter
);

// GET /institutions/:institutionId/score-history — série histórica com
// deltas já calculados entre ciclos consecutivos (Trust Score Contínuo).
// Já protegido pelo guard aplicado acima em todas as rotas de :institutionId.
institutionsRouter.get(
  "/:institutionId/score-history",
  requireInstitutionAccess,
  (req: Request, res: ExpressResponse) => {
    // TODO: Prisma — SELECT ScoreSnapshot join Assessment (para cycleLabel
    // e frameworkId) WHERE institutionId = :institutionId ORDER BY createdAt ASC.
    // Mapear para CycleSnapshotDTO[] e passar para buildTrendSeries.
    const snapshotsChronological: CycleSnapshotDTO[] = [];

    const trend = buildTrendSeries(snapshotsChronological);
    res.json({ trend });
  }
);

// GET /institutions — só equipe Dock enxerga a lista completa de clientes
// (é o que alimenta o seletor de instituição no topo da aplicação).
institutionsRouter.get("/", requireAnyDockUser, (req: Request, res: ExpressResponse) => {
  // TODO: Prisma — SELECT id, name, segment FROM Institution
  res.json({ institutions: [] });
});

// POST /institutions — onboarding de um novo cliente. Só a equipe Dock cria
// instituições; o corpo já inclui os dados do primeiro usuário admin do
// cliente, porque uma instituição sem nenhum admin é um estado inválido
// (ninguém do lado do cliente conseguiria nem convidar os próprios colegas).
//
// `segments` é obrigatório e validado contra o catálogo real (16 códigos —
// ver src/seed/segmentsCatalog.ts) porque é isso que determina quais das
// 232 perguntas do framework entram no assessment dessa instituição
// (perguntas do tipo SEGMENTED). `applicabilityFlags` é opcional aqui — se
// não vier, todas as perguntas CONDITIONAL ficam de fora até alguém
// (Dock ou o próprio admin do cliente) preencher o perfil de aplicabilidade
// depois, numa tela dedicada.
institutionsRouter.post("/", requireAnyDockUser, (req: Request, res: ExpressResponse) => {
  const { name, segments, applicabilityFlags, initialAdmin } = req.body as {
    name: string;
    segments: string[];
    applicabilityFlags?: Record<string, boolean>;
    initialAdmin: { name: string; email: string };
  };

  if (!name || !initialAdmin?.name || !initialAdmin?.email) {
    return res.status(400).json({ error: "name e initialAdmin (name, email) são obrigatórios" });
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({ error: "segments é obrigatório — pelo menos um código do catálogo de segmentos" });
  }
  const validCodes = new Set(CLIENT_SEGMENTS.map((s) => s.code));
  const invalidCodes = segments.filter((s) => !validCodes.has(s));
  if (invalidCodes.length > 0) {
    return res.status(400).json({ error: `Segmento(s) inválido(s): ${invalidCodes.join(", ")}` });
  }

  // TODO: Prisma — dentro de uma transação:
  // 1. criar Institution { name, segments, applicabilityFlags: applicabilityFlags ?? {} }
  // 2. criar InstitutionUser { institutionId, name: initialAdmin.name,
  //    email: initialAdmin.email, role: "admin" }
  // 3. disparar e-mail de convite/definição de senha para initialAdmin.email
  //    (fora do escopo deste scaffold — provedor de e-mail ainda não plugado)

  const profile = { segments, conditionFlags: applicabilityFlags ?? {} };
  const applicableQuestionsCount = countApplicableQuestions(dockTrustFrameworkV3, profile);

  res.status(201).json({
    id: `inst-${Date.now()}`,
    name,
    segments,
    applicabilityFlags: applicabilityFlags ?? {},
    initialAdmin: { ...initialAdmin, role: "admin" },
    // Prévia útil pra UI de onboarding mostrar antes de confirmar: "essa
    // instituição vai responder X das 232 perguntas do framework".
    applicableQuestionsCount,
    totalQuestionsInFramework: 232,
  });
});

// GET /institutions/:institutionId/users — lista os usuários da instituição.
// Dock vê para dar suporte; o cliente só vê os da própria instituição
// (garantido pelo requireInstitutionAccess, que já validou o :institutionId).
institutionsRouter.get(
  "/:institutionId/users",
  requireInstitutionAccess,
  (req: Request, res: ExpressResponse) => {
    // TODO: Prisma — SELECT * FROM InstitutionUser WHERE institutionId = :institutionId
    res.json({ users: [] });
  }
);

// POST /institutions/:institutionId/users — cria um novo usuário NAQUELA
// instituição. Depois do onboarding inicial (feito pela Dock via
// POST /institutions), é isso que permite ao admin do próprio cliente
// incluir colegas sem depender da Dock — mas só o admin do cliente (ou a
// Dock, para suporte) pode chamar essa rota; um usuário "operacional" não
// consegue, mesmo sendo da mesma instituição.
institutionsRouter.post(
  "/:institutionId/users",
  requireInstitutionAccess,
  requireCanManageInstitutionUsers,
  (req: Request, res: ExpressResponse) => {
    const { name, email, role } = req.body as { name: string; email: string; role?: string };

    if (!name || !email) {
      return res.status(400).json({ error: "name e email são obrigatórios" });
    }
    const allowedRoles = ["admin", "executivo", "operacional"];
    const finalRole = role && allowedRoles.includes(role) ? role : "operacional";

    // TODO: Prisma — criar InstitutionUser { institutionId: req.params.institutionId,
    // name, email, role: finalRole }. institutionId vem do parâmetro de rota,
    // que já foi validado pelo requireInstitutionAccess — não do body, mesmo
    // que o body venha com outro institutionId (nunca confiar nisso).

    res.status(201).json({ id: `user-${Date.now()}`, name, email, role: finalRole, institutionId: req.params.institutionId });
  }
);

// GET /institutions/:institutionId — protegido: cliente só acessa a própria.
institutionsRouter.get(
  "/:institutionId",
  requireInstitutionAccess,
  (req: Request, res: ExpressResponse) => {
    // TODO: Prisma — buscar Institution por id (já validado pelo middleware)
    res.json({ id: req.params.institutionId });
  }
);

// POST /institutions/:institutionId/assessments/:assessmentId/responses/bulk-import
// Recebe um arquivo (JSON ou CSV) com respostas em lote — alternativa a
// responder pergunta por pergunta na UI. Usado por instituições que já têm
// as respostas estruturadas internamente (ex: outro sistema de compliance).
institutionsRouter.post(
  "/:institutionId/assessments/:assessmentId/responses/bulk-import",
  requireInstitutionAccess,
  (req: Request, res: ExpressResponse) => {
    const { fileContent, fileFormat } = req.body as {
      fileContent: string;
      fileFormat: "json" | "csv";
    };

    if (!fileContent || !fileFormat) {
      return res.status(400).json({ error: "fileContent e fileFormat são obrigatórios" });
    }

    let entries;
    try {
      entries = parseImportPayload(fileContent, fileFormat);
    } catch (err) {
      return res.status(400).json({ error: "Arquivo inválido — não foi possível fazer parse." });
    }

    // TODO: Prisma — buscar segments/applicabilityFlags reais da Institution
    // (req.params.institutionId) — por ora, perfil vazio (filtro conservador,
    // ver comentário em assessments.ts:loadInstitutionProfileStub)
    const institutionFramework = filterFrameworkForInstitution(dockTrustFrameworkV3, { segments: [], conditionFlags: {} });
    const { matched, unmatched } = matchImportEntries(entries, institutionFramework);

    // TODO: Prisma — dentro de uma transação, upsert de Response para cada
    // item em `matched` (assessmentId + questionId, gravando o optionId
    // escolhido e recalculando normalizedScore)

    const responses: RawResponse[] = matched.map((m) => ({
      questionId: m.questionId,
      value: m.optionId,
    }));
    const scoreResult = calculateScore(institutionFramework, responses);

    res.json({
      importedCount: matched.length,
      unmatchedQuestionIds: unmatched,
      currentScore: scoreResult,
    });
  }
);
