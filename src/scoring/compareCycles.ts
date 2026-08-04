// ============================================================================
// Comparação entre ciclos (ScoreSnapshots)
// ============================================================================
// Função pura — recebe dois snapshots e devolve os deltas. Deliberadamente
// não mexe em histórico: cada snapshot é o que foi, o delta é só a
// diferença lida entre os dois pontos já congelados.
// ============================================================================

import { PillarScoreResult } from "../types/domain";

export interface CycleSnapshotDTO {
  id: string;
  cycleLabel: string;
  frameworkId: string;
  createdAt: string; // ISO
  overallScore: number;
  maturityLevel: number;
  pillarScores: PillarScoreResult[];
}

export interface PillarDelta {
  pillarId: string;
  code: string;
  name: string;
  previousScore: number | null;
  currentScore: number;
  delta: number | null; // null se não houver ciclo anterior comparável
  maturityChanged: boolean;
  previousMaturityLevel: number | null;
  currentMaturityLevel: number;
}

export interface CycleComparison {
  current: CycleSnapshotDTO;
  previous: CycleSnapshotDTO | null;
  methodologyChanged: boolean; // frameworkId diferente entre os dois ciclos
  overallDelta: number | null;
  overallMaturityChanged: boolean;
  pillarDeltas: PillarDelta[];
}

export function compareCycles(
  current: CycleSnapshotDTO,
  previous: CycleSnapshotDTO | null
): CycleComparison {
  const methodologyChanged = previous ? previous.frameworkId !== current.frameworkId : false;

  const pillarDeltas: PillarDelta[] = current.pillarScores.map((p) => {
    const prevPillar = previous?.pillarScores.find((pp) => pp.pillarId === p.pillarId) ?? null;
    return {
      pillarId: p.pillarId,
      code: p.code,
      name: p.name,
      previousScore: prevPillar ? prevPillar.score : null,
      currentScore: p.score,
      delta: prevPillar ? round(p.score - prevPillar.score) : null,
      maturityChanged: prevPillar ? prevPillar.maturityLevel !== p.maturityLevel : false,
      previousMaturityLevel: prevPillar ? prevPillar.maturityLevel : null,
      currentMaturityLevel: p.maturityLevel,
    };
  });

  return {
    current,
    previous,
    methodologyChanged,
    overallDelta: previous ? round(current.overallScore - previous.overallScore) : null,
    overallMaturityChanged: previous ? previous.maturityLevel !== current.maturityLevel : false,
    pillarDeltas,
  };
}

// Série completa para gráfico de tendência — cada ponto já vem com o delta
// em relação ao ponto anterior, calculado uma vez só (o front não recalcula).
export function buildTrendSeries(snapshotsChronological: CycleSnapshotDTO[]) {
  return snapshotsChronological.map((snap, idx) => {
    const previous = idx > 0 ? snapshotsChronological[idx - 1] : null;
    return compareCycles(snap, previous);
  });
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
