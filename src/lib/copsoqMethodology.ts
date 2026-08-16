/**
 * COPSOQ II-Br — Metodologia de pontuação, classificação e matriz P×S
 *
 * Cada dimensão é a SOMA dos seus itens, com faixas próprias
 * (seguro / atenção / risco). Comportamentos ofensivos não são classificados.
 */

import { COPSOQ_QUESTIONS, type CopsoqQuestion } from "@/lib/copsoqQuestions";
import type { RiskLevel, PRLevel } from "@/lib/proartMethodology";

export type CopsoqClass = "seguro" | "atencao" | "risco";

export interface CopsoqDimension {
  id: string;
  domainId: string;
  name: string;
  shortName: string;
  /** negative = quanto maior a pontuação, maior o risco */
  type: "positive" | "negative";
  questionIds: string[];
  maxScore: number;
  /** limites superiores inclusivos, na direção da pontuação */
  safeMin?: number;   // usado quando type = positive (seguro é pontuação alta)
  safeMax?: number;   // usado quando type = negative (seguro é pontuação baixa)
  attentionMin?: number;
  attentionMax?: number;
  scorable: boolean;
}

export interface CopsoqDomain {
  id: string;
  name: string;
  shortName: string;
  dimensions: CopsoqDimension[];
}

const qIds = (dimensionId: string) =>
  COPSOQ_QUESTIONS.filter(q => q.dimensionId === dimensionId).map(q => q.id);

function dim(
  id: string, domainId: string, name: string, shortName: string,
  type: "positive" | "negative", maxScore: number,
  bands: { safeMin?: number; safeMax?: number; attentionMin?: number; attentionMax?: number },
  scorable = true,
): CopsoqDimension {
  return { id, domainId, name, shortName, type, questionIds: qIds(id), maxScore, scorable, ...bands };
}

export const COPSOQ_DOMAINS: CopsoqDomain[] = [
  {
    id: "demandas", name: "Demandas no trabalho", shortName: "Demandas",
    dimensions: [
      // 0-3 seguro | 4 atenção | 5-8 risco
      dim("demandas_quantitativas", "demandas", "Demandas quantitativas", "Dem. quantitativas", "negative", 8, { safeMax: 3, attentionMin: 4, attentionMax: 4 }),
      // 0-3 seguro | 4-5 atenção | 6-8 risco
      dim("ritmo_trabalho", "demandas", "Ritmo de trabalho", "Ritmo", "negative", 8, { safeMax: 3, attentionMin: 4, attentionMax: 5 }),
      // 0-3 seguro | 4 atenção | 5-8 risco
      dim("demandas_emocionais", "demandas", "Demandas emocionais", "Dem. emocionais", "negative", 8, { safeMax: 3, attentionMin: 4, attentionMax: 4 }),
    ],
  },
  {
    id: "organizacao", name: "Organização e conteúdo do trabalho", shortName: "Organização",
    dimensions: [
      dim("influencia", "organizacao", "Influência no trabalho", "Influência", "positive", 8, { safeMin: 5, attentionMin: 4, attentionMax: 4 }),
      dim("desenvolvimento", "organizacao", "Possibilidade de desenvolvimento", "Desenvolvimento", "positive", 8, { safeMin: 5, attentionMin: 4, attentionMax: 4 }),
      dim("significado", "organizacao", "Significado do trabalho", "Significado", "positive", 8, { safeMin: 6, attentionMin: 5, attentionMax: 5 }),
      dim("comprometimento", "organizacao", "Comprometimento com o trabalho", "Comprometimento", "positive", 8, { safeMin: 5, attentionMin: 4, attentionMax: 4 }),
    ],
  },
  {
    id: "relacoes", name: "Relações interpessoais", shortName: "Relações",
    dimensions: [
      dim("previsibilidade", "relacoes", "Previsibilidade", "Previsibilidade", "positive", 8, { safeMin: 5, attentionMin: 4, attentionMax: 4 }),
      dim("reconhecimento", "relacoes", "Reconhecimento", "Reconhecimento", "positive", 8, { safeMin: 5, attentionMin: 4, attentionMax: 4 }),
      dim("clareza_papel", "relacoes", "Clareza do papel", "Clareza do papel", "positive", 8, { safeMin: 6, attentionMin: 4, attentionMax: 5 }),
      dim("qualidade_lideranca", "relacoes", "Qualidade da liderança", "Liderança", "positive", 8, { safeMin: 5, attentionMin: 4, attentionMax: 4 }),
      dim("suporte_social", "relacoes", "Suporte social", "Suporte social", "positive", 8, { safeMin: 6, attentionMin: 4, attentionMax: 5 }),
    ],
  },
  {
    id: "interface", name: "Interface trabalho-indivíduo", shortName: "Interface",
    dimensions: [
      // 2-3 seguro | 0-1 risco (sem faixa de atenção)
      dim("satisfacao", "interface", "Satisfação no trabalho", "Satisfação", "positive", 3, { safeMin: 2 }),
      // 0-2 seguro | 3 atenção | 4-6 risco
      dim("conflito_trabalho_familia", "interface", "Conflitos trabalho e família", "Conflito trab.-família", "negative", 6, { safeMax: 2, attentionMin: 3, attentionMax: 3 }),
    ],
  },
  {
    id: "valores", name: "Valores do local de trabalho", shortName: "Valores",
    dimensions: [
      dim("confianca_gestao", "valores", "Confiança na gestão", "Confiança", "positive", 8, { safeMin: 5, attentionMin: 4, attentionMax: 4 }),
      dim("justica", "valores", "Justiça", "Justiça", "positive", 8, { safeMin: 5, attentionMin: 4, attentionMax: 4 }),
    ],
  },
  {
    id: "saude", name: "Saúde e bem-estar", shortName: "Saúde",
    dimensions: [
      // 3-4 seguro | 2 atenção | 0-1 risco
      dim("saude_geral", "saude", "Saúde geral", "Saúde geral", "positive", 4, { safeMin: 3, attentionMin: 2, attentionMax: 2 }),
      dim("burnout", "saude", "Sintomas de burnout", "Burnout", "negative", 8, { safeMax: 2, attentionMin: 3, attentionMax: 3 }),
      dim("estresse", "saude", "Sintomas de estresse", "Estresse", "negative", 8, { safeMax: 2, attentionMin: 3, attentionMax: 3 }),
    ],
  },
  {
    id: "ofensivos", name: "Comportamentos ofensivos", shortName: "Ofensivos",
    dimensions: [
      dim("atencao_sexual", "ofensivos", "Atenção sexual indesejada", "Atenção sexual", "negative", 4, {}, false),
      dim("ameacas_violencia", "ofensivos", "Ameaças de violência", "Ameaças", "negative", 4, {}, false),
      dim("violencia_fisica", "ofensivos", "Violência física", "Violência física", "negative", 4, {}, false),
      dim("bullying", "ofensivos", "Bullying", "Bullying", "negative", 4, {}, false),
    ],
  },
];

export const COPSOQ_DIMENSIONS = COPSOQ_DOMAINS.flatMap(d => d.dimensions);
export const COPSOQ_SCORABLE_DIMENSIONS = COPSOQ_DIMENSIONS.filter(d => d.scorable);
export const COPSOQ_OFFENSIVE_DIMENSIONS = COPSOQ_DIMENSIONS.filter(d => !d.scorable);

const QUESTION_TO_DIMENSION: Record<string, CopsoqDimension> = (() => {
  const map: Record<string, CopsoqDimension> = {};
  COPSOQ_DIMENSIONS.forEach(d => d.questionIds.forEach(qid => { map[qid] = d; }));
  return map;
})();

export function getCopsoqDimensionByQuestionId(questionId: string): CopsoqDimension | undefined {
  return QUESTION_TO_DIMENSION[questionId];
}

export function getCopsoqDimension(id: string): CopsoqDimension | undefined {
  return COPSOQ_DIMENSIONS.find(d => d.id === id);
}

// ========== CLASSIFICAÇÃO ==========

/** Classifica a pontuação (soma) de uma dimensão conforme as faixas do COPSOQ II-Br */
export function classifyCopsoq(dimension: CopsoqDimension, score: number): CopsoqClass {
  if (!dimension.scorable) return "seguro";
  const value = Math.round(score * 100) / 100;

  if (dimension.type === "negative") {
    if (dimension.safeMax !== undefined && value <= dimension.safeMax) return "seguro";
    if (dimension.attentionMax !== undefined && value <= dimension.attentionMax) return "atencao";
    return "risco";
  }

  if (dimension.safeMin !== undefined && value >= dimension.safeMin) return "seguro";
  if (dimension.attentionMin !== undefined && value >= dimension.attentionMin) return "atencao";
  return "risco";
}

export function copsoqClassLabel(cls: CopsoqClass): string {
  switch (cls) {
    case "seguro": return "Seguro";
    case "atencao": return "Atenção";
    case "risco": return "Risco";
  }
}

/** Converte a classificação COPSOQ no nível de risco usado no restante do sistema */
export function copsoqClassToRiskLevel(cls: CopsoqClass): RiskLevel {
  if (cls === "seguro") return "low";
  if (cls === "atencao") return "medium";
  return "high";
}

export function copsoqClassBgColor(cls: CopsoqClass): string {
  switch (cls) {
    case "seguro": return "bg-success/80 text-success-foreground";
    case "atencao": return "bg-warning/70 text-warning-foreground";
    case "risco": return "bg-destructive/70 text-destructive-foreground";
  }
}

/** Descrição textual das faixas de uma dimensão (para legendas) */
export function copsoqBandsText(d: CopsoqDimension): { safe: string; attention: string; risk: string } {
  if (!d.scorable) return { safe: "—", attention: "—", risk: "—" };
  if (d.type === "negative") {
    const safeMax = d.safeMax ?? 0;
    const attMax = d.attentionMax;
    return {
      safe: `0 – ${safeMax}`,
      attention: attMax === undefined ? "—" : (d.attentionMin === attMax ? `${attMax}` : `${d.attentionMin} – ${attMax}`),
      risk: `${(attMax ?? safeMax) + 1} – ${d.maxScore}`,
    };
  }
  const safeMin = d.safeMin ?? 0;
  const attMin = d.attentionMin;
  return {
    safe: `${safeMin} – ${d.maxScore}`,
    attention: attMin === undefined ? "—" : (d.attentionMax === attMin ? `${attMin}` : `${attMin} – ${d.attentionMax}`),
    risk: `0 – ${(attMin ?? safeMin) - 1}`,
  };
}

// ========== CÁLCULO DE PONTUAÇÃO ==========

export interface CopsoqAnswerBag {
  answers: Record<string, number>;
}

/**
 * Pontuação da dimensão para um respondente.
 * Se houver itens não respondidos, a soma é proporcionalizada
 * para manter a escala comparável.
 */
export function dimensionScore(dimension: CopsoqDimension, answers: Record<string, number>): number | null {
  const values = dimension.questionIds
    .map(id => answers[id])
    .filter(v => typeof v === "number" && !isNaN(v)) as number[];
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  if (values.length === dimension.questionIds.length) return sum;
  return (sum / values.length) * dimension.questionIds.length;
}

/** Pontuação média da dimensão em um grupo de respondentes */
export function dimensionAverage(dimension: CopsoqDimension, pool: CopsoqAnswerBag[]): number {
  const scores = pool
    .map(r => dimensionScore(dimension, r.answers))
    .filter((v): v is number => v !== null);
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

/** Distribuição de respondentes por classificação em uma dimensão */
export function dimensionDistribution(dimension: CopsoqDimension, pool: CopsoqAnswerBag[]) {
  let seguro = 0, atencao = 0, risco = 0, total = 0;
  pool.forEach(r => {
    const score = dimensionScore(dimension, r.answers);
    if (score === null) return;
    total++;
    const cls = classifyCopsoq(dimension, score);
    if (cls === "seguro") seguro++;
    else if (cls === "atencao") atencao++;
    else risco++;
  });
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return { total, seguro, atencao, risco, pctSeguro: pct(seguro), pctAtencao: pct(atencao), pctRisco: pct(risco) };
}

/** Normaliza a pontuação da dimensão em um índice de risco 0 (ótimo) a 1 (péssimo) */
export function normalizedRisk(dimension: CopsoqDimension, score: number): number {
  if (dimension.maxScore === 0) return 0;
  const ratio = Math.max(0, Math.min(1, score / dimension.maxScore));
  return dimension.type === "negative" ? ratio : 1 - ratio;
}

// ========== COMPORTAMENTOS OFENSIVOS ==========

export function offensiveSummary(pool: CopsoqAnswerBag[]) {
  return COPSOQ_OFFENSIVE_DIMENSIONS.map(d => {
    const qid = d.questionIds[0];
    const answered = pool.filter(r => typeof r.answers[qid] === "number");
    const exposed = answered.filter(r => (r.answers[qid] || 0) > 0);
    const frequent = answered.filter(r => (r.answers[qid] || 0) >= 3);
    return {
      dimension: d,
      questionId: qid,
      total: answered.length,
      exposed: exposed.length,
      frequent: frequent.length,
      pctExposed: answered.length > 0 ? Math.round((exposed.length / answered.length) * 100) : 0,
    };
  });
}

// ========== MATRIZ P×S ==========

const EXPOSURE_DIMS = ["demandas_quantitativas", "ritmo_trabalho", "demandas_emocionais", "conflito_trabalho_familia"];
const CONTROL_DIMS = ["influencia", "previsibilidade", "suporte_social", "qualidade_lideranca", "clareza_papel"];
const SEVERITY_DIMS = ["saude_geral", "burnout", "estresse"];

function groupVariable(dimIds: string[], scores: Record<string, number>): number {
  const values = dimIds
    .map(id => {
      const d = getCopsoqDimension(id);
      if (!d || scores[id] === undefined) return null;
      return normalizedRisk(d, scores[id]);
    })
    .filter((v): v is number => v !== null);
  if (values.length === 0) return 1;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.max(1, Math.min(4, Math.floor(avg * 4) + 1));
}

/**
 * Calcula P×S a partir das pontuações médias das dimensões COPSOQ.
 * Mantém os mesmos níveis PR1-PR4 e prazos usados no PROART.
 */
export function calculateCopsoqPxS(
  dimensionScores: Record<string, number>,
  totalRespondents: number,
  highRiskCount: number,
): { P: number; S: number; risk: number; prLevel: PRLevel; deadlineDays: number } {
  const E = groupVariable(EXPOSURE_DIMS, dimensionScores);
  const C = groupVariable(CONTROL_DIMS, dimensionScores);
  const G = groupVariable(SEVERITY_DIMS, dimensionScores);

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

// ========== PLANOS DE AÇÃO SUGERIDOS ==========

export interface CopsoqSuggestedTask {
  title: string;
  porQue: string;
  como: string;
}

export interface CopsoqSuggestedAction {
  factorId: string;
  riskLevel: RiskLevel;
  title: string;
  tasks: CopsoqSuggestedTask[];
}

const A = (
  factorId: string, riskLevel: RiskLevel, title: string, tasks: CopsoqSuggestedTask[],
): CopsoqSuggestedAction => ({ factorId, riskLevel, title, tasks });

const T = (title: string, porQue: string, como: string): CopsoqSuggestedTask => ({ title, porQue, como });

export const COPSOQ_SUGGESTED_ACTIONS: CopsoqSuggestedAction[] = [
  // --- Demandas quantitativas ---
  A("demandas_quantitativas", "high", "Reequilibrar a carga de trabalho", [
    T("Mapear volume de tarefas por posto de trabalho", "Sobrecarga quantitativa é um dos principais preditores de esgotamento", "Levantar demandas e prazos reais por função e comparar com a capacidade da equipe"),
    T("Redimensionar prazos e quadro de pessoal", "Prazos inviáveis obrigam o trabalhador a estender a jornada", "Renegociar prazos com as áreas demandantes e avaliar reforço de equipe nos gargalos"),
    T("Eliminar retrabalho e tarefas de baixo valor", "Reduzir demanda desnecessária libera tempo sem aumentar custo", "Mapear processos e suprimir etapas redundantes com participação das equipes"),
  ]),
  A("demandas_quantitativas", "medium", "Monitorar a carga de trabalho", [
    T("Acompanhar horas extras e acúmulo de tarefas", "Indicadores antecipam a virada para faixa de risco", "Criar painel mensal de horas extras e pendências por setor"),
    T("Rever picos sazonais de demanda", "Picos concentrados geram sobrecarga previsível e evitável", "Planejar antecipadamente reforço temporário nos períodos críticos"),
  ]),
  // --- Ritmo de trabalho ---
  A("ritmo_trabalho", "high", "Regular o ritmo de trabalho", [
    T("Instituir pausas regulares na jornada", "Ritmo acelerado contínuo eleva fadiga e risco de acidentes", "Definir e comunicar pausas obrigatórias, garantindo cobertura das atividades"),
    T("Revisar metas de produtividade", "Metas dimensionadas acima da capacidade impõem ritmo insustentável", "Recalcular metas a partir de dados históricos reais de produção"),
    T("Distribuir demandas ao longo da jornada", "A concentração de tarefas cria picos de esforço evitáveis", "Escalonar entregas e prazos internos para suavizar a curva de trabalho"),
  ]),
  A("ritmo_trabalho", "medium", "Acompanhar o ritmo das equipes", [
    T("Coletar percepção de ritmo por setor", "Permite agir antes de o ritmo se tornar risco", "Aplicar pulso rápido trimestral sobre ritmo e pausas"),
    T("Ajustar escalas nos períodos de pico", "Escalas equilibradas reduzem a intensidade percebida", "Revisar dimensionamento das escalas nos horários mais críticos"),
  ]),
  // --- Demandas emocionais ---
  A("demandas_emocionais", "high", "Proteger contra o desgaste emocional", [
    T("Oferecer suporte psicológico às equipes expostas", "Lidar com sofrimento alheio exige retaguarda profissional", "Contratar programa de apoio psicológico com acesso confidencial"),
    T("Capacitar em manejo de situações emocionalmente difíceis", "Preparo técnico reduz o impacto emocional da exposição", "Realizar treinamentos práticos de comunicação difícil e manejo de conflito"),
    T("Implantar rodízio em funções de alta exposição", "Reduz o tempo contínuo de exposição por trabalhador", "Definir escala de rodízio nas funções de atendimento crítico"),
  ]),
  A("demandas_emocionais", "medium", "Fortalecer o suporte emocional", [
    T("Criar espaços de escuta em equipe", "Compartilhar situações difíceis reduz o desgaste individual", "Realizar rodas de conversa mensais facilitadas pela liderança ou por profissional externo"),
    T("Orientar lideranças sobre sinais de desgaste", "Identificação precoce evita o adoecimento", "Treinar líderes para reconhecer e encaminhar casos de sofrimento"),
  ]),
  // --- Influência ---
  A("influencia", "high", "Ampliar a influência do trabalhador", [
    T("Delegar decisões operacionais às equipes", "Baixa influência sobre o próprio trabalho é fator de risco reconhecido", "Definir matriz de decisões que podem ser tomadas no nível da execução"),
    T("Envolver equipes no planejamento das tarefas", "Participação aumenta previsibilidade e controle percebido", "Realizar reuniões de planejamento com participação efetiva dos trabalhadores"),
    T("Permitir negociação da distribuição de tarefas", "Poder de negociar a carga reduz sobrecarga e frustração", "Instituir rotina de repactuação de demandas entre equipe e liderança"),
  ]),
  A("influencia", "medium", "Estimular a participação nas decisões", [
    T("Consultar equipes antes de mudanças de rotina", "Consulta prévia evita perda de controle percebida", "Enviar proposta de mudança para contribuição da equipe antes da implantação"),
    T("Criar canal de sugestões com retorno obrigatório", "Sugestão sem resposta reduz o senso de influência", "Definir prazo máximo de resposta às sugestões recebidas"),
  ]),
  // --- Desenvolvimento ---
  A("desenvolvimento", "high", "Criar oportunidades de desenvolvimento", [
    T("Estruturar plano de capacitação por função", "A ausência de aprendizado empobrece o trabalho e desmotiva", "Elaborar trilha de capacitação anual com carga horária definida por função"),
    T("Ampliar variedade de tarefas", "Tarefas repetitivas limitam o desenvolvimento profissional", "Implantar rodízio planejado de atividades dentro das equipes"),
    T("Definir plano de carreira transparente", "Perspectiva de crescimento sustenta o engajamento", "Publicar critérios objetivos de progressão e requisitos de cada nível"),
  ]),
  A("desenvolvimento", "medium", "Fortalecer o aprendizado no trabalho", [
    T("Incentivar troca de conhecimento entre equipes", "Aprendizado entre pares é de baixo custo e alta adesão", "Organizar encontros periódicos de compartilhamento de práticas"),
    T("Apoiar formação continuada", "Acesso à formação amplia autonomia técnica", "Criar política de apoio a cursos e certificações"),
  ]),
  // --- Significado ---
  A("significado", "high", "Resgatar o sentido do trabalho", [
    T("Explicitar o impacto do trabalho de cada equipe", "Sentido do trabalho protege contra adoecimento mental", "Comunicar resultados e histórias que mostrem o efeito prático do trabalho realizado"),
    T("Conectar tarefas aos objetivos da organização", "Tarefas isoladas do propósito perdem significado", "Apresentar em reuniões a relação entre atividades diárias e objetivos institucionais"),
    T("Reduzir tarefas percebidas como inúteis", "Trabalho sem finalidade clara corrói o significado", "Revisar rotinas burocráticas e eliminar as que não geram valor"),
  ]),
  A("significado", "medium", "Reforçar o propósito do trabalho", [
    T("Compartilhar retornos de clientes e usuários", "Feedback externo evidencia a relevância do trabalho", "Divulgar periodicamente elogios e resultados alcançados"),
    T("Envolver equipes na definição de metas", "Participar da meta aumenta a identificação com ela", "Construir metas de setor em conjunto com as equipes"),
  ]),
  // --- Comprometimento ---
  A("comprometimento", "high", "Fortalecer o vínculo com a organização", [
    T("Investigar causas da baixa identificação", "Sem diagnóstico, ações de engajamento erram o alvo", "Realizar grupos focais sobre clima e percepção do local de trabalho"),
    T("Revisar política de reconhecimento e benefícios", "Vínculo frágil costuma refletir falta de contrapartida percebida", "Comparar práticas atuais com referências do setor e ajustar prioridades"),
    T("Estruturar processo de integração de novos trabalhadores", "Boa acolhida define o vínculo de longo prazo", "Criar programa de integração com acompanhamento nos primeiros 90 dias"),
  ]),
  A("comprometimento", "medium", "Cuidar do clima organizacional", [
    T("Medir clima periodicamente", "Acompanhamento evita deterioração silenciosa", "Aplicar pesquisa de clima semestral com devolutiva pública"),
    T("Realizar entrevistas de desligamento", "Saídas revelam causas concretas de baixo comprometimento", "Padronizar entrevista de desligamento e consolidar os motivos"),
  ]),
  // --- Previsibilidade ---
  A("previsibilidade", "high", "Aumentar a previsibilidade", [
    T("Comunicar mudanças com antecedência", "Mudanças inesperadas são fonte direta de estresse", "Definir prazo mínimo de comunicação prévia para mudanças que afetem o trabalho"),
    T("Padronizar o fluxo de informações essenciais", "Falta de informação impede o bom desempenho", "Mapear as informações críticas de cada função e garantir seu envio rotineiro"),
    T("Criar rotina de comunicação da liderança", "Regularidade reduz boato e insegurança", "Instituir reunião semanal breve de alinhamento em cada setor"),
  ]),
  A("previsibilidade", "medium", "Melhorar a comunicação de mudanças", [
    T("Publicar calendário de mudanças previstas", "Antecipar o que virá reduz a incerteza", "Manter mural ou canal digital com o cronograma de mudanças"),
    T("Confirmar entendimento das informações repassadas", "Informação enviada não é informação compreendida", "Fechar reuniões com resumo dos pontos e checagem de dúvidas"),
  ]),
  // --- Reconhecimento ---
  A("reconhecimento", "high", "Instituir práticas de reconhecimento", [
    T("Criar rotina de reconhecimento pela liderança", "Falta de reconhecimento é forte preditor de sofrimento", "Definir prática regular de feedback positivo individual e de equipe"),
    T("Revisar critérios de promoção e premiação", "Critérios obscuros geram percepção de injustiça", "Publicar critérios objetivos e aplicá-los de forma transparente"),
    T("Tratar percepções de tratamento injusto", "Injustiça percebida deteriora saúde e desempenho", "Criar canal de apuração de queixas com resposta formal"),
  ]),
  A("reconhecimento", "medium", "Ampliar o reconhecimento cotidiano", [
    T("Capacitar líderes em feedback", "Reconhecimento eficaz depende de habilidade de comunicação", "Realizar oficina prática de feedback com as lideranças"),
    T("Divulgar boas entregas das equipes", "Visibilidade reforça o reconhecimento coletivo", "Incluir seção de destaques nas comunicações internas"),
  ]),
  // --- Clareza do papel ---
  A("clareza_papel", "high", "Definir com clareza papéis e metas", [
    T("Formalizar descrição de funções", "Ambiguidade de papel gera estresse e conflito", "Revisar e publicar a descrição de atribuições de cada função"),
    T("Estabelecer metas claras e mensuráveis", "Metas difusas impedem o trabalhador de saber se teve êxito", "Definir metas por função com indicadores objetivos e prazos"),
    T("Eliminar sobreposição de atribuições", "Sobreposição gera retrabalho e conflito entre áreas", "Mapear interfaces entre áreas e pactuar responsabilidades"),
  ]),
  A("clareza_papel", "medium", "Reforçar o alinhamento de expectativas", [
    T("Realizar alinhamento periódico de expectativas", "Expectativas mudam e precisam ser recontratadas", "Instituir conversa trimestral de alinhamento entre líder e liderado"),
    T("Disponibilizar procedimentos atualizados", "Procedimento claro reduz dúvida sobre o que se espera", "Revisar e publicar os procedimentos operacionais de cada função"),
  ]),
  // --- Qualidade da liderança ---
  A("qualidade_lideranca", "high", "Desenvolver a liderança", [
    T("Capacitar lideranças em gestão de pessoas", "A liderança é determinante da saúde psicossocial da equipe", "Implantar programa de desenvolvimento de líderes com módulos de escuta, feedback e conflito"),
    T("Avaliar lideranças pela percepção da equipe", "Avaliação apenas por resultados ignora o custo humano", "Adotar avaliação de liderança com devolutiva e plano de desenvolvimento individual"),
    T("Melhorar o planejamento do trabalho pela liderança", "Planejamento deficiente transfere pressão para a equipe", "Implantar rotina de planejamento semanal com apoio metodológico"),
  ]),
  A("qualidade_lideranca", "medium", "Apoiar as lideranças", [
    T("Oferecer mentoria para novos líderes", "Líderes sem preparo reproduzem práticas prejudiciais", "Parear novos líderes com gestores experientes por 6 meses"),
    T("Criar fórum de troca entre lideranças", "Espaço entre pares qualifica a prática de gestão", "Realizar encontro mensal de lideranças com estudo de casos reais"),
  ]),
  // --- Suporte social ---
  A("suporte_social", "high", "Garantir suporte da chefia imediata", [
    T("Instituir rotina de escuta pela chefia", "Suporte da chefia é fator protetor central no COPSOQ", "Agendar conversas individuais periódicas de acompanhamento"),
    T("Definir fluxo de apoio em situações críticas", "O trabalhador precisa saber a quem recorrer", "Documentar e divulgar o fluxo de acionamento de apoio"),
    T("Cobrar disponibilidade da liderança como atribuição", "Suporte precisa ser tratado como responsabilidade formal", "Incluir suporte à equipe entre as atribuições avaliadas dos líderes"),
  ]),
  A("suporte_social", "medium", "Fortalecer o apoio entre pares", [
    T("Estimular práticas de apoio mútuo nas equipes", "Suporte de colegas amortece o efeito das demandas", "Organizar duplas de apoio e integração para tarefas críticas"),
    T("Reservar tempo de agenda da liderança para a equipe", "Agenda cheia inviabiliza o suporte na prática", "Bloquear horários fixos semanais de disponibilidade do líder"),
  ]),
  // --- Satisfação ---
  A("satisfacao", "high", "Recuperar a satisfação no trabalho", [
    T("Diagnosticar as causas da insatisfação", "Satisfação baixa é sintoma de causas múltiplas", "Realizar grupos focais por setor para identificar os fatores predominantes"),
    T("Priorizar as dimensões mais críticas do diagnóstico", "Agir no que mais pesa produz resultado perceptível", "Selecionar as três dimensões com pior resultado e criar plano específico"),
    T("Comunicar as ações adotadas", "Ver resposta ao que foi relatado restaura a confiança", "Divulgar o plano de ação e o andamento das entregas"),
  ]),
  A("satisfacao", "medium", "Acompanhar a satisfação", [
    T("Medir satisfação periodicamente", "Monitorar permite corrigir rota antes do agravamento", "Aplicar pulso semestral de satisfação por setor"),
    T("Agir sobre queixas recorrentes", "Queixas repetidas indicam causa estrutural", "Consolidar queixas e tratar as três mais frequentes por ciclo"),
  ]),
  // --- Conflito trabalho-família ---
  A("conflito_trabalho_familia", "high", "Proteger o tempo fora do trabalho", [
    T("Limitar jornada e horas extras", "Extensão de jornada é a principal causa do conflito", "Estabelecer teto de horas extras com acompanhamento mensal"),
    T("Definir política de desconexão", "Contato fora do expediente impede a recuperação", "Formalizar regra de não acionamento fora da jornada, salvo emergências"),
    T("Flexibilizar horários quando possível", "Flexibilidade reduz o conflito sem perda de produtividade", "Avaliar jornada flexível ou banco de horas nas funções compatíveis"),
  ]),
  A("conflito_trabalho_familia", "medium", "Equilibrar trabalho e vida pessoal", [
    T("Monitorar jornada real das equipes", "Dados evitam que a extensão da jornada passe despercebida", "Acompanhar mensalmente registros de jornada por setor"),
    T("Planejar escalas com previsibilidade", "Escala previsível permite organizar a vida pessoal", "Publicar escalas com antecedência mínima definida"),
  ]),
  // --- Confiança na gestão ---
  A("confianca_gestao", "high", "Reconstruir a confiança na gestão", [
    T("Aumentar a transparência das informações", "Confiança depende de informação consistente e verificável", "Publicar periodicamente decisões, motivos e resultados"),
    T("Cumprir compromissos assumidos publicamente", "Promessa não cumprida é o que mais corrói a confiança", "Registrar compromissos e divulgar o status de cada um"),
    T("Ampliar autonomia como sinal de confiança", "Controle excessivo comunica desconfiança à equipe", "Reduzir controles desnecessários e delegar decisões operacionais"),
  ]),
  A("confianca_gestao", "medium", "Fortalecer a transparência", [
    T("Realizar encontros abertos com a gestão", "Contato direto reduz distância e desconfiança", "Promover encontros trimestrais com espaço para perguntas"),
    T("Explicar os motivos das decisões", "Decisão explicada é decisão mais aceita", "Incluir a justificativa nas comunicações de mudança"),
  ]),
  // --- Justiça ---
  A("justica", "high", "Assegurar justiça organizacional", [
    T("Definir procedimento formal de resolução de conflitos", "Conflitos mal resolvidos deterioram o ambiente", "Instituir fluxo de mediação com prazos e responsáveis definidos"),
    T("Revisar a distribuição de tarefas", "Distribuição desigual é fonte direta de percepção de injustiça", "Mapear a carga por trabalhador e reequilibrar as atribuições"),
    T("Padronizar critérios de decisão sobre pessoas", "Critérios pessoais geram favorecimento percebido", "Documentar critérios de escala, folga, promoção e distribuição"),
  ]),
  A("justica", "medium", "Monitorar a percepção de justiça", [
    T("Acompanhar queixas de tratamento desigual", "Sinais precoces evitam a consolidação do problema", "Registrar e analisar queixas trimestralmente"),
    T("Dar retorno formal aos conflitos tratados", "Retorno demonstra que o processo é justo", "Comunicar formalmente o desfecho de cada caso ao envolvido"),
  ]),
  // --- Saúde geral ---
  A("saude_geral", "high", "Cuidar da saúde dos trabalhadores", [
    T("Ampliar o acompanhamento de saúde ocupacional", "Autoavaliação de saúde ruim antecede afastamentos", "Reforçar exames periódicos e encaminhamentos com o serviço de saúde"),
    T("Investigar relação entre condições de trabalho e queixas", "Sem nexo identificado, a ação não previne recorrência", "Cruzar afastamentos e queixas com setores e funções"),
    T("Implantar programa de promoção da saúde", "Prevenção reduz adoecimento e absenteísmo", "Estruturar programa com ações de atividade física, sono e alimentação"),
  ]),
  A("saude_geral", "medium", "Acompanhar indicadores de saúde", [
    T("Monitorar absenteísmo por setor", "Absenteísmo é indicador precoce de adoecimento", "Consolidar e analisar afastamentos mensalmente"),
    T("Divulgar canais de cuidado disponíveis", "Recurso desconhecido não é utilizado", "Comunicar periodicamente os serviços de saúde acessíveis"),
  ]),
  // --- Burnout ---
  A("burnout", "high", "Enfrentar o esgotamento profissional", [
    T("Reduzir demandas nos setores mais afetados", "Esgotamento decorre de exposição prolongada à sobrecarga", "Priorizar redução de carga onde o indicador está em risco"),
    T("Garantir recuperação entre jornadas e férias", "Sem recuperação, o esgotamento se cronifica", "Assegurar intervalos legais e programar férias sem acúmulo"),
    T("Oferecer apoio psicológico com acesso facilitado", "Casos de esgotamento exigem cuidado profissional", "Disponibilizar atendimento confidencial e divulgar amplamente"),
  ]),
  A("burnout", "medium", "Prevenir o esgotamento", [
    T("Treinar lideranças no reconhecimento de sinais", "Detecção precoce evita afastamentos", "Capacitar líderes sobre sinais de esgotamento e encaminhamento"),
    T("Instituir pausas e microintervalos", "Pausas reduzem a fadiga acumulada", "Definir pausas na rotina das funções mais exigentes"),
  ]),
  // --- Estresse ---
  A("estresse", "high", "Reduzir os níveis de estresse", [
    T("Atuar sobre as fontes organizacionais de estresse", "Ações individuais não resolvem causas organizacionais", "Priorizar as dimensões críticas do diagnóstico e tratá-las com plano específico"),
    T("Oferecer suporte psicológico e orientação", "Sintomas de estresse exigem acolhimento imediato", "Disponibilizar atendimento e orientação com acesso confidencial"),
    T("Rever conflitos e sobrecarga nas equipes críticas", "Estresse elevado costuma se concentrar em setores específicos", "Analisar os setores com pior resultado e intervir diretamente"),
  ]),
  A("estresse", "medium", "Monitorar sinais de estresse", [
    T("Acompanhar o indicador por setor", "Acompanhamento permite intervenção antes do agravamento", "Reaplicar a avaliação e comparar a evolução por setor"),
    T("Promover ações de manejo do estresse", "Estratégias de manejo complementam as ações organizacionais", "Realizar oficinas práticas de manejo do estresse no trabalho"),
  ]),
];

export function getCopsoqSuggestedActions(dimensionId: string, riskLevel: RiskLevel): CopsoqSuggestedAction | undefined {
  return COPSOQ_SUGGESTED_ACTIONS.find(a => a.factorId === dimensionId && a.riskLevel === riskLevel);
}

export type { CopsoqQuestion };
