import { Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 NÃO captura sozinho uma Promise rejeitada dentro de uma rota
// `async` — se `prisma.algumaCoisa()` lançar, a exceção vira uma unhandled
// rejection e pode derrubar o processo inteiro (é isso que causava os 502
// "aleatórios": não era CORS, era o servidor caindo no meio da requisição).
//
// Todo handler assíncrono deve ser envolvido nisto:
//   router.put("/rota", asyncHandler(async (req, res) => { ... }))
// Qualquer erro cai automaticamente no middleware de erro global (ver
// server.ts), que devolve um JSON 500 em vez de derrubar o servidor.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
