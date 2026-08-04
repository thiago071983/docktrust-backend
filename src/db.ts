import { PrismaClient } from "@prisma/client";

// Singleton — evita abrir uma conexão nova a cada import (comum em dev com
// hot-reload, e desnecessário em produção também).
export const prisma = new PrismaClient();
