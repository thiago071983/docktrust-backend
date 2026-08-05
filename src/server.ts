import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import { assessmentsRouter } from "./routes/assessments";
import { institutionsRouter } from "./routes/institutions";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { authenticate } from "./middleware/auth";

const app = express();

// CORS — só os domínios explicitamente permitidos podem chamar essa API.
// CORS_ALLOWED_ORIGINS é uma lista separada por vírgula (ex:
// "https://docktrust.co,https://www.docktrust.co,http://localhost:5173").
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o: string) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Responde explicitamente ao preflight (OPTIONS) pra qualquer rota — reforço
// deliberado: o middleware `cors` acima já deveria cobrir isso sozinho, mas
// alguns provedores/proxies na frente da API tratam OPTIONS de forma
// diferente, e um PUT/DELETE sem resposta correta de preflight aparece pro
// navegador como falha de rede genérica, não como um erro de CORS claro.
app.options("*", cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json({ limit: "5mb" })); // limite maior por causa do bulk-import de respostas

app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok" }));

// /auth é a única rota pública — é justamente onde o token é emitido.
app.use("/auth", authRouter);

// Tudo abaixo daqui exige principal autenticado (Dock ou Instituição)
app.use(authenticate);

app.use("/assessments", assessmentsRouter);
app.use("/institutions", institutionsRouter);
app.use("/admin", adminRouter);

// Middleware de erro — precisa ser o ÚLTIMO `app.use`. Com o asyncHandler
// envolvendo toda rota assíncrona, qualquer exceção (erro do Prisma, bug,
// o que for) cai aqui em vez de derrubar o processo. Antes disso existir,
// um erro dentro de uma rota async virava uma unhandled rejection e o
// Railway reportava isso como 502 (o navegador então via isso como falha
// de CORS, já que a resposta de erro genérica do proxy não tem os headers
// de CORS que o Express normalmente adicionaria).
app.use((err: any, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error("Erro não tratado numa rota:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Erro interno no servidor. Tente novamente em instantes." });
});

// Rede de segurança adicional a nível de processo — loga em vez de deixar
// o Node matar o processo silenciosamente numa promise rejeitada que
// escapou de todo o resto (não deveria acontecer mais, com o asyncHandler
// em todo lugar, mas é barato manter como última linha de defesa).
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Dock Trust Platform API rodando na porta ${PORT}`);
});
