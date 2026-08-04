import express from "express";
import { assessmentsRouter } from "./routes/assessments";
import { institutionsRouter } from "./routes/institutions";
import { adminRouter } from "./routes/admin";
import { authenticate } from "./middleware/auth";

const app = express();
app.use(express.json({ limit: "5mb" })); // limite maior por causa do bulk-import de respostas

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Tudo abaixo daqui exige principal autenticado (Dock ou Instituição)
app.use(authenticate);

app.use("/assessments", assessmentsRouter);
app.use("/institutions", institutionsRouter);
app.use("/admin", adminRouter);

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Dock Trust Platform API rodando na porta ${PORT}`);
});
