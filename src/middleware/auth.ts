// ============================================================================
// Autenticação e controle de acesso
// ============================================================================
// O login real (senha + bcrypt) mora em routes/auth.ts, que emite um JWT.
// Este middleware só verifica a assinatura desse token e reconstrói o
// Principal a partir do payload — nunca confia em nada que o cliente envie
// fora do token assinado.
//
// Regra de ouro: institutionId nunca vem "confiado" de req.params ou
// req.body quando o principal é um cliente. Ele vem do próprio principal
// (que por sua vez vem do token, assinado pelo servidor no login).
// ============================================================================

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Falha alto e rápido — rodar sem segredo configurado é pior que não rodar.
  throw new Error("JWT_SECRET não configurado. Defina a variável de ambiente antes de iniciar o servidor.");
}

export type Principal =
  | { type: "dock"; userId: string; dockRole: "TRUST_ADMIN" | "TRUST_ANALYST" | "TRUST_VIEWER" }
  | { type: "institution"; userId: string; institutionId: string; institutionRole: string };

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}

export function signToken(principal: Principal): string {
  return jwt.sign(principal, JWT_SECRET!, { expiresIn: "12h" });
}

// Middleware base: resolve quem está fazendo a requisição a partir do JWT
// enviado em "Authorization: Bearer <token>". Token inválido/expirado = 401.
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET!) as Principal;
    req.principal = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

// Garante que o institutionId sendo acessado (via :institutionId na rota)
// é permitido para este principal. Para DockUser, qualquer institutionId
// passa. Para InstitutionUser, só o próprio.
export function requireInstitutionAccess(req: Request, res: Response, next: NextFunction) {
  const requestedInstitutionId = req.params.institutionId;

  if (!req.principal) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  if (req.principal.type === "dock") {
    return next(); // Dock pode acessar qualquer instituição
  }

  if (req.principal.institutionId !== requestedInstitutionId) {
    // Não vazar se a instituição existe ou não — 403 genérico
    return res.status(403).json({ error: "Acesso não permitido a esta instituição" });
  }

  next();
}

// Restringe a rotas de configuração do framework — só TRUST_ADMIN.
export function requireDockAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.principal || req.principal.type !== "dock" || req.principal.dockRole !== "TRUST_ADMIN") {
    return res.status(403).json({ error: "Apenas administradores Dock Trust podem configurar o framework" });
  }
  next();
}

// Qualquer usuário Dock (admin, analyst ou viewer) — para telas de leitura
// multi-instituição, como o seletor de cliente.
export function requireAnyDockUser(req: Request, res: Response, next: NextFunction) {
  if (!req.principal || req.principal.type !== "dock") {
    return res.status(403).json({ error: "Rota restrita à equipe Dock Trust" });
  }
  next();
}

// Gestão de usuários de uma instituição: a própria Dock (suporte/onboarding)
// ou o admin DAQUELA instituição — nunca um usuário operacional do cliente,
// e nunca o admin de uma instituição tentando mexer em outra (isso já é
// barrado por requireInstitutionAccess, que deve rodar antes deste).
export function requireCanManageInstitutionUsers(req: Request, res: Response, next: NextFunction) {
  if (!req.principal) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (req.principal.type === "dock") return next();
  if (req.principal.type === "institution" && req.principal.institutionRole === "admin") return next();

  return res.status(403).json({ error: "Apenas o administrador da instituição pode gerenciar usuários" });
}
