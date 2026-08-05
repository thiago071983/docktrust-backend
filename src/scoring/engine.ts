// ============================================================================
// DOCK TRUST SCORE — Motor de Scoring
// ============================================================================
// Puro / sem I/O: recebe a estrutura do framework + as respostas de um
// assessment, e devolve o score geral, por pilar e por controle.
// Isso é o que roda toda vez que um assessment é submetido, e também pode
// rodar "a seco" (simulação) enquanto o usuário ainda está respondendo,
// pra mostrar o score em tempo real na UI.
// ============================================================================

import {
  FrameworkDTO,
  PillarDTO,
  ControlDTO,
  QuestionDTO,
  RawResponse,
  OverallScoreResult,
  PillarScoreResult,
  ControlScoreResult,
  QuestionScoreResult,
  MetricConfig,
  MATURITY_LEVELS,
} from "../types/domain";

export function calculateScore(
  framework: FrameworkDTO,
  responses: RawResponse[]
): OverallScoreResult {
  const responseMap = new Map(responses.map((r) => [r.questionId, r.value]));

  const questionScores: QuestionScoreResult[] = [];
  const controlScores: ControlScoreResult[] = [];
  const pillarScores: PillarScoreResult[] = [];

  let overallWeightedSum = 0;
  let overallWeightTotal = 0;

  for (const pillar of framework.pillars) {
    const { score: pillarScore, controlResults } = scorePillar(
      pillar,
      responseMap,
      questionScores
    );

    controlScores.push(...controlResults);

    pillarScores.push({
      pillarId: pillar.id,
      code: pillar.code,
      name: pillar.name,
      score: round(pillarScore),
      maturityLevel: maturityLevelFor(pillarScore),
    });

    overallWeightedSum += pillarScore * pillar.weight;
    overallWeightTotal += pillar.weight;
  }

  const overallScore =
    overallWeightTotal > 0 ? overallWeightedSum / overallWeightTotal : 0;

  return {
    overallScore: round(overallScore),
    maturityLevel: maturityLevelFor(overallScore),
    pillarScores,
    controlScores,
    questionScores,
  };
}

function scorePillar(
  pillar: PillarDTO,
  responseMap: Map<string, boolean | string | number>,
  questionScoresAcc: QuestionScoreResult[]
): { score: number; controlResults: ControlScoreResult[] } {
  let weightedSum = 0;
  let weightTotal = 0;
  const controlResults: ControlScoreResult[] = [];

  for (const control of pillar.controls) {
    const controlScore = scoreControl(control, responseMap, questionScoresAcc);
    controlResults.push({
      controlId: control.id,
      name: control.name,
      pillarId: pillar.id,
      score: round(controlScore),
      recommendedServiceId: control.recommendedServiceId,
    });

    weightedSum += controlScore * control.weight;
    weightTotal += control.weight;
  }

  const score = weightTotal > 0 ? weightedSum / weightTotal : 0;
  return { score, controlResults };
}

function scoreControl(
  control: ControlDTO,
  responseMap: Map<string, boolean | string | number>,
  questionScoresAcc: QuestionScoreResult[]
): number {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const question of control.questions) {
    const raw = responseMap.get(question.id);

    // Pergunta não respondida ainda: conta como 0, mas isso é uma decisão de
    // produto — alternativa é excluir do denominador (não penalizar o que
    // ainda não foi respondido). Ajuste aqui conforme a política de negócio.
    const normalizedScore = raw === undefined ? 0 : normalizeAnswer(question, raw);

    questionScoresAcc.push({ questionId: question.id, normalizedScore });

    weightedSum += normalizedScore * question.weight;
    weightTotal += question.weight;
  }

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

function normalizeAnswer(
  question: QuestionDTO,
  raw: boolean | string | number
): number {
  // As 232 perguntas do framework real (geradas da planilha) não setam
  // `type` explicitamente — só as perguntas de métrica (uptime, taxa de
  // fraude etc.) têm. Sem esse fallback, TODA pergunta sem type explícito
  // caía no `default: return 0` — ou seja, o score de qualquer resposta
  // válida contra o framework v3 sempre dava 0, silenciosamente.
  const effectiveType = question.type || "MULTIPLE_CHOICE";

  switch (effectiveType) {
    case "BOOLEAN":
      return raw === true ? 100 : 0;

    case "MULTIPLE_CHOICE":
    case "MATURITY_SCALE": {
      const option = question.options?.find((o) => o.id === raw);
      return option ? clamp(option.score) : 0;
    }

    case "METRIC":
      return normalizeMetric(Number(raw), question.metricConfig);

    case "EVIDENCE_UPLOAD":
      // Evidência sozinha não pontua — precisa de revisão de analista que
      // grava um MULTIPLE_CHOICE/score associado. Aqui é neutro.
      return 0;

    default:
      return 0;
  }
}

function normalizeMetric(value: number, config?: MetricConfig): number {
  if (!config) return 0;
  const { target, direction, worst } = config;

  if (direction === "higher_is_better") {
    const floor = worst ?? 0;
    if (value >= target) return 100;
    if (value <= floor) return 0;
    return clamp(((value - floor) / (target - floor)) * 100);
  } else {
    // lower_is_better (ex: taxa de fraude — quanto menor, melhor)
    const ceiling = worst ?? target * 3;
    if (value <= target) return 100;
    if (value >= ceiling) return 0;
    return clamp(((ceiling - value) / (ceiling - target)) * 100);
  }
}

function maturityLevelFor(score: number): number {
  let level: number = MATURITY_LEVELS[0].level;
  for (const m of MATURITY_LEVELS) {
    if (score >= m.minScore) level = m.level;
  }
  return level;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
