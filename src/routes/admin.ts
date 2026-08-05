// ============================================================================
// Rotas de Configuração (Admin)
// Criar/editar perguntas, opções de resposta e pesos do Dock Trust Framework.
// Toda rota aqui exige requireDockAdmin — cliente nunca acessa isso.
// ============================================================================

import { Router, Request, Response as ExpressResponse } from "express";
import { requireDockAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { prisma } from "../db";

export const adminRouter = Router();
adminRouter.use(requireDockAdmin);

// POST /admin/controls/:controlId/questions — cria uma nova pergunta com
// peso e opções de resposta (cada opção já com seu score 0-100).
adminRouter.post(
  "/controls/:controlId/questions",
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const { text, type, weight, options } = req.body as {
      text: string;
      type: string;
      weight?: number;
      options?: { label: string; score: number }[];
    };

    if (!text || !type) {
      return res.status(400).json({ error: "text e type são obrigatórios" });
    }
    if ((type === "MULTIPLE_CHOICE" || type === "MATURITY_SCALE") && (!options || options.length < 2)) {
      return res.status(400).json({ error: "Perguntas de múltipla escolha exigem ao menos 2 opções" });
    }

    // NOTA: isto edita o framework "in place" — se já existirem Assessments
    // SUBMITTED usando essa versão, o ideal a médio prazo é versionar
    // (criar uma nova Framework version) em vez de mutar a mesma. Fica
    // registrado como próximo passo, não bloqueia esta primeira versão.
    const lastQuestion = await prisma.question.findFirst({
      where: { controlId: req.params.controlId },
      orderBy: { order: "desc" },
    });
    const nextOrder = lastQuestion ? lastQuestion.order + 1 : 0;

    const question = await prisma.question.create({
      data: {
        controlId: req.params.controlId,
        text,
        type: type as any,
        weight: weight ?? 1,
        order: nextOrder,
        applicability: "UNIVERSAL",
        options: options
          ? {
              create: options.map((o, i) => ({ label: o.label, scoreValue: o.score, order: i })),
            }
          : undefined,
      },
      include: { options: true },
    });

    res.status(201).json(question);
  })
);

// PATCH /admin/questions/:questionId — editar peso/texto de uma pergunta
adminRouter.patch(
  "/questions/:questionId",
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const { weight, text } = req.body as { weight?: number; text?: string };

    const question = await prisma.question.update({
      where: { id: req.params.questionId },
      data: {
        ...(weight !== undefined ? { weight } : {}),
        ...(text !== undefined ? { text } : {}),
      },
    });
    res.json(question);
  })
);

// PATCH /admin/questions/:questionId/options/:optionId — editar score de uma opção
adminRouter.patch(
  "/questions/:questionId/options/:optionId",
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const { score, label } = req.body as { score?: number; label?: string };

    if (score !== undefined && (score < 0 || score > 100)) {
      return res.status(400).json({ error: "score deve estar entre 0 e 100" });
    }

    const option = await prisma.questionOption.update({
      where: { id: req.params.optionId },
      data: {
        ...(score !== undefined ? { scoreValue: score } : {}),
        ...(label !== undefined ? { label } : {}),
      },
    });
    res.json(option);
  })
);

// POST /admin/questions/:questionId/options — adicionar nova opção a uma pergunta existente
adminRouter.post(
  "/questions/:questionId/options",
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const { label, score } = req.body as { label: string; score: number };

    if (!label || score === undefined) {
      return res.status(400).json({ error: "label e score são obrigatórios" });
    }

    const lastOption = await prisma.questionOption.findFirst({
      where: { questionId: req.params.questionId },
      orderBy: { order: "desc" },
    });
    const nextOrder = lastOption ? lastOption.order + 1 : 0;

    const option = await prisma.questionOption.create({
      data: { questionId: req.params.questionId, label, scoreValue: score, order: nextOrder },
    });
    res.status(201).json(option);
  })
);

// DELETE /admin/questions/:questionId
adminRouter.delete(
  "/questions/:questionId",
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    // Se já existem Response reais apontando pra essa Question (assessments
    // em andamento ou enviados), apagar quebraria a integridade referencial
    // — nesse caso, recusamos e pedimos confirmação explícita em vez de
    // apagar respostas de cliente silenciosamente.
    const responseCount = await prisma.response.count({ where: { questionId: req.params.questionId } });
    if (responseCount > 0) {
      return res.status(409).json({
        error: `Esta pergunta já tem ${responseCount} resposta(s) registrada(s) — não é possível excluir sem afetar dados de cliente.`,
      });
    }

    await prisma.questionOption.deleteMany({ where: { questionId: req.params.questionId } });
    await prisma.question.delete({ where: { id: req.params.questionId } });
    res.status(204).send();
  })
);
