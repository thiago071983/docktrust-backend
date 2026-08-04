// ============================================================================
// Autenticação e controle de acesso
// ============================================================================
// STUB DELIBERADO: a extração do token (JWT/sessão) não está implementada
// aqui — troque `extractPrincipal` pela integração real (ex: verificar JWT
// assinado, ou validar sessão contra SSO corporativo). O que importa e
// não deve mudar é o formato do `Principal` e onde as checagens acontecem.
//
// Regra de ouro: institutionId nunca vem "confiado" de req.params ou
// req.body quando o principal é um cliente. Ele vem do próprio principal.
// ============================================================================

import { Request, Response, NextFunction } from "express";

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

// Middleware base: resolve quem está fazendo a requisição.
// TODO: trocar pelo decode real do token de autenticação.
export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Exemplo de payload esperado no header, só para o protótipo funcionar
  // fim-a-fim sem um provedor de auth real ainda plugado:
  //   x-principal-type: "dock" | "institution"
  //   x-principal-id: <userId>
  //   x-institution-id: <institutionId>      (obrigatório se type=institution)
  //   x-dock-role: TRUST_ADMIN | TRUST_ANALYST | TRUST_VIEWER  (se type=dock)
  const type = req.header("x-principal-type");

  if (type === "dock") {
    req.principal = {
      type: "dock",
      userId: req.header("x-principal-id") || "unknown",
      dockRole: (req.header("x-dock-role") as any) || "TRUST_VIEWER",
    };
  } else if (type === "institution") {
    const institutionId = req.header("x-institution-id");
    if (!institutionId) {
      return res.status(401).json({ error: "institutionId ausente para principal do tipo institution" });
    }
    req.principal = {
      type: "institution",
      userId: req.header("x-principal-id") || "unknown",
      institutionId,
      institutionRole: req.header("x-institution-role") || "operacional",
    };
  } else {
    return res.status(401).json({ error: "Não autenticado" });
  }

  next();
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
