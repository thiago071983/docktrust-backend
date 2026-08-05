// Tipos de domínio usados pelo motor de scoring.
// Espelham o schema.prisma, mas desacoplados do Prisma Client
// para permitir testar o motor de scoring isoladamente (unit tests puros).

export type QuestionType =
  | "MATURITY_SCALE"
  | "BOOLEAN"
  | "MULTIPLE_CHOICE"
  | "METRIC"
  | "EVIDENCE_UPLOAD";

export interface QuestionOptionDTO {
  id: string;
  label: string;
  score: number; // 0-100 — nome do campo bate com o JSON real gerado da planilha (frameworkV3.json), NÃO com a coluna do banco (QuestionOption.scoreValue), que é traduzida no seed
}

export interface MetricConfig {
  target: number;
  direction: "higher_is_better" | "lower_is_better";
  // valores fora da faixa [worst, target] são clampados em 0/100
  worst?: number;
}

export type ApplicabilityType = "UNIVERSAL" | "SEGMENTED" | "CONDITIONAL";

export interface QuestionDTO {
  id: string;
  text?: string;
  type: QuestionType;
  weight: number;
  options?: QuestionOptionDTO[];
  metricSource?: string;
  metricConfig?: MetricConfig;
  regulatoryRefs?: string[];
  // Determina se essa pergunta entra no assessment de uma instituição:
  // - UNIVERSAL: sempre entra, para qualquer instituição.
  // - SEGMENTED: só entra se o segmento da instituição estiver em applicableSegments.
  // - CONDITIONAL: só entra se a instituição tiver o flag conditionKey = true
  //   (capturado no onboarding/perfil de aplicabilidade — ver src/seed/data/conditionsV3.json).
  applicability?: ApplicabilityType;
  applicableSegments?: string[];
  conditionKey?: string;
  conditionDescription?: string;
}

export interface ControlDTO {
  id: string;
  name?: string;
  weight: number;
  questions: QuestionDTO[];
  // Quando o score deste controle fica abaixo do limiar, esta é a solução
  // Dock Trust recomendada para fechar o gap — é o gancho comercial do score.
  recommendedServiceId?: string;
}

export interface PillarDTO {
  id: string;
  code: string;
  name: string;
  weight: number;
  controls: ControlDTO[];
}

export interface FrameworkDTO {
  id: string;
  pillars: PillarDTO[];
}

// Resposta bruta enviada pelo cliente/instituição
export interface RawResponse {
  questionId: string;
  // BOOLEAN -> boolean | MULTIPLE_CHOICE/MATURITY_SCALE -> option id (string)
  // METRIC -> number
  value: boolean | string | number;
}

export interface QuestionScoreResult {
  questionId: string;
  normalizedScore: number; // 0-100
}

export interface ControlScoreResult {
  controlId: string;
  name?: string;
  pillarId?: string;
  score: number;
  recommendedServiceId?: string;
}

export interface PillarScoreResult {
  pillarId: string;
  code: string;
  name: string;
  score: number;
  maturityLevel: number; // 1-5
}

export interface OverallScoreResult {
  overallScore: number; // 0-100
  maturityLevel: number; // 1-5
  pillarScores: PillarScoreResult[];
  controlScores: ControlScoreResult[];
  questionScores: QuestionScoreResult[];
}

// Perfil de aplicabilidade de uma instituição — capturado no onboarding
// (POST /institutions) e editável depois. É contra isso que o motor de
// aplicabilidade (scoring/applicability.ts) filtra o framework completo.
export interface InstitutionProfileDTO {
  segments: string[]; // códigos do catálogo em seed/data/segmentsV3.json (ex: ["IP", "BAAS"])
  conditionFlags: Record<string, boolean>; // chave = conditionKey (ex: { PROCESSES_PERSONAL_DATA: true })
}

// Níveis de maturidade — mesmos 5 níveis usados no framework (imagem 5/6)
export const MATURITY_LEVELS = [
  { level: 1, name: "Protected", minScore: 0 },
  { level: 2, name: "Verified", minScore: 40 },
  { level: 3, name: "Resilient", minScore: 60 },
  { level: 4, name: "Financially Protected", minScore: 75 },
  { level: 5, name: "Trusted Institution", minScore: 90 },
] as const;
