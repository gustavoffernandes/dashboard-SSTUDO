/**
 * PROART Methodology - Dr. Emílio Peres Facas (UnB)
 * Protocol for Psychosocial Risk Assessment at Work
 * 
 * 4 Scales, 10 Factors, 91 Questions
 * Risk Classification + P×S Matrix (SESI 2022)
 */

// ========== SCALE & FACTOR DEFINITIONS ==========

export type ScaleType = "positive" | "negative" | "mixed";
export type RiskLevel = "low" | "medium" | "high";
export type PRLevel = "NA" | "PR4" | "PR3" | "PR2" | "PR1";

export interface ProartFactor {
  id: string;
  scaleId: string;
  name: string;
  shortName: string;
  type: "positive" | "negative";
  questionIds: string[];
  cronbach: number;
}

export interface ProartScale {
  id: string;
  name: string;
  shortName: string;
  type: ScaleType;
  questionCount: number;
  factors: ProartFactor[];
}

// Inverted questions (global numbering 1-19, 25-31, 37)
// c1-c19 (all EOT), g6-g12 (EEG), g18 (EEG)
export const INVERTED_QUESTION_IDS = new Set([
  "c1","c2","c3","c4","c5","c6","c7","c8","c9","c10",
  "c11","c12","c13","c14","c15","c16","c17","c18","c19",
  "g6","g7","g8","g9","g10","g11","g12",
  "g18"
]);

export const PROART_SCALES: ProartScale[] = [
  {
    id: "contexto",
    name: "Escala de Organização do Trabalho (EOT)",
    shortName: "EOT",
    type: "positive",
    questionCount: 19,
    factors: [
      {
        id: "divisao_tarefas",
        scaleId: "contexto",
        name: "Divisão das Tarefas",
        shortName: "Div. Tarefas",
        type: "positive",
        questionIds: ["c1","c2","c3","c4","c5","c6","c7"],
        cronbach: 0.89,
      },
      {
        id: "divisao_social",
        scaleId: "contexto",
        name: "Divisão Social do Trabalho",
        shortName: "Div. Social",
        type: "positive",
        questionIds: ["c8","c9","c10","c11","c12","c13","c14","c15","c16","c17","c18","c19"],
        cronbach: 0.87,
      },
    ],
  },
  {
    id: "gestao",
    name: "Escala de Estilos de Gestão (EEG)",
    shortName: "EEG",
    type: "mixed",
    questionCount: 21,
    factors: [
      {
        id: "individualista",
        scaleId: "gestao",
        name: "Estilo Individualista",
        shortName: "Individualista",
        type: "negative",
        questionIds: ["g1","g2","g3","g4","g5","g6","g7","g8","g9","g10","g11"],
        cronbach: 0.85,
      },
      {
        id: "coletivista",
        scaleId: "gestao",
        name: "Estilo Coletivista",
        shortName: "Coletivista",
        type: "positive",
        questionIds: ["g12","g13","g14","g15","g16","g17","g18","g19","g20","g21"],
        cronbach: 0.88,
      },
    ],
  },
  {
    id: "vivencias",
    name: "Escala de Indicadores de Sofrimento no Trabalho (EIST)",
    shortName: "EIST",
    type: "negative",
    questionCount: 28,
    factors: [
      {
        id: "falta_sentido",
        scaleId: "vivencias",
        name: "Falta de Sentido no Trabalho",
        shortName: "Falta Sentido",
        type: "negative",
        questionIds: ["v1","v2","v3","v4","v5","v6","v7","v8","v9"],
        cronbach: 0.91,
      },
      {
        id: "esgotamento",
        scaleId: "vivencias",
        name: "Esgotamento Mental",
        shortName: "Esgotamento",
        type: "negative",
        questionIds: ["v10","v11","v12","v13","v14","v15","v16","v17"],
        cronbach: 0.93,
      },
      {
        id: "falta_reconhecimento",
        scaleId: "vivencias",
        name: "Falta de Reconhecimento",
        shortName: "Falta Reconhec.",
        type: "negative",
        questionIds: ["v18","v19","v20","v21","v22","v23","v24","v25","v26","v27","v28"],
        cronbach: 0.89,
      },
    ],
  },
  {
    id: "saude",
    name: "Escala de Danos Relacionados ao Trabalho (EDT)",
    shortName: "EDT",
    type: "negative",
    questionCount: 23,
    factors: [
      {
        id: "danos_psicologicos",
        scaleId: "saude",
        name: "Danos Psicológicos",
        shortName: "D. Psicológicos",
        type: "negative",
        questionIds: ["s1","s2","s3","s4","s5","s6","s7"],
        cronbach: 0.94,
      },
      {
        id: "danos_sociais",
        scaleId: "saude",
        name: "Danos Sociais",
        shortName: "D. Sociais",
        type: "negative",
        questionIds: ["s8","s9","s10","s11","s12","s13","s14"],
        cronbach: 0.89,
      },
      {
        id: "danos_fisicos",
        scaleId: "saude",
        name: "Danos Físicos",
        shortName: "D. Físicos",
        type: "negative",
        questionIds: ["s15","s16","s17","s18","s19","s20","s21","s22","s23"],
        cronbach: 0.92,
      },
    ],
  },
];

export const ALL_FACTORS = PROART_SCALES.flatMap(s => s.factors);

// Map question id -> factor for fast lookup
const QUESTION_TO_FACTOR: Record<string, ProartFactor> = (() => {
  const m: Record<string, ProartFactor> = {};
  ALL_FACTORS.forEach(f => f.questionIds.forEach(qid => { m[qid] = f; }));
  return m;
})();

export function getFactorByQuestionId(questionId: string): ProartFactor | undefined {
  return QUESTION_TO_FACTOR[questionId];
}

// ========== RISK CLASSIFICATION ==========

/**
 * Classify risk based on PROART methodology
 * Positive scales: ≥3.70 = LOW, 2.30-3.69 = MEDIUM, <2.30 = HIGH
 * Negative scales: ≤2.29 = LOW, 2.30-3.69 = MEDIUM, ≥3.70 = HIGH
 */
export function classifyRisk(value: number, type: "positive" | "negative"): RiskLevel {
  if (type === "positive") {
    if (value >= 3.70) return "low";
    if (value >= 2.30) return "medium";
    return "high";
  } else {
    if (value <= 2.29) return "low";
    if (value <= 3.69) return "medium";
    return "high";
  }
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case "low": return "Risco Baixo";
    case "medium": return "Risco Médio";
    case "high": return "Risco Alto";
  }
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "low": return "text-success";
    case "medium": return "text-warning";
    case "high": return "text-destructive";
  }
}

export function getRiskBgColor(level: RiskLevel): string {
  switch (level) {
    case "low": return "bg-success/15";
    case "medium": return "bg-warning/15";
    case "high": return "bg-destructive/15";
  }
}

// ========== P×S MATRIX (SESI 2022) ==========

/**
 * Auto-calculate P×S variables from survey data
 * E (Exposure): Mapped from EIST average (frequency of suffering)
 * C (Control): Mapped from EOT average (inverted - higher = better control = lower value)
 * G (Severity): Mapped from EDT average (severity of damages)
 * PE (People Exposed): Mapped from % of respondents with high risk
 */
function mapScoreToVariable(score: number, type: "positive" | "negative"): number {
  // Map 1-5 average to 1-4 variable
  if (type === "negative") {
    // Higher score = worse = higher variable
    if (score >= 3.70) return 4;
    if (score >= 2.70) return 3;
    if (score >= 1.70) return 2;
    return 1;
  } else {
    // Higher score = better = lower variable (inverted)
    if (score >= 3.70) return 1;
    if (score >= 2.70) return 2;
    if (score >= 1.70) return 3;
    return 4;
  }
}

export function calculatePxS(
  eotAvg: number,
  eegColAvg: number,
  eistAvg: number,
  edtAvg: number,
  totalRespondents: number,
  highRiskCount: number,
): { P: number; S: number; risk: number; prLevel: PRLevel; deadlineDays: number } {
  const E = mapScoreToVariable(eistAvg, "negative"); // Exposure from EIST
  const C = mapScoreToVariable((eotAvg + eegColAvg) / 2, "positive"); // Control from EOT + EEG-Col
  const G = mapScoreToVariable(edtAvg, "negative"); // Severity from EDT

  // PE based on percentage of high risk respondents
  const highRiskPct = totalRespondents > 0 ? (highRiskCount / totalRespondents) * 100 : 0;
  let PE: number;
  if (highRiskPct >= 75) PE = 4;
  else if (highRiskPct >= 50) PE = 3;
  else if (highRiskPct >= 25) PE = 2;
  else PE = 1;

  const P = Math.min(5, Math.floor((E + C * 2) / 3) + 1);
  const S = Math.min(5, Math.floor((G * 2 + PE) / 3) + 1);
  const risk = P * S;

  let prLevel: PRLevel;
  let deadlineDays: number;
  if (risk >= 25) { prLevel = "PR1"; deadlineDays = 0; }
  else if (risk >= 15) { prLevel = "PR2"; deadlineDays = 30; }
  else if (risk >= 10) { prLevel = "PR3"; deadlineDays = 90; }
  else if (risk >= 6) { prLevel = "PR4"; deadlineDays = 180; }
  else { prLevel = "NA"; deadlineDays = 365; }

  return { P, S, risk, prLevel, deadlineDays };
}

export function getPRLevelLabel(level: PRLevel): string {
  switch (level) {
    case "PR1": return "PR1 - Ação Imediata";
    case "PR2": return "PR2 - 30 dias";
    case "PR3": return "PR3 - 90 dias";
    case "PR4": return "PR4 - 180 dias";
    case "NA": return "NA - Manter";
  }
}

export function getPRLevelColor(level: PRLevel): string {
  switch (level) {
    case "PR1": return "text-destructive";
    case "PR2": return "text-destructive";
    case "PR3": return "text-warning";
    case "PR4": return "text-primary";
    case "NA": return "text-success";
  }
}

export function getPRLevelBgColor(level: PRLevel): string {
  switch (level) {
    case "PR1": return "bg-destructive/20";
    case "PR2": return "bg-destructive/15";
    case "PR3": return "bg-warning/15";
    case "PR4": return "bg-primary/15";
    case "NA": return "bg-success/15";
  }
}

// ========== PRE-DEFINED ACTION PLANS ==========

export interface SuggestedTaskDetail {
  title: string;
  porQue: string;
  como: string;
}

export interface SuggestedAction {
  factorId: string;
  riskLevel: RiskLevel;
  title: string;
  tasks: SuggestedTaskDetail[];
}

export const SUGGESTED_ACTIONS: SuggestedAction[] = [
  // EOT - Divisão das Tarefas
  { factorId: "divisao_tarefas", riskLevel: "high", title: "Reestruturar condições de trabalho", tasks: [
    { title: "Avaliar adequação do quadro de funcionários vs demanda", porQue: "A sobrecarga de trabalho compromete a saúde mental e a produtividade dos trabalhadores", como: "Realizar levantamento de demandas por setor e comparar com o efetivo disponível, identificando gaps" },
    { title: "Mapear necessidades de recursos e equipamentos", porQue: "Recursos inadequados geram frustração e aumentam o risco de adoecimento ocupacional", como: "Aplicar checklist de recursos por posto de trabalho e elaborar plano de aquisição priorizado" },
    { title: "Revisar prazos e metas de produtividade", porQue: "Metas inalcançáveis são fonte de esgotamento e desmotivação conforme a metodologia PROART", como: "Reunir gestores e equipes para redefinir metas com base em dados reais de capacidade produtiva" },
    { title: "Implementar programa de manutenção preventiva de equipamentos", porQue: "Equipamentos defeituosos prejudicam o fluxo de trabalho e aumentam riscos físicos", como: "Criar cronograma de manutenções preventivas e designar responsáveis por setor" },
    { title: "Criar canal de solicitação de recursos", porQue: "A falta de canais formais impede que necessidades sejam comunicadas à gestão", como: "Disponibilizar formulário digital para solicitações e definir fluxo de análise e resposta em até 48h" },
  ]},
  { factorId: "divisao_tarefas", riskLevel: "medium", title: "Melhorar condições de trabalho", tasks: [
    { title: "Realizar pesquisa de necessidades de recursos", porQue: "Identificar carências permite ações preventivas antes que se tornem fatores de risco alto", como: "Aplicar questionário rápido por setor sobre condições materiais e de infraestrutura" },
    { title: "Ajustar ritmo de trabalho com base no feedback", porQue: "O ritmo inadequado é precursor de esgotamento mental segundo a EOT", como: "Coletar feedback mensal das equipes e realizar ajustes no planejamento de atividades" },
    { title: "Revisar adequação do espaço físico", porQue: "Ambientes inadequados impactam negativamente o bem-estar e a produtividade", como: "Realizar vistoria ergonômica dos postos de trabalho e implementar melhorias prioritárias" },
  ]},
  // EOT - Divisão Social
  { factorId: "divisao_social", riskLevel: "high", title: "Promover participação e autonomia", tasks: [
    { title: "Implementar reuniões participativas de planejamento", porQue: "A exclusão dos trabalhadores das decisões gera falta de sentido e desmotivação", como: "Agendar reuniões quinzenais onde a equipe participe do planejamento de atividades do setor" },
    { title: "Criar programa de comunicação organizacional", porQue: "A comunicação deficiente é fator de risco identificado na Divisão Social do Trabalho", como: "Implementar boletins informativos, murais e reuniões de alinhamento com periodicidade definida" },
    { title: "Estabelecer canais de feedback ascendente", porQue: "Trabalhadores precisam de voz ativa para que a gestão identifique problemas precocemente", como: "Criar caixa de sugestões anônima e reuniões trimestrais de escuta ativa com a liderança" },
    { title: "Revisar critérios de avaliação de desempenho", porQue: "Critérios injustos ou pouco claros geram percepção de injustiça organizacional", como: "Revisar indicadores com participação dos trabalhadores e adotar avaliação 360°" },
    { title: "Promover autonomia nas tarefas rotineiras", porQue: "A falta de autonomia está associada a maior sofrimento no trabalho conforme o PROART", como: "Identificar tarefas que podem ter execução flexibilizada e delegar decisões operacionais às equipes" },
  ]},
  { factorId: "divisao_social", riskLevel: "medium", title: "Fortalecer comunicação interna", tasks: [
    { title: "Realizar workshops de comunicação eficaz", porQue: "Melhorar a comunicação previne conflitos e fortalece relações interpessoais", como: "Contratar facilitador para workshops práticos com dinâmicas de comunicação não-violenta" },
    { title: "Revisar fluxos de informação entre setores", porQue: "Falhas na comunicação intersetorial comprometem a coordenação do trabalho", como: "Mapear fluxos atuais e redesenhar processos de comunicação com pontos focais por setor" },
    { title: "Criar espaços de diálogo entre equipes", porQue: "O diálogo fortalece o senso de coletividade e reduz conflitos organizacionais", como: "Organizar encontros mensais informais entre equipes de diferentes setores" },
  ]},
  // EEG - Individualista
  { factorId: "individualista", riskLevel: "high", title: "Reformular estilo de gestão", tasks: [
    { title: "Capacitar lideranças em gestão participativa", porQue: "O estilo individualista centraliza decisões e gera insatisfação conforme a EEG", como: "Contratar programa de desenvolvimento gerencial focado em liderança colaborativa e escuta ativa" },
    { title: "Reduzir centralização de decisões", porQue: "A centralização excessiva sobrecarrega gestores e desmotiva equipes", como: "Definir matriz de autoridade com delegação clara de decisões operacionais para líderes de equipe" },
    { title: "Implementar programa de desenvolvimento de líderes", porQue: "Líderes preparados são essenciais para um ambiente de trabalho saudável", como: "Criar trilha de desenvolvimento com módulos de inteligência emocional, feedback e gestão de conflitos" },
    { title: "Criar comitês de decisão compartilhada", porQue: "Decisões compartilhadas aumentam o comprometimento e a qualidade das soluções", como: "Formar comitês multidisciplinares para decisões estratégicas com representantes de cada setor" },
    { title: "Estabelecer política de gestão horizontal", porQue: "Estruturas muito hierárquicas dificultam a inovação e a participação", como: "Documentar política de portas abertas e implementar rodízio de coordenação em projetos" },
  ]},
  { factorId: "individualista", riskLevel: "medium", title: "Desenvolver lideranças", tasks: [
    { title: "Oferecer treinamento em liderança colaborativa", porQue: "Desenvolver habilidades de gestão previne a consolidação de estilos autoritários", como: "Organizar ciclo de capacitação trimestral com temas de liderança servidora e gestão de pessoas" },
    { title: "Implementar avaliação 360° para gestores", porQue: "O feedback multidirecional permite que líderes identifiquem pontos de melhoria", como: "Adotar ferramenta de avaliação 360° com devolutiva individual e plano de desenvolvimento" },
    { title: "Criar programa de mentoria", porQue: "Mentoria promove desenvolvimento profissional e fortalece relações de confiança", como: "Parear gestores experientes com novos líderes em programa estruturado de 6 meses" },
  ]},
  // EEG - Coletivista
  { factorId: "coletivista", riskLevel: "high", title: "Fortalecer cultura colaborativa", tasks: [
    { title: "Implementar projetos interdepartamentais", porQue: "A colaboração entre setores fortalece o senso de coletividade e integração", como: "Identificar projetos estratégicos que envolvam equipes de diferentes áreas e designar líderes rotativos" },
    { title: "Criar programa de reconhecimento coletivo", porQue: "O reconhecimento apenas individual enfraquece o espírito de equipe", como: "Implementar premiação mensal de equipes com critérios de colaboração e resultados coletivos" },
    { title: "Promover eventos de integração de equipes", porQue: "Vínculos interpessoais saudáveis são protetores contra o sofrimento no trabalho", como: "Organizar encontros trimestrais de confraternização e atividades de team building" },
    { title: "Estabelecer metas de equipe além de individuais", porQue: "Metas exclusivamente individuais estimulam competição prejudicial ao coletivo", como: "Revisar sistema de metas incluindo indicadores coletivos com peso mínimo de 40%" },
    { title: "Valorizar inovação com programa de ideias", porQue: "A participação criativa fortalece o sentimento de pertencimento e valor", como: "Criar plataforma de ideias com avaliação coletiva e implementação das melhores sugestões" },
  ]},
  { factorId: "coletivista", riskLevel: "medium", title: "Incentivar trabalho em equipe", tasks: [
    { title: "Promover dinâmicas de team building", porQue: "Atividades de integração fortalecem vínculos e melhoram a cooperação", como: "Realizar atividades práticas de team building mensalmente com facilitador externo" },
    { title: "Criar espaços de compartilhamento de boas práticas", porQue: "Compartilhar conhecimento gera valorização e aprendizado coletivo", como: "Organizar apresentações curtas semanais onde equipes compartilhem soluções e aprendizados" },
    { title: "Implementar sistema de sugestões", porQue: "Dar voz aos trabalhadores demonstra valorização e abre espaço para melhorias", como: "Criar canal digital de sugestões com feedback obrigatório da gestão em até 15 dias" },
  ]},
  // EIST - Falta de Sentido
  { factorId: "falta_sentido", riskLevel: "high", title: "Resgatar sentido e propósito no trabalho", tasks: [
    { title: "Alinhar tarefas com propósito organizacional", porQue: "A falta de sentido no trabalho é indicador grave de sofrimento conforme a EIST", como: "Realizar workshops de propósito conectando o trabalho de cada setor à missão da organização" },
    { title: "Implementar programa de job rotation", porQue: "A monotonia e repetitividade esvaziam o sentido do trabalho", como: "Criar programa de rodízio entre funções compatíveis, com período mínimo de 3 meses" },
    { title: "Criar programa de desenvolvimento de carreira", porQue: "A ausência de perspectiva de crescimento reduz o engajamento e o sentido", como: "Estruturar plano de carreira com trilhas de desenvolvimento e critérios claros de progressão" },
    { title: "Conectar resultados individuais ao impacto social", porQue: "Perceber o impacto do próprio trabalho é fundamental para o bem-estar psicológico", como: "Produzir relatórios de impacto mostrando como o trabalho de cada área beneficia a comunidade" },
    { title: "Realizar workshops de propósito e significado", porQue: "Reflexões sobre propósito ajudam os trabalhadores a ressignificar sua atividade", como: "Contratar facilitador para dinâmicas de autoconhecimento e conexão com valores pessoais e organizacionais" },
  ]},
  { factorId: "falta_sentido", riskLevel: "medium", title: "Fortalecer propósito organizacional", tasks: [
    { title: "Comunicar impacto do trabalho de cada área", porQue: "Trabalhadores que compreendem seu impacto têm maior satisfação e menor sofrimento", como: "Criar informativos mensais destacando conquistas e contribuições de cada setor" },
    { title: "Oferecer oportunidades de aprendizado", porQue: "O desenvolvimento contínuo renova o interesse e o engajamento no trabalho", como: "Disponibilizar plataforma de cursos e liberar horas semanais para capacitação" },
    { title: "Diversificar atividades rotineiras", porQue: "A variabilidade de tarefas previne a monotonia e mantém o engajamento", como: "Reorganizar distribuição de tarefas incluindo atividades desafiadoras junto às rotineiras" },
  ]},
  // EIST - Esgotamento
  { factorId: "esgotamento", riskLevel: "high", title: "Combater esgotamento mental", tasks: [
    { title: "Implementar programa de saúde mental no trabalho", porQue: "O esgotamento mental é indicador de sofrimento grave que pode evoluir para adoecimento", como: "Contratar psicólogo organizacional e criar programa com ações preventivas e de acolhimento" },
    { title: "Oferecer apoio psicológico (EAP)", porQue: "O acesso a suporte profissional é essencial para trabalhadores em sofrimento", como: "Contratar Programa de Assistência ao Empregado com atendimento psicológico gratuito e sigiloso" },
    { title: "Revisar carga de trabalho e distribuição de tarefas", porQue: "A sobrecarga é a principal causa de esgotamento identificada pela EIST", como: "Realizar análise de carga por posto de trabalho e redistribuir tarefas de forma equitativa" },
    { title: "Criar política de desconexão digital", porQue: "A hiperconectividade impede a recuperação mental fora do expediente", como: "Implementar política formal de não-comunicação fora do horário de trabalho, exceto emergências" },
    { title: "Implementar pausas programadas e ginástica laboral", porQue: "Pausas regulares são comprovadamente eficazes na prevenção do esgotamento", como: "Estabelecer pausas de 10 minutos a cada 2 horas e contratar profissional para ginástica laboral diária" },
  ]},
  { factorId: "esgotamento", riskLevel: "medium", title: "Prevenir esgotamento", tasks: [
    { title: "Monitorar indicadores de carga de trabalho", porQue: "O monitoramento contínuo permite intervenção precoce antes do agravamento", como: "Criar dashboard de horas extras, absenteísmo e produtividade para acompanhamento mensal" },
    { title: "Oferecer workshops de gerenciamento de estresse", porQue: "Técnicas de manejo do estresse são fatores protetores da saúde mental", como: "Organizar workshops trimestrais com técnicas de mindfulness, respiração e organização pessoal" },
    { title: "Implementar flexibilidade de horários quando possível", porQue: "A flexibilidade promove equilíbrio entre vida pessoal e profissional", como: "Avaliar postos de trabalho compatíveis com horário flexível e implementar programa piloto" },
  ]},
  // EIST - Falta de Reconhecimento
  { factorId: "falta_reconhecimento", riskLevel: "high", title: "Criar cultura de reconhecimento", tasks: [
    { title: "Implementar programa formal de reconhecimento", porQue: "A falta de reconhecimento é fonte de sofrimento e desmotivação conforme a EIST", como: "Criar programa com critérios claros de reconhecimento público, premiações e incentivos mensais" },
    { title: "Criar canais de expressão e diálogo", porQue: "A impossibilidade de expressar sentimentos agrava o sofrimento no trabalho", como: "Implementar rodas de conversa mensais e espaços seguros de escuta com mediação profissional" },
    { title: "Revisar política de feedback contínuo", porQue: "Feedback regular é essencial para que o trabalhador perceba seu valor na organização", como: "Treinar gestores em técnicas de feedback construtivo e estabelecer frequência mínima mensal" },
    { title: "Estabelecer programa de valorização profissional", porQue: "A valorização fortalece a identidade profissional e o sentido do trabalho", como: "Criar cerimônias de reconhecimento, certificados de destaque e oportunidades de crescimento" },
    { title: "Implementar pesquisa de clima organizacional periódica", porQue: "Monitorar o clima permite identificar problemas de reconhecimento antes que se agravem", como: "Aplicar pesquisa de clima semestral com devolutiva e plano de ação para pontos críticos" },
  ]},
  { factorId: "falta_reconhecimento", riskLevel: "medium", title: "Melhorar reconhecimento", tasks: [
    { title: "Implementar feedback regular das lideranças", porQue: "Feedback frequente demonstra atenção e valorização do trabalho realizado", como: "Estabelecer reuniões individuais mensais de 15 minutos entre líder e cada membro da equipe" },
    { title: "Criar programa de destaque mensal", porQue: "O reconhecimento público incentiva boas práticas e valoriza os trabalhadores", como: "Implementar quadro de destaques do mês com votação entre pares e reconhecimento em reunião geral" },
    { title: "Promover diálogo aberto entre equipes", porQue: "O diálogo aberto fortalece relações e demonstra valorização das opiniões", como: "Realizar encontros quinzenais de equipe com pauta aberta para discussão de melhorias" },
  ]},
  // EDT - Danos Psicológicos
  { factorId: "danos_psicologicos", riskLevel: "high", title: "Intervir em danos psicológicos", tasks: [
    { title: "Encaminhar para avaliação psicológica especializada", porQue: "Danos psicológicos graves requerem intervenção profissional imediata conforme a EDT", como: "Estabelecer convênio com clínica psicológica e criar fluxo de encaminhamento com sigilo garantido" },
    { title: "Implementar programa de apoio emocional", porQue: "O suporte emocional no ambiente de trabalho reduz a gravidade dos danos psicológicos", como: "Disponibilizar psicólogo no local de trabalho semanalmente para atendimento individual e grupal" },
    { title: "Criar grupo de apoio entre pares", porQue: "O suporte entre colegas é fator protetivo contra o adoecimento psicológico", como: "Formar grupos de apoio voluntários com capacitação em acolhimento e escuta empática" },
    { title: "Oferecer acompanhamento psicoterapêutico", porQue: "A psicoterapia é intervenção essencial para tratamento de danos psicológicos instalados", como: "Subsidiar sessões de psicoterapia para trabalhadores identificados com sofrimento significativo" },
    { title: "Revisar fatores organizacionais causadores", porQue: "Sem tratar as causas organizacionais, os danos psicológicos tendem a recorrer", como: "Realizar análise dos fatores de contexto e gestão que contribuem para o adoecimento e implementar mudanças" },
  ]},
  { factorId: "danos_psicologicos", riskLevel: "medium", title: "Prevenir danos psicológicos", tasks: [
    { title: "Oferecer rodas de conversa sobre saúde emocional", porQue: "A psicoeducação aumenta a consciência e previne o agravamento de sintomas", como: "Organizar rodas de conversa mensais com temas de saúde mental, mediadas por profissional de psicologia" },
    { title: "Monitorar indicadores de bem-estar", porQue: "O acompanhamento contínuo permite intervenção precoce em situações de risco", como: "Aplicar escala breve de bem-estar trimestralmente e acompanhar tendências por setor" },
    { title: "Capacitar líderes para identificar sinais de sofrimento", porQue: "Líderes são os primeiros a perceber mudanças de comportamento que indicam sofrimento", como: "Oferecer treinamento em primeiros socorros psicológicos e sinais de alerta de adoecimento mental" },
  ]},
  // EDT - Danos Sociais
  { factorId: "danos_sociais", riskLevel: "high", title: "Intervir em danos sociais", tasks: [
    { title: "Avaliar relações interpessoais no ambiente de trabalho", porQue: "Danos sociais indicam deterioração das relações que afeta a saúde e o trabalho coletivo", como: "Aplicar sociograma e entrevistas individuais para mapear conflitos e dinâmicas relacionais tóxicas" },
    { title: "Implementar programa de mediação de conflitos", porQue: "Conflitos não resolvidos escalam e agravam os danos sociais identificados pela EDT", como: "Capacitar mediadores internos e criar fluxo formal de resolução de conflitos com sigilo" },
    { title: "Criar atividades de integração social", porQue: "O isolamento social no trabalho é fator de risco para adoecimento", como: "Organizar atividades sociais regulares que promovam interação entre diferentes setores e hierarquias" },
    { title: "Oferecer apoio para conflitos familiares relacionados ao trabalho", porQue: "O trabalho pode deteriorar relações familiares, gerando um ciclo de sofrimento", como: "Disponibilizar orientação familiar e psicossocial como parte do programa de assistência ao empregado" },
    { title: "Implementar política anti-assédio", porQue: "O assédio é causa direta de danos sociais graves e deve ser combatido formalmente", como: "Elaborar política institucional anti-assédio com canais de denúncia, investigação e medidas disciplinares" },
  ]},
  { factorId: "danos_sociais", riskLevel: "medium", title: "Prevenir isolamento social", tasks: [
    { title: "Promover atividades de integração", porQue: "Atividades de integração fortalecem vínculos e previnem o isolamento", como: "Organizar confraternizações mensais e atividades colaborativas entre equipes" },
    { title: "Criar espaços de convivência", porQue: "Espaços adequados para interação informal promovem socialização saudável", como: "Adequar áreas de convivência com conforto e incentivar pausas para café coletivo" },
    { title: "Monitorar relações interpessoais", porQue: "Acompanhar a qualidade das relações permite intervenção antes do agravamento", como: "Incluir questões sobre relações interpessoais na pesquisa de clima e agir sobre os resultados" },
  ]},
  // EDT - Danos Físicos
  { factorId: "danos_fisicos", riskLevel: "high", title: "Intervir em danos físicos", tasks: [
    { title: "Encaminhar para avaliação médica ocupacional", porQue: "Danos físicos graves requerem avaliação médica e possível afastamento conforme a EDT", como: "Realizar exames médicos ocupacionais em todos os trabalhadores do setor e encaminhar casos críticos" },
    { title: "Revisar ergonomia dos postos de trabalho", porQue: "Postos inadequados são causa direta de dores, lesões e danos físicos", como: "Contratar análise ergonômica do trabalho (AET) e implementar adequações nos postos prioritários" },
    { title: "Implementar programa de ginástica laboral", porQue: "A ginástica laboral previne lesões musculoesqueléticas e reduz queixas físicas", como: "Contratar profissional de educação física para sessões diárias de 15 minutos por turno" },
    { title: "Avaliar e corrigir riscos ergonômicos", porQue: "Riscos ergonômicos não corrigidos levam a lesões crônicas e afastamentos", como: "Realizar laudo ergonômico completo e implementar plano de correções com cronograma definido" },
    { title: "Criar programa de prevenção de LER/DORT", porQue: "LER/DORT são as principais causas de afastamento ocupacional no Brasil", como: "Implementar programa com exercícios preventivos, rodízio de tarefas e acompanhamento fisioterapêutico" },
  ]},
  { factorId: "danos_fisicos", riskLevel: "medium", title: "Prevenir danos físicos", tasks: [
    { title: "Oferecer orientação ergonômica", porQue: "A conscientização sobre postura e ergonomia reduz a incidência de queixas físicas", como: "Realizar palestras e distribuir material educativo sobre ergonomia no posto de trabalho" },
    { title: "Implementar pausas ativas", porQue: "Pausas com movimentação previnem lesões por esforço repetitivo", como: "Estabelecer pausas de 5 minutos a cada hora para alongamento orientado" },
    { title: "Monitorar queixas de saúde física", porQue: "O acompanhamento permite identificar tendências e agir preventivamente", como: "Criar registro de queixas de saúde por setor e analisar mensalmente para ações preventivas" },
  ]},
];

export function getSuggestedActions(factorId: string, riskLevel: RiskLevel): SuggestedAction | undefined {
  return SUGGESTED_ACTIONS.find(a => a.factorId === factorId && a.riskLevel === riskLevel);
}

// ========== P×S MATRIX DISPLAY ==========

export const PXS_MATRIX: number[][] = [
  [5, 10, 15, 20, 25],  // P=5
  [4,  8, 12, 16, 20],  // P=4
  [3,  6,  9, 12, 15],  // P=3
  [2,  4,  6,  8, 10],  // P=2
  [1,  2,  3,  4,  5],  // P=1
];

export function getMatrixCellPR(value: number): PRLevel {
  if (value >= 25) return "PR1";
  if (value >= 15) return "PR2";
  if (value >= 10) return "PR3";
  if (value >= 6) return "PR4";
  return "NA";
}
