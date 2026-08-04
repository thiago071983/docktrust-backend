// ============================================================================
// Parser de arquivo de respostas — usado pelo endpoint de bulk-import.
// Mesma lógica do protótipo React (import no frontend), mas essa é a versão
// que manda: parceiros/integradores podem chamar a API diretamente sem
// passar pela UI, então a validação real tem que estar aqui, não só no front.
// ============================================================================

import { FrameworkDTO } from "../types/domain";

export interface ImportEntry {
  questionId: string;
  optionId?: string;
  optionLabel?: string;
}

export interface ImportResult {
  matched: { questionId: string; optionId: string }[];
  unmatched: string[]; // questionIds não encontrados ou sem opção correspondente
}

export function parseImportPayload(
  rawText: string,
  fileFormat: "json" | "csv"
): ImportEntry[] {
  if (fileFormat === "json") {
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : parsed.responses || [];
  }

  // CSV simples: cabeçalho questionId,optionLabel (ou optionId)
  // Limitação conhecida: não trata vírgula dentro de campo entre aspas —
  // para volumes maiores, trocar por uma lib de CSV (ex: papaparse/csv-parse).
  const [header, ...rows] = rawText.trim().split("\n");
  const cols = header.split(",").map((c) => c.trim().toLowerCase());
  const qIdx = cols.indexOf("questionid");
  const oLabelIdx = cols.indexOf("optionlabel");
  const oIdIdx = cols.indexOf("optionid");

  return rows
    .filter((r) => r.trim().length > 0)
    .map((row) => {
      const cells = row.split(",");
      return {
        questionId: cells[qIdx]?.trim(),
        optionLabel: oLabelIdx >= 0 ? cells[oLabelIdx]?.trim() : undefined,
        optionId: oIdIdx >= 0 ? cells[oIdIdx]?.trim() : undefined,
      };
    });
}

export function matchImportEntries(
  entries: ImportEntry[],
  framework: FrameworkDTO
): ImportResult {
  const flatQuestions = framework.pillars.flatMap((p) => p.controls.flatMap((c) => c.questions));

  const matched: { questionId: string; optionId: string }[] = [];
  const unmatched: string[] = [];

  for (const entry of entries) {
    const question = flatQuestions.find((q) => q.id === entry.questionId);
    if (!question || !question.options) {
      unmatched.push(entry.questionId);
      continue;
    }

    const option = question.options.find(
      (o) =>
        o.id === entry.optionId ||
        o.label.toLowerCase() === (entry.optionLabel || "").toLowerCase()
    );

    if (option) matched.push({ questionId: question.id, optionId: option.id });
    else unmatched.push(entry.questionId);
  }

  return { matched, unmatched };
}
