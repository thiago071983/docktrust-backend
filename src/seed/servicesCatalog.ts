// ============================================================================
// Catálogo de Soluções Dock Trust
// Espelha exatamente as 5 soluções do portfólio (Dock Trust Solutions™).
// Cada Control do framework aponta pra uma dessas — é o que transforma
// "seu score está baixo aqui" em "aqui está o serviço que resolve isso".
// ============================================================================

export interface TrustService {
  id: string;
  name: string;
  pitch: string; // uma linha, pra usar em recomendação inline
  bullets: string[];
}

export const TRUST_SERVICES: TrustService[] = [
  {
    id: "trust-enablement",
    name: "Trust Enablement",
    pitch: "Estruturamos a jornada inicial de confiança da sua instituição, do diagnóstico ao plano de ação.",
    bullets: ["Assessment 360°", "Gap Analysis", "Roadmap & Prioridades", "Plano de Ação", "Go Live Readiness"],
  },
  {
    id: "executive-trust-advisory",
    name: "Executive Trust Advisory",
    pitch: "Apoio estratégico para o board e a liderança executiva decidirem sobre risco, governança e confiança.",
    bullets: ["Estratégia de Trust", "Comitês & Board Advisory", "KPIs & Dashboards Executivos", "Gestão de Riscos", "Mentoring Executivo"],
  },
  {
    id: "financial-protection",
    name: "Financial Protection",
    pitch: "Protegemos o ciclo financeiro de ponta a ponta contra fraude, crime financeiro e abuso.",
    bullets: ["Prevenção à Fraude", "AML & KYC", "Sanções & PEP", "Monitoramento de Transações", "Pix & Open Finance"],
  },
  {
    id: "cyber-operational-resilience",
    name: "Cyber & Operational Resilience",
    pitch: "Fortalecemos segurança cibernética e resiliência operacional de forma integrada.",
    bullets: ["Cyber Strategy & Architecture", "IAM & Access Management", "Threat Intelligence", "Vulnerability Management", "IR & Crisis Readiness"],
  },
  {
    id: "continuous-trust",
    name: "Continuous Trust",
    pitch: "Evoluímos a confiança de forma contínua, com visão executiva e benchmark de mercado.",
    bullets: ["Trust Score Contínuo", "Dashboards Executivos", "Health Checks Trimestrais", "Benchmark de Mercado", "Reports para Board"],
  },
];

export function getService(id?: string): TrustService | undefined {
  return TRUST_SERVICES.find((s) => s.id === id);
}
