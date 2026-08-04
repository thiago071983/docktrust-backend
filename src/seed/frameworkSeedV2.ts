// ============================================================================
// Seed do Dock Trust Framework v2.0
// ============================================================================
// Cada pergunta rastreia até um framework/norma de mercado já reconhecido —
// isso é o que permite apresentar a metodologia ao Bacen e a auditores como
// uma operacionalização de exigências existentes (Resolução BCB 85/2021,
// CMN 4.893/2021, LGPD, ISO 27001, NIST CSF, COBIT 2019), não como um
// questionário proprietário inventado do zero — no mesmo espírito do FFIEC
// CAT (EUA) ou de questionários de cyber insurance: prático, auditável,
// e com trilha clara até o requisito de origem.
//
// Cada Control aponta para recommendedServiceId — quando o score do
// controle fica abaixo do limiar (ver scoring/recommendations.ts), esse é
// o serviço Dock Trust sugerido para fechar o gap.
//
// Escala padrão de maturidade usada na maioria das perguntas (0/25/50/75/100)
// é deliberadamente inspirada em CMMI + NIST CSF Tiers, para soar familiar
// a quem já respondeu due diligence de segurança ou questionário de cyber
// insurance antes.
// ============================================================================

import { FrameworkDTO } from "../types/domain";

// Escala de maturidade padrão reutilizada em várias perguntas — reduz
// inconsistência de calibração entre perguntas diferentes.
const MATURITY_5 = [
  { id: "m0", label: "Inexistente — não há prática formal", scoreValue: 0 },
  { id: "m1", label: "Inicial — feito de forma ad hoc, não documentado", scoreValue: 25 },
  { id: "m2", label: "Definido — documentado e aplicado, sem monitoramento contínuo", scoreValue: 50 },
  { id: "m3", label: "Gerenciado — monitorado com indicadores e revisão periódica", scoreValue: 75 },
  { id: "m4", label: "Otimizado — automatizado, com melhoria contínua e evidência auditável", scoreValue: 100 },
];

export const dockTrustFrameworkV2: FrameworkDTO = {
  id: "framework-dock-trust-v2",
  pillars: [
    // ========================================================================
    // T1 — TRUST GOVERNANCE
    // ========================================================================
    {
      id: "pillar-T-governance",
      code: "T1",
      name: "Trust Governance",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-estrategia-governanca",
          name: "Estratégia e Governança",
          weight: 1,
          recommendedServiceId: "executive-trust-advisory",
          questions: [
            {
              id: "q-t1-estrategia",
              text: "A instituição possui estratégia de trust/segurança formalizada e aprovada pela liderança?",
              type: "MATURITY_SCALE",
              weight: 1,
              regulatoryRefs: ["NIST CSF GV.OC-01", "COBIT 2019 APO01"],
              options: MATURITY_5,
            },
            {
              id: "q-t1-comite",
              text: "Existe comitê ou board sponsor com responsabilidade formal sobre risco, segurança e fraude?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["COBIT 2019 EDM01", "Resolução CMN 4.893/2021 art. 3º"],
              options: [
                { id: "o1", label: "Não existe comitê nem responsável formal", scoreValue: 0 },
                { id: "o2", label: "Responsável designado, sem reuniões periódicas", scoreValue: 45 },
                { id: "o3", label: "Comitê ativo com reuniões periódicas, sem reporte ao board", scoreValue: 70 },
                { id: "o4", label: "Comitê ativo com reporte periódico direto ao board/conselho", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-gestao-riscos",
          name: "Gestão de Riscos",
          weight: 1,
          recommendedServiceId: "executive-trust-advisory",
          questions: [
            {
              id: "q-t1-matriz-riscos",
              text: "A instituição mantém uma matriz de riscos de segurança/fraude ativa e revisada periodicamente?",
              type: "MATURITY_SCALE",
              weight: 1,
              regulatoryRefs: ["ISO 31000", "COBIT 2019 APO12"],
              options: MATURITY_5,
            },
            {
              id: "q-t1-apetite-risco",
              text: "Existe apetite ao risco formalizado e aprovado pela liderança, com limites quantitativos?",
              type: "MULTIPLE_CHOICE",
              weight: 0.8,
              regulatoryRefs: ["COBIT 2019 APO12", "ISO 31000"],
              options: [
                { id: "o1", label: "Não existe", scoreValue: 0 },
                { id: "o2", label: "Existe de forma qualitativa/informal", scoreValue: 50 },
                { id: "o3", label: "Formalizado com limites quantitativos e aprovado pelo board", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-compliance-regulatorio",
          name: "Compliance Regulatório",
          weight: 1.3,
          recommendedServiceId: "executive-trust-advisory",
          questions: [
            {
              id: "q-t1-politica-ciberseguranca-bcb",
              text: "A instituição possui Política de Segurança Cibernética formalizada nos termos da Resolução BCB nº 85/2021 (ou CMN 4.893/2021, conforme o caso)?",
              type: "MULTIPLE_CHOICE",
              weight: 1.5,
              regulatoryRefs: ["Resolução BCB nº 85/2021", "Resolução CMN nº 4.893/2021"],
              options: [
                { id: "o1", label: "Não possui política formal", scoreValue: 0 },
                { id: "o2", label: "Possui política, mas desatualizada ou não aprovada pelo board", scoreValue: 40 },
                { id: "o3", label: "Política formal, aprovada pelo board, revisada anualmente", scoreValue: 80 },
                { id: "o4", label: "Política formal, revisada anualmente, com evidência de auditoria independente", scoreValue: 100 },
              ],
            },
            {
              id: "q-t1-auditoria-independente",
              text: "Com que frequência a instituição passa por auditoria independente (interna ou externa) de segurança e compliance?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["ISO 27001 cláusula 9.2", "Resolução BCB nº 85/2021"],
              options: [
                { id: "o1", label: "Nunca ou sem prazo definido", scoreValue: 0 },
                { id: "o2", label: "A cada 2 anos ou mais", scoreValue: 40 },
                { id: "o3", label: "Anualmente", scoreValue: 75 },
                { id: "o4", label: "Anualmente ou mais, com plano de ação formal para achados", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-privacidade",
          name: "Privacidade & Proteção de Dados",
          weight: 1,
          recommendedServiceId: "executive-trust-advisory",
          questions: [
            {
              id: "q-t1-programa-lgpd",
              text: "A instituição possui programa de privacidade estruturado (DPO nomeado, RIPD, base legal mapeada por tratamento)?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["LGPD (Lei 13.709/2018) art. 41", "LGPD art. 38"],
              options: [
                { id: "o1", label: "Não possui DPO nem programa estruturado", scoreValue: 0 },
                { id: "o2", label: "DPO nomeado, sem RIPD nem mapeamento de bases legais", scoreValue: 40 },
                { id: "o3", label: "DPO nomeado, com RIPD para tratamentos críticos", scoreValue: 70 },
                { id: "o4", label: "Programa completo: DPO, RIPD, bases legais mapeadas e revisão periódica", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-cultura",
          name: "Cultura e Conscientização",
          weight: 0.8,
          recommendedServiceId: "executive-trust-advisory",
          questions: [
            {
              id: "q-t1-treinamento",
              text: "Existe programa de treinamento e conscientização em segurança/fraude para colaboradores?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["ISO 27001 Anexo A.6.3", "Resolução BCB nº 85/2021"],
              options: [
                { id: "o1", label: "Não existe", scoreValue: 0 },
                { id: "o2", label: "Treinamento pontual no onboarding, sem reforço", scoreValue: 40 },
                { id: "o3", label: "Treinamento anual obrigatório para todos os colaboradores", scoreValue: 75 },
                { id: "o4", label: "Treinamento contínuo com simulações (ex: phishing) e métricas de eficácia", scoreValue: 100 },
              ],
            },
          ],
        },
      ],
    },

    // ========================================================================
    // R — RESILIENT OPERATIONS
    // ========================================================================
    {
      id: "pillar-R-operations",
      code: "R",
      name: "Resilient Operations",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-soc-monitoramento",
          name: "SOC e Monitoramento",
          weight: 1,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-r-soc-cobertura",
              text: "Qual a cobertura de monitoramento de segurança (SOC)?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["NIST CSF DE.CM", "Resolução BCB nº 85/2021"],
              options: [
                { id: "o1", label: "Sem monitoramento estruturado", scoreValue: 0 },
                { id: "o2", label: "Monitoramento em horário comercial", scoreValue: 50 },
                { id: "o3", label: "SOC 24x7 próprio ou terceirizado", scoreValue: 100 },
              ],
            },
            {
              id: "q-r-threat-intel",
              text: "A instituição consome e opera com inteligência de ameaças de forma estruturada (feeds, MITRE ATT&CK)?",
              type: "MATURITY_SCALE",
              weight: 0.9,
              regulatoryRefs: ["MITRE ATT&CK Framework", "NIST CSF ID.RA"],
              options: MATURITY_5,
            },
          ],
        },
        {
          id: "ctrl-ir-continuidade",
          name: "Resposta a Incidentes e Continuidade",
          weight: 1.1,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-r-plano-ir",
              text: "Existe plano formal de resposta a incidentes, testado com exercícios de simulação (tabletop)?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["NIST CSF RS.MA", "ISO 27001 A.5.24", "Resolução BCB nº 85/2021"],
              options: [
                { id: "o1", label: "Não existe plano formal", scoreValue: 0 },
                { id: "o2", label: "Plano existe, nunca testado", scoreValue: 35 },
                { id: "o3", label: "Plano testado uma vez ao ano", scoreValue: 70 },
                { id: "o4", label: "Plano testado periodicamente com melhoria contínua documentada", scoreValue: 100 },
              ],
            },
            {
              id: "q-r-bcp-testado",
              text: "O plano de continuidade de negócios (BCP/DR) foi testado nos últimos 12 meses, com RTO/RPO definidos?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["ISO 22301", "Resolução BCB nº 85/2021"],
              options: [
                { id: "o1", label: "Não existe BCP/DR", scoreValue: 0 },
                { id: "o2", label: "Existe, sem RTO/RPO definidos ou sem teste recente", scoreValue: 40 },
                { id: "o3", label: "Existe, com RTO/RPO definidos e testado no último ano", scoreValue: 100 },
              ],
            },
            {
              id: "q-r-uptime",
              text: "Uptime da plataforma nos últimos 90 dias",
              type: "METRIC",
              weight: 1,
              metricSource: "uptime_pct_90d",
              metricConfig: { target: 99.9, direction: "higher_is_better", worst: 95 },
            },
          ],
        },
        {
          id: "ctrl-iam",
          name: "Gestão de Identidade e Acesso",
          weight: 1,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-r-iam-mfa-pam",
              text: "Qual o nível de maturidade de MFA e gestão de acessos privilegiados (PAM)?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["NIST CSF PR.AA", "ISO 27001 A.8.5"],
              options: [
                { id: "o1", label: "Sem MFA ou gestão formal de acessos privilegiados", scoreValue: 0 },
                { id: "o2", label: "MFA parcial, sem PAM estruturado", scoreValue: 40 },
                { id: "o3", label: "MFA obrigatório para acessos críticos, com PAM básico", scoreValue: 75 },
                { id: "o4", label: "MFA universal, PAM com cofre de credenciais e revisão periódica de acessos", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-vuln-infra",
          name: "Gestão de Vulnerabilidades de Infraestrutura",
          weight: 0.9,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-r-scan-infra",
              text: "Com que frequência a infraestrutura (rede, servidores, cloud) passa por varredura de vulnerabilidades?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["NIST CSF ID.RA-01", "PCI DSS 11.3"],
              options: [
                { id: "o1", label: "Não há varredura estruturada", scoreValue: 0 },
                { id: "o2", label: "Varredura esporádica, sem SLA de remediação", scoreValue: 40 },
                { id: "o3", label: "Varredura mensal com SLA de remediação por criticidade", scoreValue: 80 },
                { id: "o4", label: "Varredura contínua, SLA por criticidade e pentest anual", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-observabilidade",
          name: "Observabilidade e Logging",
          weight: 0.8,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-r-siem-logs",
              text: "Existe SIEM/logging centralizado com retenção adequada à regulação aplicável?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["Resolução BCB nº 85/2021", "NIST CSF DE.AE"],
              options: [
                { id: "o1", label: "Sem centralização de logs", scoreValue: 0 },
                { id: "o2", label: "Logs centralizados, retenção abaixo do exigido", scoreValue: 40 },
                { id: "o3", label: "SIEM com retenção adequada e alertas configurados", scoreValue: 100 },
              ],
            },
          ],
        },
      ],
    },

    // ========================================================================
    // U — UNIFIED FINANCIAL PROTECTION
    // ========================================================================
    {
      id: "pillar-U-financial",
      code: "U",
      name: "Unified Financial Protection",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-prevencao-fraude",
          name: "Prevenção à Fraude",
          weight: 1.3,
          recommendedServiceId: "financial-protection",
          questions: [
            {
              id: "q-u-taxa-fraude",
              text: "Taxa de fraude mensal (bps sobre volume transacionado)",
              type: "METRIC",
              weight: 1,
              metricSource: "fraud_rate_monthly_bps",
              metricConfig: { target: 5, direction: "lower_is_better", worst: 50 },
            },
            {
              id: "q-u-motor-antifraude",
              text: "Qual o tipo de motor antifraude em produção?",
              type: "MULTIPLE_CHOICE",
              weight: 1.2,
              regulatoryRefs: ["NIST CSF PR.DS", "FFIEC CAT"],
              options: [
                { id: "o1", label: "Nenhum motor antifraude", scoreValue: 0 },
                { id: "o2", label: "Regras estáticas apenas", scoreValue: 40 },
                { id: "o3", label: "Regras + scoring baseado em modelo", scoreValue: 75 },
                { id: "o4", label: "Modelo de ML com aprendizado contínuo e resposta em tempo real", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-aml-kyc",
          name: "AML & KYC",
          weight: 1.2,
          recommendedServiceId: "financial-protection",
          questions: [
            {
              id: "q-u-kyc-onboarding",
              text: "O onboarding de clientes possui verificação de identidade (KYC) estruturada?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["Lei 9.613/1998", "Circular BCB nº 3.978/2020"],
              options: [
                { id: "o1", label: "Verificação manual/documental básica", scoreValue: 30 },
                { id: "o2", label: "Verificação documental + biometria facial", scoreValue: 70 },
                { id: "o3", label: "Verificação documental + biometria + checagem de listas restritivas em tempo real", scoreValue: 100 },
              ],
            },
            {
              id: "q-u-monitoramento-transacional",
              text: "Existe monitoramento transacional contínuo para detecção de lavagem de dinheiro?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["Circular BCB nº 3.978/2020", "Lei 9.613/1998"],
              options: [
                { id: "o1", label: "Não existe", scoreValue: 0 },
                { id: "o2", label: "Monitoramento por amostragem/manual", scoreValue: 40 },
                { id: "o3", label: "Monitoramento automatizado 24x7 com regras adaptativas", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-sancoes-pep",
          name: "Sanções e PEP",
          weight: 1,
          recommendedServiceId: "financial-protection",
          questions: [
            {
              id: "q-u-screening-sancoes",
              text: "Com que frequência as listas de sanções (OFAC, ONU) e PEP são atualizadas e re-checadas contra a base de clientes?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["Circular BCB nº 3.978/2020", "Lei 13.810/2019"],
              options: [
                { id: "o1", label: "Checagem apenas no cadastro inicial", scoreValue: 0 },
                { id: "o2", label: "Re-checagem periódica manual (trimestral ou mais)", scoreValue: 50 },
                { id: "o3", label: "Re-checagem automatizada diária contra listas atualizadas", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-pix-openfinance",
          name: "Pix & Open Finance",
          weight: 1.1,
          recommendedServiceId: "financial-protection",
          questions: [
            {
              id: "q-u-seguranca-pix",
              text: "A instituição possui controles antifraude específicos para Pix (monitoramento DICT, MED — Mecanismo Especial de Devolução)?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["Resolução BCB nº 195/2022 (MED)", "Resolução BCB nº 1/2020 (Pix)"],
              options: [
                { id: "o1", label: "Sem controles específicos para Pix", scoreValue: 0 },
                { id: "o2", label: "Monitoramento básico, sem processo formal de MED", scoreValue: 40 },
                { id: "o3", label: "Monitoramento antifraude dedicado a Pix e processo de MED estruturado", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-mule-accounts",
          name: "Contas Laranja / Mule Accounts",
          weight: 1,
          recommendedServiceId: "financial-protection",
          questions: [
            {
              id: "q-u-deteccao-mule",
              text: "Existe modelo ou processo dedicado à detecção de contas laranja (mule accounts)?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["Circular BCB nº 3.978/2020"],
              options: [
                { id: "o1", label: "Não existe", scoreValue: 0 },
                { id: "o2", label: "Detecção reativa (após denúncia ou ocorrência)", scoreValue: 40 },
                { id: "o3", label: "Modelo comportamental proativo de detecção", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-behavioral-analytics",
          name: "Behavioral Analytics",
          weight: 0.9,
          recommendedServiceId: "financial-protection",
          questions: [
            {
              id: "q-u-biometria-comportamental",
              text: "A instituição utiliza biometria comportamental ou análise de padrão de uso para detecção de fraude?",
              type: "MATURITY_SCALE",
              weight: 1,
              regulatoryRefs: ["FFIEC CAT", "NIST CSF PR.PT"],
              options: MATURITY_5,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // S — SECURE DIGITAL PLATFORMS
    // ========================================================================
    {
      id: "pillar-S-platforms",
      code: "S",
      name: "Secure Digital Platforms",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-secure-sdlc",
          name: "Secure SDLC",
          weight: 1,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-s-sast-dast",
              text: "Testes de segurança (SAST/DAST) estão integrados ao pipeline de CI/CD?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["OWASP SAMM", "NIST SSDF"],
              options: [
                { id: "o1", label: "Sem testes de segurança automatizados", scoreValue: 0 },
                { id: "o2", label: "Testes manuais pontuais", scoreValue: 40 },
                { id: "o3", label: "SAST/DAST integrados ao CI/CD com gate de bloqueio", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-vulnerability-mgmt",
          name: "Gestão de Vulnerabilidades de Aplicação",
          weight: 1,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-s-tempo-remediacao",
              text: "Tempo médio de remediação de vulnerabilidades críticas em aplicação (dias)",
              type: "METRIC",
              weight: 1,
              metricSource: "avg_days_to_remediate_critical",
              metricConfig: { target: 7, direction: "lower_is_better", worst: 60 },
            },
          ],
        },
        {
          id: "ctrl-api-security",
          name: "Segurança de APIs",
          weight: 1.1,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-s-api-security",
              text: "As APIs expostas seguem controles de segurança alinhados ao OWASP API Security Top 10 (gateway, rate limiting, mTLS)?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["OWASP API Security Top 10", "Resolução BCB nº 32/2020 (Open Finance)"],
              options: [
                { id: "o1", label: "Sem gateway ou controles formais de API", scoreValue: 0 },
                { id: "o2", label: "Gateway com autenticação básica, sem rate limiting/mTLS", scoreValue: 45 },
                { id: "o3", label: "Gateway com rate limiting e autenticação forte", scoreValue: 75 },
                { id: "o4", label: "Gateway completo: rate limiting, mTLS, testes de segurança periódicos", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-cloud-security",
          name: "Cloud Security",
          weight: 1,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-s-cspm",
              text: "A instituição possui gestão de postura de segurança em nuvem (CSPM) para detectar configurações incorretas?",
              type: "MATURITY_SCALE",
              weight: 1,
              regulatoryRefs: ["CSA Cloud Controls Matrix", "NIST CSF PR.PS"],
              options: MATURITY_5,
            },
          ],
        },
        {
          id: "ctrl-data-protection",
          name: "Proteção de Dados",
          weight: 1.1,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-s-criptografia-dlp",
              text: "Dados sensíveis são protegidos com criptografia em repouso/trânsito e existe DLP (Data Loss Prevention)?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["LGPD art. 46", "ISO 27001 A.8.24"],
              options: [
                { id: "o1", label: "Sem criptografia sistemática nem DLP", scoreValue: 0 },
                { id: "o2", label: "Criptografia em repouso, sem DLP", scoreValue: 50 },
                { id: "o3", label: "Criptografia em repouso e trânsito, sem DLP", scoreValue: 75 },
                { id: "o4", label: "Criptografia completa + DLP com monitoramento de vazamento", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-mobile-security",
          name: "Segurança Mobile",
          weight: 0.8,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-s-mobile-hardening",
              text: "Os aplicativos móveis possuem hardening (detecção de root/jailbreak, certificate pinning)?",
              type: "MATURITY_SCALE",
              weight: 1,
              regulatoryRefs: ["OWASP MASVS"],
              options: MATURITY_5,
            },
          ],
        },
        {
          id: "ctrl-ia-responsavel",
          name: "IA Responsável",
          weight: 0.9,
          recommendedServiceId: "cyber-operational-resilience",
          questions: [
            {
              id: "q-s-governanca-ia",
              text: "Existe governança formal sobre modelos de IA/ML utilizados (viés, explicabilidade, procedência dos dados de treino)?",
              type: "MATURITY_SCALE",
              weight: 1,
              regulatoryRefs: ["PL 2338/2023 (Marco Legal da IA)", "ISO/IEC 42001"],
              options: MATURITY_5,
            },
          ],
        },
      ],
    },

    // ========================================================================
    // T2 — TRUSTED ECOSYSTEM
    // ========================================================================
    {
      id: "pillar-T-ecosystem",
      code: "T2",
      name: "Trusted Ecosystem",
      weight: 0.2,
      controls: [
        {
          id: "ctrl-gestao-terceiros",
          name: "Gestão de Terceiros",
          weight: 1,
          recommendedServiceId: "executive-trust-advisory",
          questions: [
            {
              id: "q-t2-due-diligence",
              text: "Existe processo formal de due diligence de segurança para fornecedores e parceiros?",
              type: "MATURITY_SCALE",
              weight: 1,
              regulatoryRefs: ["ISO 27001 A.5.19", "Resolução BCB nº 85/2021"],
              options: MATURITY_5,
            },
            {
              id: "q-t2-risco-baas",
              text: "Parceiros BaaS/fintechs conectados à instituição têm SLA de segurança contratual e avaliação periódica de risco?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["Resolução BCB nº 85/2021", "ISO 27001 A.5.20"],
              options: [
                { id: "o1", label: "Sem SLA de segurança ou avaliação periódica", scoreValue: 0 },
                { id: "o2", label: "SLA contratual, sem reavaliação periódica", scoreValue: 45 },
                { id: "o3", label: "SLA contratual com reavaliação periódica de risco", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-compartilhamento-inteligencia",
          name: "Compartilhamento de Inteligência",
          weight: 1,
          recommendedServiceId: "continuous-trust",
          questions: [
            {
              id: "q-t2-participacao-comunidade",
              text: "A instituição participa de iniciativas setoriais de troca de inteligência contra fraude?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["FEBRABAN", "Circular BCB nº 3.978/2020"],
              options: [
                { id: "o1", label: "Não participa de nenhuma iniciativa setorial", scoreValue: 0 },
                { id: "o2", label: "Participa esporadicamente", scoreValue: 50 },
                { id: "o3", label: "Participa ativamente (ex: consórcios antifraude, ISACs, FEBRABAN)", scoreValue: 100 },
              ],
            },
            {
              id: "q-t2-conformidade-open-finance",
              text: "A instituição mantém conformidade contínua como participante do Open Finance (certificação, testes periódicos)?",
              type: "MULTIPLE_CHOICE",
              weight: 1,
              regulatoryRefs: ["Resolução BCB nº 32/2020", "Estrutura Participante Open Finance Brasil"],
              options: [
                { id: "o1", label: "Não é participante ou não mantém conformidade contínua", scoreValue: 0 },
                { id: "o2", label: "Participante certificado, sem testes periódicos formais", scoreValue: 50 },
                { id: "o3", label: "Participante certificado com testes de conformidade periódicos", scoreValue: 100 },
              ],
            },
          ],
        },
        {
          id: "ctrl-reguladores",
          name: "Relação com Reguladores",
          weight: 0.9,
          recommendedServiceId: "executive-trust-advisory",
          questions: [
            {
              id: "q-t2-transparencia-reguladores",
              text: "A instituição possui canal proativo de comunicação e reporte com reguladores (Bacen e demais)?",
              type: "MATURITY_SCALE",
              weight: 1,
              regulatoryRefs: ["Resolução BCB nº 85/2021"],
              options: MATURITY_5,
            },
          ],
        },
      ],
    },
  ],
};
