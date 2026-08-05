// ============================================================================
// Seed do banco — roda uma vez após `prisma migrate deploy`/`db push`:
//   npx prisma db seed
// (ou automaticamente, se configurado em package.json -> "prisma.seed")
//
// Popula: catálogo de serviços, o Dock Trust Framework v3 completo (232
// perguntas geradas da planilha oficial), e a conta administradora inicial
// (admin@docktrust.co — senha vem de INITIAL_ADMIN_PASSWORD, variável de
// ambiente). Ambiente de produção: nenhuma instituição fictícia é criada —
// se uma "Dock Demo" existir de uma fase anterior, este script a remove.
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

// A senha do admin inicial agora vem de variável de ambiente (ver bloco
// abaixo) — não fica mais escrita no código-fonte, diferente da fase de
// demonstração.

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

  // 2. Framework v3 — verifica de verdade se os IDs estão corretos (não só
  // "existe, então tá bom"). O jeito de verificar: uma pergunta específica
  // que sabemos o ID exato no JSON-fonte (tg-001) precisa existir com ESSE
  // id na tabela Question. Se não existir, é o bug antigo (Prisma gerou
  // IDs próprios em vez de usar os do JSON) — reconstrói tudo, dessa vez
  // limpando em cascata TAMBÉM Assessment/Response/ScoreSnapshot/PillarScore
  // associados (não só Pillar/Control/Question/Option), porque foi
  // exatamente a FK de Assessment que travou a última tentativa de
  // reconstrução. Se os IDs já estiverem certos, não toca em nada.
  const existingFramework = await prisma.framework.findFirst({ where: { version: "3.0" } });
  const idsAreCorrect = existingFramework
    ? Boolean(await prisma.question.findUnique({ where: { id: "tg-001" } }))
    : false;

  if (existingFramework && idsAreCorrect) {
    console.log("✓ Framework v3.0 já existe e os IDs estão corretos — pulando");
  } else {
    if (existingFramework && !idsAreCorrect) {
      console.log("Framework v3.0 existe mas com IDs incorretos (bug antigo) — reconstruindo do zero...");
      const frameworkId = existingFramework.id;
      await prisma.pillarScore.deleteMany({ where: { snapshot: { assessment: { frameworkId } } } });
      await prisma.scoreSnapshot.deleteMany({ where: { assessment: { frameworkId } } });
      await prisma.response.deleteMany({ where: { assessment: { frameworkId } } });
      await prisma.assessment.deleteMany({ where: { frameworkId } });
      await prisma.questionOption.deleteMany({ where: { question: { control: { pillar: { frameworkId } } } } });
      await prisma.question.deleteMany({ where: { control: { pillar: { frameworkId } } } });
      await prisma.control.deleteMany({ where: { pillar: { frameworkId } } });
      await prisma.pillar.deleteMany({ where: { frameworkId } });
      await prisma.framework.delete({ where: { id: frameworkId } });
      console.log("✓ Framework antigo removido (inclusive assessments de teste associados)");
    }

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

  // 3. DockUser administrador — em produção, a senha inicial vem de uma
  // variável de ambiente (INITIAL_ADMIN_PASSWORD), nunca escrita aqui no
  // código. Se uma conta antiga demo@docktrust.co existir (de antes desta
  // limpeza), ela é renomeada para a identidade de produção em vez de
  // deixar duas contas soltas.
  const ADMIN_EMAIL = "admin@docktrust.co";
  const ADMIN_NAME = "Administrador Dock Trust";
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD não configurada. Defina essa variável de ambiente (a senha inicial da conta admin@docktrust.co) antes de rodar o seed em produção."
    );
  }
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const legacyDemoUser = await prisma.dockUser.findUnique({ where: { email: "demo@docktrust.co" } });
  if (legacyDemoUser) {
    await prisma.dockUser.update({
      where: { id: legacyDemoUser.id },
      data: { email: ADMIN_EMAIL, name: ADMIN_NAME, passwordHash: adminPasswordHash },
    });
    console.log(`\n✓ Conta demo@docktrust.co renomeada para ${ADMIN_EMAIL}`);
  } else {
    await prisma.dockUser.upsert({
      where: { email: ADMIN_EMAIL },
      update: { passwordHash: adminPasswordHash },
      create: { email: ADMIN_EMAIL, name: ADMIN_NAME, role: "TRUST_ADMIN", passwordHash: adminPasswordHash },
    });
    console.log(`\n✓ DockUser ${ADMIN_EMAIL} pronto`);
  }

  // 4. Ambiente de produção não deve ter instituição fictícia — remove a
  // "Dock Demo" (e tudo que dependia dela: usuários, assessments,
  // respostas, snapshots) se ela ainda existir de uma fase anterior.
  const demoInstitution = await prisma.institution.findFirst({ where: { name: "Dock Demo" } });
  if (demoInstitution) {
    const instId = demoInstitution.id;
    await prisma.pillarScore.deleteMany({ where: { snapshot: { assessment: { institutionId: instId } } } });
    await prisma.scoreSnapshot.deleteMany({ where: { assessment: { institutionId: instId } } });
    await prisma.response.deleteMany({ where: { assessment: { institutionId: instId } } });
    await prisma.assessment.deleteMany({ where: { institutionId: instId } });
    await prisma.institutionUser.deleteMany({ where: { institutionId: instId } });
    await prisma.institution.delete({ where: { id: instId } });
    console.log("✓ Institution 'Dock Demo' removida (produção não deve ter dado fictício)");
  } else {
    console.log("✓ Nenhuma instituição de demonstração encontrada (ambiente já limpo)");
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
