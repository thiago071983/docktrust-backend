// ============================================================================
// Autenticação — login em duas etapas (senha, depois código de verificação),
// espelhando o fluxo que já existe na tela de login do frontend.
// ============================================================================
// GAP CONHECIDO E DELIBERADO: o código de verificação não é enviado por
// e-mail/SMS ainda — isso depende de escolher um provedor (ex: Resend,
// Twilio) que ainda não foi decidido. Enquanto isso não existe:
// - o código é sempre logado no console do servidor;
// - em NODE_ENV !== "production", o código também volta na resposta da API,
//   só para permitir testar o fluxo completo sem depender de e-mail real.
// Isso NÃO deve ir para produção sem plugar um provedor de envio de verdade
// — do contrário o segundo fator não protege nada.
// ============================================================================

import { Router, Request, Response as ExpressResponse } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../db";
import { signToken, authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

export const authRouter = Router();

interface PendingLogin {
  otpCode: string;
  principal: Parameters<typeof signToken>[0];
  userSummary: Record<string, unknown>;
  expiresAt: number;
}

// Armazenamento em memória — suficiente para uma instância única (Railway
// free/hobby roda assim). Se escalar para múltiplas instâncias, isso precisa
// virar uma tabela no banco (ou Redis) para todas as instâncias verem o
// mesmo pending login.
const pendingLogins = new Map<string, PendingLogin>();

function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// POST /auth/login — verifica e-mail + senha. Se corretos, NÃO devolve o
// token ainda: gera um código de verificação e devolve um pendingToken, que
// o cliente troca pelo token real em /auth/verify-otp.
authRouter.post("/login", asyncHandler(async (req: Request, res: ExpressResponse) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "email e password são obrigatórios" });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const dockUser = await prisma.dockUser.findUnique({ where: { email: normalizedEmail } });
  if (dockUser) {
    const valid = await bcrypt.compare(password, dockUser.passwordHash);
    if (!valid) return res.status(401).json({ error: "Credenciais inválidas" });
    return startOtpChallenge(res, {
      principal: { type: "dock", userId: dockUser.id, dockRole: dockUser.role },
      userSummary: { id: dockUser.id, name: dockUser.name, email: dockUser.email, type: "dock", role: dockUser.role },
    });
  }

  const instUser = await prisma.institutionUser.findFirst({ where: { email: normalizedEmail } });
  if (instUser) {
    const valid = await bcrypt.compare(password, instUser.passwordHash);
    if (!valid) return res.status(401).json({ error: "Credenciais inválidas" });
    return startOtpChallenge(res, {
      principal: { type: "institution", userId: instUser.id, institutionId: instUser.institutionId, institutionRole: instUser.role },
      userSummary: {
        id: instUser.id,
        name: instUser.name,
        email: instUser.email,
        type: "institution",
        role: instUser.role,
        institutionId: instUser.institutionId,
      },
    });
  }

  // Mesma mensagem genérica pros dois casos (usuário não existe / senha
  // errada) — não dar pista de qual e-mail está ou não cadastrado.
  return res.status(401).json({ error: "Credenciais inválidas" });
}));

function startOtpChallenge(
  res: ExpressResponse,
  args: { principal: PendingLogin["principal"]; userSummary: PendingLogin["userSummary"] }
) {
  const pendingToken = crypto.randomUUID();
  const otpCode = generateOtp();

  pendingLogins.set(pendingToken, {
    otpCode,
    principal: args.principal,
    userSummary: args.userSummary,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutos
  });

  // TODO: enviar otpCode por e-mail/SMS assim que um provedor for escolhido.
  console.log(`[OTP] ${args.userSummary.email} -> código ${otpCode} (expira em 5min)`);

  const devFields = process.env.NODE_ENV !== "production" ? { devOtpCode: otpCode } : {};
  return res.json({ pendingToken, ...devFields });
}

// POST /auth/verify-otp — troca pendingToken + código pelo JWT real.
authRouter.post("/verify-otp", (req: Request, res: ExpressResponse) => {
  const { pendingToken, code } = req.body as { pendingToken?: string; code?: string };
  if (!pendingToken || !code) {
    return res.status(400).json({ error: "pendingToken e code são obrigatórios" });
  }

  const pending = pendingLogins.get(pendingToken);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingLogins.delete(pendingToken);
    return res.status(401).json({ error: "Login expirado — faça login novamente" });
  }
  if (pending.otpCode !== code) {
    return res.status(401).json({ error: "Código incorreto" });
  }

  pendingLogins.delete(pendingToken); // uso único
  const token = signToken(pending.principal);
  return res.json({ token, user: pending.userSummary });
});

// Limpeza periódica dos pending logins expirados (evita crescer sem limite
// num processo de vida longa).
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingLogins.entries()) {
    if (value.expiresAt < now) pendingLogins.delete(key);
  }
}, 60_000);

// PATCH /auth/password — o próprio usuário logado troca a própria senha.
// Rota fora do /auth público por padrão (authRouter é montado antes do
// authenticate global em server.ts) — por isso aplica authenticate aqui,
// direto nesta rota, pra saber quem está pedindo a troca.
authRouter.patch(
  "/password",
  authenticate,
  asyncHandler(async (req: Request, res: ExpressResponse) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword e newPassword são obrigatórios" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "A nova senha precisa ter ao menos 8 caracteres" });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: "A nova senha precisa ser diferente da atual" });
    }

    const principal = req.principal!; // authenticate já garantiu que existe

    if (principal.type === "dock") {
      const user = await prisma.dockUser.findUnique({ where: { id: principal.userId } });
      if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Senha atual incorreta" });
      const newHash = await bcrypt.hash(newPassword, 10);
      await prisma.dockUser.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    } else {
      const user = await prisma.institutionUser.findUnique({ where: { id: principal.userId } });
      if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Senha atual incorreta" });
      const newHash = await bcrypt.hash(newPassword, 10);
      await prisma.institutionUser.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    }

    res.json({ ok: true });
  })
);

