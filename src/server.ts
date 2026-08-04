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
  })
);

app.use(express.json({ limit: "5mb" })); // limite maior por causa do bulk-import de respostas

app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok" }));

// /auth é a única rota pública — é justamente onde o token é emitido.
app.use("/auth", authRouter);

// Tudo abaixo daqui exige principal autenticado (Dock ou Instituição)
app.use(authenticate);

app.use("/assessments", assessmentsRouter);
app.use("/institutions", institutionsRouter);
app.use("/admin", adminRouter);

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Dock Trust Platform API rodando na porta ${PORT}`);
});
