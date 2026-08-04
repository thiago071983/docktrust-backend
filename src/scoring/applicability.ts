// ============================================================================
// Motor de Aplicabilidade
// ============================================================================
// Filtra o Dock Trust Framework completo (232 perguntas) para o subconjunto
// que realmente se aplica a uma instituição específica, com base no
// segmento dela e nos flags de condição capturados no onboarding.
//
// Regra (mesma da aba "Perfis e Regras" da planilha original):
// - UNIVERSAL    -> sempre entra.
// - SEGMENTED    -> entra se o segmento da instituição estiver em applicableSegments.
// - CONDITIONAL  -> entra se institution.conditionFlags[question.conditionKey] === true.
//
// Função pura — mesma garantia do motor de scoring: sem I/O, testável
// isoladamente, e pode rodar tanto no backend quanto espelhada no frontend.
// ============================================================================

import { FrameworkDTO, InstitutionProfileDTO, QuestionDTO } from "../types/domain";

export function isQuestionApplicable(question: QuestionDTO, profile: InstitutionProfileDTO): boolean {
  switch (question.applicability) {
    case "SEGMENTED":
      return (question.applicableSegments || []).some((seg) => profile.segments.includes(seg));
    case "CONDITIONAL":
      return question.conditionKey ? profile.conditionFlags[question.conditionKey] === true : false;
    case "UNIVERSAL":
    default:
      return true;
  }
}

// Filtra o framework inteiro, removendo perguntas não aplicáveis. Controles
// que ficam sem nenhuma pergunta aplicável são removidos também (não faz
// sentido mostrar um controle vazio no assessment).
export function filterFrameworkForInstitution(
  framework: FrameworkDTO,
  profile: InstitutionProfileDTO
): FrameworkDTO {
  return {
    ...framework,
    pillars: framework.pillars.map((pillar) => ({
      ...pillar,
      controls: pillar.controls
        .map((control) => ({
          ...control,
          questions: control.questions.filter((q) => isQuestionApplicable(q, profile)),
        }))
        .filter((control) => control.questions.length > 0),
    })),
  };
}

// Estatística útil pra UI de onboarding: quantas perguntas cada resposta de
// segmento/condição adiciona ou remove, antes de fechar o cadastro.
export function countApplicableQuestions(framework: FrameworkDTO, profile: InstitutionProfileDTO): number {
  return framework.pillars.reduce(
    (acc, pillar) =>
      acc +
      pillar.controls.reduce(
        (cAcc, control) => cAcc + control.questions.filter((q) => isQuestionApplicable(q, profile)).length,
        0
      ),
    0
  );
}
