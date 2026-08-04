// ============================================================================
// Rotas de Configuração (Admin)
// Criar/editar perguntas, opções de resposta e pesos do Dock Trust Framework.
// Toda rota aqui exige requireDockAdmin — cliente nunca acessa isso.
// ============================================================================

import { Router, Request, Response as ExpressResponse } from "express";
import { requireDockAdmin } from "../middleware/auth";

export const adminRouter = Router();
adminRouter.use(requireDockAdmin);

// POST /admin/controls/:controlId/questions — cria uma nova pergunta com
// peso e opções de resposta (cada opção já com seu score 0-100).
adminRouter.post("/controls/:controlId/questions", (req: Request, res: ExpressResponse) => {
  const { text, type, weight, options } = req.body as {
    text: string;
    type: string;
    weight?: number;
    options?: { label: string; scoreValue: number }[];
  };

  if (!text || !type) {
    return res.status(400).json({ error: "text e type são obrigatórios" });
  }
  if ((type === "MULTIPLE_CHOICE" || type === "MATURITY_SCALE") && (!options || options.length < 2)) {
    return res.status(400).json({ error: "Perguntas de múltipla escolha exigem ao menos 2 opções" });
  }

  // TODO: Prisma — criar Question vinculada a controlId, e cada option
  // como QuestionOption. IMPORTANTE: se o framework já tem assessments
  // SUBMITTED usando essa versão, considere versionar (nova Framework
  // version) em vez de mutar in-place — ver decisão de arquitetura no README.

  res.status(201).json({
    id: `q-${Date.now()}`,
    text,
    type,
    weight: weight ?? 1,
    options,
  });
});

// PATCH /admin/questions/:questionId — editar peso de uma pergunta
adminRouter.patch("/questions/:questionId", (req: Request, res: ExpressResponse) => {
  const { weight, text } = req.body as { weight?: number; text?: string };

  // TODO: Prisma — UPDATE Question SET weight = ?, text = ? WHERE id = ?
  res.json({ id: req.params.questionId, weight, text });
});

// PATCH /admin/questions/:questionId/options/:optionId — editar score de uma opção
adminRouter.patch(
  "/questions/:questionId/options/:optionId",
  (req: Request, res: ExpressResponse) => {
    const { scoreValue, label } = req.body as { scoreValue?: number; label?: string };

    if (scoreValue !== undefined && (scoreValue < 0 || scoreValue > 100)) {
      return res.status(400).json({ error: "scoreValue deve estar entre 0 e 100" });
    }

    // TODO: Prisma — UPDATE QuestionOption SET scoreValue = ?, label = ? WHERE id = ?
    res.json({ id: req.params.optionId, scoreValue, label });
  }
);

// POST /admin/questions/:questionId/options — adicionar nova opção a uma pergunta existente
adminRouter.post("/questions/:questionId/options", (req: Request, res: ExpressResponse) => {
  const { label, scoreValue } = req.body as { label: string; scoreValue: number };

  if (!label || scoreValue === undefined) {
    return res.status(400).json({ error: "label e scoreValue são obrigatórios" });
  }

  // TODO: Prisma — criar QuestionOption vinculada a questionId
  res.status(201).json({ id: `o-${Date.now()}`, label, scoreValue });
});

// DELETE /admin/questions/:questionId
adminRouter.delete("/questions/:questionId", (req: Request, res: ExpressResponse) => {
  // TODO: Prisma — cuidado: se já existem Response apontando pra essa
  // Question em assessments SUBMITTED, considere soft-delete (campo
  // `archivedAt`) em vez de excluir de fato, pra não perder o histórico.
  res.status(204).send();
});
