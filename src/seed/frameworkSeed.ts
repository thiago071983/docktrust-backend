// ============================================================================
// Seed do Dock Trust Framework v1.0
// Estrutura extraída diretamente do material de referência: 5 pilares,
// controles principais de cada um, com perguntas de exemplo por tipo.
// Usar como fixture inicial + base para o time de produto refinar as
// perguntas reais com especialistas de cada pilar.
// ============================================================================

import { FrameworkDTO } from "../types/domain";

export const dockTrustFrameworkV1: FrameworkDTO = {
  id: "framework-dock-trust-v1",
  pillars: [
    {
      id: "pillar-T-governance",
      code: "T1",
      name: "Trust Governance",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-estrategia-objetivos",
          weight: 1,
          questions: [
            {
              id: "q-governanca-formalizada",
              type: "MATURITY_SCALE",
              weight: 1,
              options: [
                { id: "opt1", label: "Não existe estratégia de trust formalizada", scoreValue: 0 },
                { id: "opt2", label: "Existe, mas informal / não documentada", scoreValue: 40 },
                { id: "opt3", label: "Documentada, sem revisão periódica", scoreValue: 65 },
                { id: "opt4", label: "Documentada e revisada anualmente", scoreValue: 85 },
                { id: "opt5", label: "Documentada, revisada e com board sponsor ativo", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-gestao-riscos",
          weight: 1,
          questions: [
            {
              id: "q-matriz-riscos",
              type: "BOOLEAN",
              weight: 1,
            },
            {
              id: "q-compliance-regulatorio",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              options: [
                { id: "opt1", label: "Não atende requisitos regulatórios aplicáveis", scoreValue: 0 },
                { id: "opt2", label: "Atende parcialmente", scoreValue: 50 },
                { id: "opt3", label: "Atende integralmente e com certificações", scoreValue: 100 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "pillar-R-operations",
      code: "R",
      name: "Resilient Operations",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-soc-monitoramento",
          weight: 1,
          questions: [
            {
              id: "q-soc-cobertura",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              options: [
                { id: "opt1", label: "Sem SOC / monitoramento", scoreValue: 0 },
                { id: "opt2", label: "SOC em horário comercial", scoreValue: 50 },
                { id: "opt3", label: "SOC 24x7 próprio ou terceirizado", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-continuidade",
          weight: 1,
          questions: [
            {
              id: "q-uptime",
              type: "METRIC",
              weight: 1,
              metricSource: "uptime_pct_90d",
              metricConfig: { target: 99.9, direction: "higher_is_better", worst: 95 },
            } as any,
            {
              id: "q-bcp-testado",
              type: "BOOLEAN",
              weight: 1,
            },
          ],
        },
      ],
    },
    {
      id: "pillar-U-financial",
      code: "U",
      name: "Unified Financial Protection",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-prevencao-fraude",
          weight: 1.2, // levemente mais pesado — core business da unidade Trust
          questions: [
            {
              id: "q-taxa-fraude",
              type: "METRIC",
              weight: 1,
              metricSource: "fraud_rate_monthly_bps",
              metricConfig: { target: 5, direction: "lower_is_better", worst: 50 },
            } as any,
            {
              id: "q-motor-antifraude",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              options: [
                { id: "opt1", label: "Regras estáticas apenas", scoreValue: 40 },
                { id: "opt2", label: "Regras + scoring baseado em modelo", scoreValue: 75 },
                { id: "opt3", label: "Modelo de ML com aprendizado contínuo", scoreValue: 100 },
                { id: "opt0", label: "Nenhum motor antifraude", scoreValue: 0 },
              ],
            },
          ],
        },
        {
          id: "ctrl-aml-kyc",
          weight: 1,
          questions: [
            {
              id: "q-kyc-onboarding",
              type: "BOOLEAN",
              weight: 1,
            },
            {
              id: "q-monitoramento-transacional",
              type: "BOOLEAN",
              weight: 1,
            },
          ],
        },
      ],
    },
    {
      id: "pillar-S-platforms",
      code: "S",
      name: "Secure Digital Platforms",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-secure-sdlc",
          weight: 1,
          questions: [
            {
              id: "q-sast-dast",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              options: [
                { id: "opt1", label: "Sem testes de segurança automatizados", scoreValue: 0 },
                { id: "opt2", label: "Testes manuais pontuais", scoreValue: 40 },
                { id: "opt3", label: "SAST/DAST integrados ao CI/CD", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-vulnerability-mgmt",
          weight: 1,
          questions: [
            {
              id: "q-tempo-remediacao-critica",
              type: "METRIC",
              weight: 1,
              metricSource: "avg_days_to_remediate_critical",
              metricConfig: { target: 7, direction: "lower_is_better", worst: 60 },
            } as any,
          ],
        },
      ],
    },
    {
      id: "pillar-T-ecosystem",
      code: "T2",
      name: "Trusted Ecosystem",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-gestao-terceiros",
          weight: 1,
          questions: [
            {
              id: "q-due-diligence-fornecedores",
              type: "BOOLEAN",
              weight: 1,
            },
          ],
        },
        {
          id: "ctrl-compartilhamento-inteligencia",
          weight: 1,
          questions: [
            {
              id: "q-participacao-comunidade",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              options: [
                { id: "opt1", label: "Não participa de nenhuma iniciativa setorial", scoreValue: 0 },
                { id: "opt2", label: "Participa esporadicamente", scoreValue: 50 },
                { id: "opt3", label: "Participa ativamente (ex: fóruns antifraude, ISACs)", scoreValue: 100 },
              ],
            },
          ],
        },
      ],
    },
  ],
};
