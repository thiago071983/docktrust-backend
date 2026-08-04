# Dock Trust Platform — Backend (scaffold inicial)

Base de código para o time de engenharia partir daqui. Não é produção — é o
esqueleto arquitetural com as decisões de modelagem já tomadas, testado na
parte que mais importa (o motor de scoring).

## Stack escolhida (assumida — ajuste se o time já tem padrão definido)

- **Node.js + TypeScript** — mesma linguagem no front (React) e back, facilita
  compartilhar tipos de domínio (`src/types/domain.ts`).
- **PostgreSQL + Prisma** — schema relacional, versionável, e o Prisma dá
  migrations + client tipado de graça.
- **Express** — só pra ter rotas HTTP simples no MVP; trocar por
  Fastify/NestJS depois se o time preferir mais estrutura.

Se a Dock já tem stack padrão interno (ex: Java/Spring, .NET, Go), a peça que
importa manter é a arquitetura, não a linguagem — veja "O que não pode mudar"
abaixo.

## Como rodar

```bash
npm install
cp .env.example .env   # configure DATABASE_URL
npm run prisma:migrate
npm run dev
```

## Estrutura

```
prisma/schema.prisma            modelo de dados completo (ver comentários no arquivo)
src/types/domain.ts              tipos de domínio, desacoplados do Prisma
src/scoring/engine.ts            motor de scoring (função pura, testável isoladamente)
src/scoring/engine.test.ts       testes do motor
src/seed/frameworkSeed.ts        os 5 pilares reais da Dock Trust, com perguntas de exemplo
src/middleware/auth.ts           autenticação + guards de acesso multi-tenant (ver seção abaixo)
src/import/parseResponses.ts     parser de bulk-import (JSON/CSV)
src/routes/assessments.ts        endpoints de assessment (questions, responses, submit)
src/routes/institutions.ts       endpoints de instituição (listagem, score-history, bulk-import)
src/routes/admin.ts              endpoints de configuração do framework (perguntas/pesos/opções)
src/server.ts                    bootstrap do Express
```

## Modelo de acesso (implementado nesta rodada)

Dois tipos de principal, **deliberadamente modelados como tipos separados**,
não como um "role" numa tabela única de usuário:

- **DockUser** (`TRUST_ADMIN` / `TRUST_ANALYST` / `TRUST_VIEWER`) — equipe
  Dock Trust, acessa qualquer instituição, só `TRUST_ADMIN` configura o
  framework.
- **InstitutionUser** — usuário do cliente, permanentemente amarrado a um
  `institutionId`. Não tem como esse usuário requisitar dados de outra
  instituição — o `institutionId` usado em toda query vem do próprio
  principal autenticado, nunca do parâmetro da URL.

Onde isso é aplicado:

- `authenticate` — resolve o principal (stub: lê headers; trocar por
  JWT/SSO real). **Este é o único ponto que precisa mudar** quando plugarem
  autenticação de verdade — o resto do sistema já depende só do formato
  `Principal`, não de como ele foi obtido.
- `requireInstitutionAccess` — em toda rota `/institutions/:institutionId/*`.
  Se o principal é `institution` e o `institutionId` da URL não bate com o
  dele, `403`. Se é `dock`, passa.
- `requireDockAdmin` — em todas as rotas de `/admin/*` (criar pergunta,
  editar peso, editar score de opção). Cliente nunca alcança essas rotas.
- `requireAnyDockUser` — em `GET /institutions` (listagem completa de
  clientes, que alimenta o seletor de instituição no topo da aplicação).

**Isso é o reforço server-side do que a UI já simula visualmente** (seletor
de instituição + toggle de papel no protótipo React). A UI pode e deve
continuar escondendo botões pra melhor UX, mas a garantia de isolamento
tem que estar aqui — nunca confiar em "o botão não aparece" como controle
de segurança.

## Novas rotas nesta rodada

```
GET    /institutions                                                       (Dock)
GET    /institutions/:institutionId                                        (Dock ou dono)
GET    /institutions/:institutionId/score-history                          (Dock ou dono)
POST   /institutions/:institutionId/assessments/:id/responses/bulk-import  (Dock ou dono)
GET    /institutions/:institutionId/assessments/:id/questions              (Dock ou dono)
POST   /institutions/:institutionId/assessments/:id/responses              (Dock ou dono)
POST   /institutions/:institutionId/assessments/:id/submit                 (Dock ou dono)

POST   /admin/controls/:controlId/questions            (TRUST_ADMIN)
PATCH  /admin/questions/:questionId                     (TRUST_ADMIN)
PATCH  /admin/questions/:questionId/options/:optionId   (TRUST_ADMIN)
POST   /admin/questions/:questionId/options             (TRUST_ADMIN)
DELETE /admin/questions/:questionId                     (TRUST_ADMIN)
```

O `bulk-import` aceita `{ fileContent: string, fileFormat: "json" | "csv" }`
no corpo da requisição. Formato esperado:

- JSON: `[{ "questionId": "q1", "optionLabel": "Documentada e revisada anualmente" }]`
- CSV: colunas `questionId,optionLabel` (ou `optionId` diretamente)

Perguntas/opções não reconhecidas voltam em `unmatchedQuestionIds` na
resposta — o restante do lote é processado normalmente (uma linha ruim não
derruba o lote inteiro).

## Framework v2 — banco de perguntas e motor de recomendação

`src/seed/frameworkSeedV2.ts` substitui o seed v1 como framework ativo (as
rotas já apontam para ele). São 36 perguntas distribuídas nos 5 pilares,
com duas propriedades novas em cada pergunta/controle:

- **`regulatoryRefs`** — cada pergunta rastreia até um framework ou norma já
  reconhecido (NIST CSF, COBIT 2019, ISO 27001/22301, MITRE ATT&CK, OWASP,
  e principalmente **Resolução BCB nº 85/2021**, **CMN nº 4.893/2021**, LGPD,
  Circular BCB nº 3.978/2020, regras de Pix/Open Finance). Isso é o que
  permite apresentar a metodologia ao Bacen e a auditores como uma
  operacionalização de exigências existentes — não um questionário
  proprietário isolado, no mesmo espírito do FFIEC CAT ou de um
  questionário de cyber insurance.
- **`recommendedServiceId`** (em cada `Control`) — aponta para uma das 5
  soluções em `src/seed/servicesCatalog.ts` (Trust Enablement, Executive
  Trust Advisory, Financial Protection, Cyber & Operational Resilience,
  Continuous Trust). É o vínculo que fecha o ciclo comercial.

`src/scoring/recommendations.ts` é o motor que usa esse vínculo: pega os
`controlScores` já calculados, filtra os que estão abaixo de 65/100 (ver
`GAP_THRESHOLD`), agrupa por serviço e ordena pelo pior gap primeiro — é
essa lista que deve orientar a conversa comercial pós-assessment. Instituição
em maturidade nível 1 sempre recebe Trust Enablement como recomendação de
entrada, mesmo sem nenhum controle isolado abaixo do limiar.

Testei o pipeline completo (seed → `calculateScore` → `recommendServices`)
com um cenário de instituição em estágio inicial antes de fechar: os scores
por pilar e as recomendações saíram consistentes com o esperado.

**Decisão de produto pendente:** `GAP_THRESHOLD = 65` foi escolhido de forma
arbitrária para o protótipo. Vale validar com o time comercial se esse é o
ponto de corte certo — um limiar mais alto (ex: 75) geraria recomendações
mais cedo (mais leads, potencialmente menos qualificados); um limiar mais
baixo geraria recomendações só para gaps mais graves.

O seed v1 (`src/seed/frameworkSeed.ts`) foi mantido no repositório só como
referência histórica — não está mais conectado a nenhuma rota.

## Persistência de respostas — nunca perder dado, sempre retomar de onde parou

Três rotas trabalham juntas para isso, todas em `src/routes/assessments.ts`:

- **`PUT /institutions/:id/assessments/:id/responses/:questionId`** — salva
  UMA resposta, imediatamente. É esta rota que a UI deve chamar a cada
  resposta dada (debounced ou não, mas por pergunta), não só num "salvar" no
  final. Isso garante que se o cliente fechar a aba logo depois de responder
  uma pergunta, aquela resposta específica já está em disco.
- **`GET /institutions/:id/assessments/:id/responses`** — devolve tudo que já
  foi salvo. A UI usa isso para pré-popular o formulário ao carregar —
  é o mecanismo de "retomar de onde parou".
- **`POST /institutions/:id/assessments/:id/responses`** — upsert em lote,
  usado por bulk-import ou por sincronização depois de ficar offline.

Regra que vale para as três: sempre upsert por `(assessmentId, questionId)`
— nunca um DELETE + INSERT do assessment inteiro. A constraint
`@@unique([assessmentId, questionId])` no `Response` do schema existe
exatamente para viabilizar esse upsert com segurança.

## Onboarding de clientes e gestão de usuários (multi-tenant)

Fluxo em duas etapas, cada uma com seu próprio guard de acesso:

1. **`POST /institutions`** (`requireAnyDockUser`) — a Dock cria a
   instituição E o primeiro usuário admin dela no mesmo request. Uma
   instituição sem nenhum admin é um estado inválido: ninguém do lado do
   cliente conseguiria convidar os próprios colegas depois. O corpo esperado:
   ```json
   { "name": "Fintech Aurora", "segment": "Fintech", "initialAdmin": { "name": "...", "email": "..." } }
   ```
2. **`POST /institutions/:institutionId/users`** (`requireInstitutionAccess`
   + `requireCanManageInstitutionUsers`) — depois do onboarding inicial, é
   assim que o **admin do próprio cliente** inclui novos colegas, sem
   depender da Dock. `requireCanManageInstitutionUsers` deixa passar a
   própria Dock (suporte) e o usuário com `institutionRole === "admin"`
   daquela instituição — um usuário "operacional" da mesma instituição não
   passa, mesmo estando no institutionId correto.

`GET /institutions/:institutionId/users` lista os usuários da instituição
(mesmo guard de acesso de leitura de qualquer outro recurso escopado por
instituição).

**Nota deliberadamente fora do escopo deste scaffold:** o envio de e-mail de
convite/definição de senha para o `initialAdmin` e para novos usuários não
está implementado — isso depende de um provedor de e-mail transacional
ainda não definido pelo time.

## Framework v3 — 232 perguntas reais, segmentadas por tipo de instituição

A partir desta rodada, o framework não é mais escrito à mão no seed — ele
vem da planilha oficial (`Dock_Trust_Framework_Segmentado.xlsx`), convertida
via `scripts/xlsx_to_framework.py`.

```bash
python3 scripts/xlsx_to_framework.py <planilha.xlsx> src/seed/data
```

**Isso gera três arquivos em `src/seed/data/` — nunca edite esses JSONs à
mão, nem o `frameworkSeedV2.ts` antigo (mantido só como referência
histórica, não está mais em uso):**

- `frameworkV3.json` — 232 perguntas, 5 pilares, 30 controles (áreas/disciplinas).
- `segmentsV3.json` — os 16 segmentos de cliente (BAN, BDG, IP, FIN, EMI,
  ADQ, BAAS, PRO, COOP, CRED, CAM, INV, SEG, MKT, CRIP, TEC).
- `conditionsV3.json` — as 12 condições de aplicabilidade (ver abaixo).

**Quando o time de produto atualizar a planilha, rode o script de novo.**
Se uma pergunta nova vier com uma condição de aplicação que o script não
reconhece, ele **falha de propósito** (em vez de gerar algo errado
silenciosamente) — a mensagem de erro diz exatamente o que adicionar em
`CONDITION_TEXT_TO_KEY` no topo do script.

### Aplicabilidade — por que instituições diferentes respondem perguntas diferentes

Cada pergunta tem um `applicability`:

- **`UNIVERSAL`** (108 perguntas) — entra pra qualquer instituição.
- **`SEGMENTED`** (20 perguntas) — entra só se o segmento da instituição
  estiver em `applicableSegments` (ex: perguntas de prevenção a fraude não
  fazem sentido pra um provedor de tecnologia puro — `TEC` — que não
  processa transação de cliente final).
- **`CONDITIONAL`** (104 perguntas) — entra só se
  `institution.applicabilityFlags[conditionKey] === true`. Os 12 flags
  possíveis (`PROCESSES_PERSONAL_DATA`, `USES_CLOUD`, `OPERATES_PIX` etc.)
  são capturados no onboarding ou editados depois — ver
  `src/seed/data/conditionsV3.json` pra lista completa com a descrição
  original da planilha.

O motor que aplica essa regra é `src/scoring/applicability.ts` —
`filterFrameworkForInstitution(framework, profile)` — puro, testado
(validei contra três perfis diferentes antes de fechar: um `TEC` sem
nenhuma condição marcada recebe só as 108 universais; o mesmo `TEC` com 4
condições marcadas sobe pra 160; um `BAN` com todas as condições marcadas
recebe as 232 — o teto, porque `BAN` está em todas as listas de segmento).

### Onboarding agora exige segmento

`POST /institutions` mudou: `segments` (array, ≥1 código válido do
catálogo) é obrigatório — é isso que determina quais das 232 perguntas
aparecem no assessment daquela instituição. `applicabilityFlags` é
opcional no onboarding (pode ficar pra depois, numa tela de "perfil de
aplicabilidade"), mas sem ele nenhuma pergunta `CONDITIONAL` aparece até
alguém preencher.

Dois catálogos ficaram expostos via API pra UI não precisar hardcodar as
listas: `GET /institutions/segments` e `GET /institutions/applicability-conditions`.

### Serviço recomendado por controle — uma lacuna que a planilha não cobre

A planilha não tem coluna de "qual serviço Dock Trust resolve isso" —
isso é uma decisão comercial, não uma classificação técnica da fonte. O
script de conversão aplica um **default por pilar** (Trust Governance →
Executive Trust Advisory, Resilient Operations → Cyber & Operational
Resilience, Unified Financial Protection → Financial Protection, Secure
Digital Platforms → Cyber & Operational Resilience, Trusted Ecosystem →
Executive Trust Advisory) só pra manter o motor de recomendações (ver
conversa anterior) funcionando. **Vale o time comercial revisar isso
controle por controle** — 30 controles não deveriam todos herdar o mesmo
serviço do pilar inteiro; tem controle dentro de Secure Digital Platforms,
por exemplo, que pode fazer mais sentido apontar pra Financial Protection
dependendo do caso.

## O que não pode mudar (decisões de arquitetura, independente de linguagem)

1. **Framework é versionado.** Nunca edite perguntas/pesos de um Framework em
   produção — crie uma nova versão. Isso preserva a integridade de scores
   já calculados (senão o histórico de tendência fica incomparável).

2. **Score é sempre recalculado, nunca editado manualmente.** O `ScoreSnapshot`
   é congelado no momento do `submit`, mas a fonte da verdade são as
   `Response` — se precisar corrigir, corrija a resposta e re-rode o motor.

3. **Motor de scoring é uma função pura.** Sem chamada a banco, sem I/O.
   Isso permite: (a) rodar em tempo real no front enquanto o usuário
   responde, sem round-trip ao servidor; (b) testar unitariamente; (c)
   trocar de linguagem/runtime sem reescrever a regra de negócio, só portar
   a função.

4. **Multi-tenant desde o dia 1.** Toda query de dado sensível (respostas,
   scores) tem que ser escopada por `institutionId`. Como vocês vão lidar
   com dados de segurança de instituições financeiras concorrentes entre si,
   isolamento de tenant é requisito de compliance, não só de arquitetura.

5. **Pergunta tipo METRIC é o gancho para dados reais.** Hoje a Dock já
   processa transações dos clientes — em vez de só perguntar "qual sua taxa
   de fraude" por formulário, dá pra alimentar isso automaticamente via um
   job que escreve direto em `Response` com `metricSource`. Isso é o
   diferencial real vs. um assessment tipo SecurityScorecard genérico.

## Próximos passos sugeridos (nessa ordem)

1. Validar o `frameworkSeed.ts` com os especialistas de cada pilar (as
   perguntas aqui são exemplos ilustrativos, não o questionário real).
2. Decidir a política de "pergunta não respondida" (hoje conta como 0 —
   ver comentário em `engine.ts`, função `scoreControl`). Isso muda
   completamente o score de assessments parciais.
3. Implementar os `TODO: Prisma` nas rotas.
4. Autenticação/autorização (não incluída neste scaffold) — provavelmente
   SSO corporativo para usuários Dock + convite por e-mail para usuários
   da instituição cliente.
5. Job de ingestão de métricas reais (item 5 acima).
6. Endpoint de benchmarking (comparar score da instituição com a média do
   setor/segmento — mencionado na imagem como "Benchmark de Mercado").
