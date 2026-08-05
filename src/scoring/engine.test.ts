import { describe, it, expect } from "vitest";
import { calculateScore } from "./engine";
import { FrameworkDTO } from "../types/domain";

// Framework mínimo pra testar a matemática do motor isoladamente,
// sem depender do seed completo da Dock.
const testFramework: FrameworkDTO = {
  id: "fw-test",
  pillars: [
    {
      id: "pillar-a",
      code: "A",
      name: "Pillar A",
      weight: 1,
      controls: [
        {
          id: "control-1",
          weight: 1,
          questions: [
            {
              id: "q1",
              type: "BOOLEAN",
              weight: 1,
            },
            {
              id: "q2",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              options: [
                { id: "low", label: "Baixo", score: 0 },
                { id: "high", label: "Alto", score: 100 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("calculateScore", () => {
  it("retorna 100 quando todas as respostas são máximas", () => {
    const result = calculateScore(testFramework, [
      { questionId: "q1", value: true },
      { questionId: "q2", value: "high" },
    ]);
    expect(result.overallScore).toBe(100);
    expect(result.maturityLevel).toBe(5); // Trusted Institution
  });

  it("retorna 0 quando todas as respostas são mínimas", () => {
    const result = calculateScore(testFramework, [
      { questionId: "q1", value: false },
      { questionId: "q2", value: "low" },
    ]);
    expect(result.overallScore).toBe(0);
    expect(result.maturityLevel).toBe(1); // Protected
  });

  it("perguntas não respondidas contam como 0 (política atual)", () => {
    const result = calculateScore(testFramework, [
      { questionId: "q1", value: true },
      // q2 não respondida
    ]);
    expect(result.overallScore).toBe(50);
  });

  it("mistura de respostas gera média ponderada correta", () => {
    const result = calculateScore(testFramework, [
      { questionId: "q1", value: true }, // 100
      { questionId: "q2", value: "low" }, // 0
    ]);
    expect(result.overallScore).toBe(50);
  });
});
