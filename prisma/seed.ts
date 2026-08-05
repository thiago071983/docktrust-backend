// ============================================================================
// Seed do banco — roda uma vez após `prisma migrate deploy`:
//   npx prisma db seed
// (ou automaticamente, se configurado em package.json -> "prisma.seed")
//
// Popula: catálogo de serviços, o Dock Trust Framework v3 completo (232
// perguntas geradas da planilha oficial), um DockUser de demonstração e uma
// Institution de demonstração com seu próprio usuário — as MESMAS
// credenciais que já existiam na tela de login fake do frontend, agora
// validadas de verdade contra o banco.
// ============================================================================

import { PrismaClient, QuestionType, ApplicabilityType } from "@prisma/client";
import bcrypt from "bcryptjs";
import frameworkData from "../src/seed/data/frameworkV3.json";
import { TRUST_SERVICES } from "../src/seed/servicesCatalog";

const prisma = new PrismaClient();

const PILLAR_DESCRIPTIONS: Record<string, string> = {
  T1: "A organização possui governança, estratégia e cultura para confiança.",
  R: "A operação é resiliente, contínua e preparada para ameaças e falhas.",
  U: "A instituição protege o ciclo financeiro de ponta a ponta contra fraude, crime financeiro e abuso.",
  S: "Plataformas e serviços digitais seguros por design, com privacidade e proteção de dados.",
  T2: "A confiança se estende ao ecossistema e é fortalecida pela colaboração.",
};

const DEMO_PASSWORD = "DemoTrust";

async function main() {
  console.log("Seed iniciado...\n");

  // 1. Catálogo de serviços (recomendações do score)
  for (const service of TRUST_SERVICES) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: { name: service.name, pitch: service.pitch, bullets: service.bullets },
      create: { id: service.id, name: service.name, pitch: service.pitch, bullets: service.bullets },
    });
  }
  console.log(`✓ ${TRUST_SERVICES.length} serviços cadastrados`);

  // 2. Framework v3 — se já existe, NÃO mexe. A correção de IDs (bug
  // histórico, já resolvido) rodou uma vez com sucesso; manter a lógica de
  // "apagar e recriar a cada deploy" pararia de funcionar assim que existir
  // qualquer Assessment real apontando pro framework (a FK entre Assessment
  // e Framework é RESTRICT — o Postgres corretamente recusa apagar algo
  // referenciado). Se um bug de schema/dados aparecer de novo no futuro,
  // a correção correta é uma migração específica, não apagar tudo aqui.
  const existingFramework = await prisma.framework.findFirst({ where: { version: "3.0" } });
  if (existingFramework) {
    console.log("✓ Framework v3.0 já existe — pulando (schema/dados já corretos)");
  } else {
    const framework = await prisma.framework.create({
      data: { name: "Dock Trust Framework", version: "3.0", isActive: true },
    });

    let pillarOrder = 0;
    let totalQuestions = 0;

    for (const pillar of frameworkData.pillars as any[]) {
      const pillarRecord = await prisma.pillar.create({
        data: {
          id: pillar.id, // ID original do JSON — não deixar o Prisma gerar um novo
          frameworkId: framework.id,
          code: pillar.code,
          name: pillar.name,
          description: PILLAR_DESCRIPTIONS[pillar.code] || pillar.name,
          colorHex: pillar.color,
          weight: pillar.weight,
          order: pillarOrder++,
        },
      });

      let controlOrder = 0;
      for (const control of pillar.controls) {
        const controlRecord = await prisma.control.create({
          data: {
            id: control.id, // idem — ID original do JSON
            pillarId: pillarRecord.id,
            name: control.name,
            weight: control.weight,
            order: controlOrder++,
            recommendedServiceId: control.recommendedServiceId || null,
          },
        });

        let questionOrder = 0;
        for (const question of control.questions) {
          const questionRecord = await prisma.question.create({
            data: {
              // CRÍTICO: usar o mesmo ID que o framework em memória usa
              // (src/seed/frameworkSeedV3.ts) — é esse ID que o frontend
              // envia de volta em Response.questionId. Se o Prisma gerar um
              // cuid novo aqui em vez de reaproveitar este, toda resposta
              // salva falha silenciosamente por violar a foreign key.
              id: question.id,
              controlId: controlRecord.id,
              text: question.text,
              type: question.type === "METRIC" ? QuestionType.METRIC : QuestionType.MULTIPLE_CHOICE,
              weight: question.weight,
              order: questionOrder++,
              regulatoryRefs: question.regulatoryRefs || [],
              applicability: (question.applicability || "UNIVERSAL") as ApplicabilityType,
              applicableSegments: question.applicableSegments || [],
              conditionKey: question.conditionKey || null,
              metricSource: question.metricSource || null,
              metricConfig: question.metricConfig || undefined,
            },
          });
          totalQuestions++;

          if (question.options) {
            let optOrder = 0;
            for (const opt of question.options) {
              await prisma.questionOption.create({
                data: {
                  questionId: questionRecord.id,
                  label: opt.label,
                  scoreValue: opt.score,
                  order: optOrder++,
                },
              });
            }
          }
        }
      }
      console.log(`✓ Pilar ${pillar.code} (${pillar.name}): ${pillar.controls.length} controles`);
    }
    console.log(`✓ Framework v3.0 completo: ${totalQuestions} perguntas`);
  }

  // 3. DockUser de demonstração — mesma credencial que já existia na tela
  // de login fake: demo@docktrust.co / DemoTrust (agora validada de verdade)
  const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.dockUser.upsert({
    where: { email: "demo@docktrust.co" },
    update: {},
    create: {
      email: "demo@docktrust.co",
      name: "Demo Dock Trust",
      role: "TRUST_ADMIN",
      passwordHash: demoPasswordHash,
    },
  });
  console.log("\n✓ DockUser demo@docktrust.co (senha: DemoTrust)");

  // 4. Institution de demonstração + usuário do lado do cliente — cobre o
  // caminho "institution" do middleware de acesso, não só o "dock".
  const existingDemoInstitution = await prisma.institution.findFirst({ where: { name: "Dock Demo" } });
  if (existingDemoInstitution) {
    console.log("✓ Institution 'Dock Demo' já existe — pulando");
  } else {
    const conditionKeys = [
      "USES_THIRD_PARTIES", "SUBJECT_TO_AML_CFT", "HAS_CUSTOMER_RELATIONSHIP", "DEVELOPS_SOFTWARE",
      "PROCESSES_TRANSACTIONS", "PROCESSES_PERSONAL_DATA", "USES_AI", "USES_OR_EXPOSES_APIS",
      "OFFERS_DIGITAL_CHANNELS", "OPERATES_PIX", "USES_CLOUD", "HAS_INTERNAL_AUDIT",
    ];
    const demoInstitution = await prisma.institution.create({
      data: {
        name: "Dock Demo",
        segments: ["BDG"],
        applicabilityFlags: Object.fromEntries(conditionKeys.map((k) => [k, true])),
      },
    });

    await prisma.institutionUser.create({
      data: {
        institutionId: demoInstitution.id,
        email: "cliente@dockdemo.com",
        name: "Cliente Demo",
        role: "admin",
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      },
    });
    console.log("✓ Institution 'Dock Demo' + InstitutionUser cliente@dockdemo.com (senha: DemoTrust)");
  }

  console.log("\nSeed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
