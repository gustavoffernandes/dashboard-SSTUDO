/**
 * COPSOQ II-Br — Copenhagen Psychosocial Questionnaire (versão curta brasileira)
 * 40 questões, 23 dimensões, 7 domínios. Escala 0-4 (varia por bloco).
 *
 * Fonte: Gonçalves et al.; National Centre for the Working Environment.
 */

export interface CopsoqOption {
  value: number;
  label: string;
}

export type CopsoqOptionSetId =
  | "freq_risk"
  | "freq_risk_inverted"
  | "freq_good"
  | "extent"
  | "satisfaction"
  | "degree"
  | "health"
  | "offensive";

export const COPSOQ_OPTION_SETS: Record<CopsoqOptionSetId, CopsoqOption[]> = {
  // Quanto maior a pontuação, maior o risco
  freq_risk: [
    { value: 0, label: "Nunca" },
    { value: 1, label: "Raramente" },
    { value: 2, label: "Às vezes" },
    { value: 3, label: "Frequentemente" },
    { value: 4, label: "Sempre" },
  ],
  // Item 1B — pontuação invertida
  freq_risk_inverted: [
    { value: 0, label: "Sempre" },
    { value: 1, label: "Frequentemente" },
    { value: 2, label: "Às vezes" },
    { value: 3, label: "Raramente" },
    { value: 4, label: "Nunca" },
  ],
  // Quanto maior a pontuação, menor o risco
  freq_good: [
    { value: 0, label: "Nunca" },
    { value: 1, label: "Raramente" },
    { value: 2, label: "Às vezes" },
    { value: 3, label: "Frequentemente" },
    { value: 4, label: "Sempre" },
  ],
  extent: [
    { value: 0, label: "Muito pouco" },
    { value: 1, label: "Pouco" },
    { value: 2, label: "De certa forma" },
    { value: 3, label: "Em boa parte" },
    { value: 4, label: "Em grande parte" },
  ],
  satisfaction: [
    { value: 0, label: "Muito insatisfeito" },
    { value: 1, label: "Insatisfeito" },
    { value: 2, label: "Satisfeito" },
    { value: 3, label: "Muito satisfeito" },
  ],
  degree: [
    { value: 0, label: "Não, realmente não" },
    { value: 1, label: "Sim, mas muito pouco" },
    { value: 2, label: "Sim, até certo ponto" },
    { value: 3, label: "Sim, com certeza" },
  ],
  health: [
    { value: 0, label: "Ruim" },
    { value: 1, label: "Razoável" },
    { value: 2, label: "Boa" },
    { value: 3, label: "Muito boa" },
    { value: 4, label: "Excelente" },
  ],
  offensive: [
    { value: 0, label: "Não" },
    { value: 1, label: "Sim, poucas vezes" },
    { value: 2, label: "Sim, mensalmente" },
    { value: 3, label: "Sim, semanalmente" },
    { value: 4, label: "Sim, diariamente" },
  ],
};

export const COPSOQ_PERPETRATORS = [
  "Colegas",
  "Gerente / supervisor",
  "Subordinados",
  "Clientes, fregueses, pacientes",
];

export interface CopsoqQuestion {
  id: string;
  code: string;
  number: number;
  text: string;
  domainId: string;
  domainName: string;
  dimensionId: string;
  optionSet: CopsoqOptionSetId;
}

const D = {
  demandas: { id: "demandas", name: "Demandas no trabalho" },
  organizacao: { id: "organizacao", name: "Organização e conteúdo do trabalho" },
  relacoes: { id: "relacoes", name: "Relações interpessoais" },
  interface: { id: "interface", name: "Interface trabalho-indivíduo" },
  valores: { id: "valores", name: "Valores do local de trabalho" },
  saude: { id: "saude", name: "Saúde e bem-estar" },
  ofensivos: { id: "ofensivos", name: "Comportamentos ofensivos" },
};

function q(
  id: string, code: string, number: number, text: string,
  domain: { id: string; name: string }, dimensionId: string, optionSet: CopsoqOptionSetId,
): CopsoqQuestion {
  return { id, code, number, text, domainId: domain.id, domainName: domain.name, dimensionId, optionSet };
}

export const COPSOQ_QUESTIONS: CopsoqQuestion[] = [
  // ===== Demandas no trabalho =====
  q("cp1a", "1A", 1, "Você atrasa a entrega do seu trabalho?", D.demandas, "demandas_quantitativas", "freq_risk"),
  q("cp1b", "1B", 2, "O tempo para realizar as suas tarefas no trabalho é suficiente?", D.demandas, "demandas_quantitativas", "freq_risk_inverted"),
  q("cp2a", "2A", 3, "É necessário manter um ritmo acelerado no trabalho?", D.demandas, "ritmo_trabalho", "freq_risk"),
  q("cp2b", "2B", 4, "Você trabalha em ritmo acelerado ao longo de toda jornada?", D.demandas, "ritmo_trabalho", "freq_risk"),
  q("cp3a", "3A", 5, "Seu trabalho coloca você em situações emocionalmente desgastantes?", D.demandas, "demandas_emocionais", "freq_risk"),
  q("cp3b", "3B", 6, "Você tem que lidar com os problemas pessoais de outras pessoas como parte do seu trabalho?", D.demandas, "demandas_emocionais", "freq_risk"),

  // ===== Organização e conteúdo do trabalho =====
  q("cp4a", "4A", 7, "Você tem um alto grau de influência nas decisões sobre o seu trabalho?", D.organizacao, "influencia", "freq_good"),
  q("cp4b", "4B", 8, "Você pode interferir na quantidade de trabalho atribuída a você?", D.organizacao, "influencia", "freq_good"),
  q("cp5a", "5A", 9, "Você tem a possibilidade de aprender coisas novas através do seu trabalho?", D.organizacao, "desenvolvimento", "extent"),
  q("cp5b", "5B", 10, "O seu trabalho exige que você tome iniciativas?", D.organizacao, "desenvolvimento", "extent"),
  q("cp6a", "6A", 11, "O seu trabalho é significativo?", D.organizacao, "significado", "extent"),
  q("cp6b", "6B", 12, "Você sente que o trabalho que você faz é importante?", D.organizacao, "significado", "extent"),
  q("cp7a", "7A", 13, "Você sente que o seu local de trabalho é muito importante para você?", D.organizacao, "comprometimento", "extent"),
  q("cp7b", "7B", 14, "Você recomendaria a um amigo que se candidatasse a uma vaga no seu local de trabalho?", D.organizacao, "comprometimento", "extent"),

  // ===== Relações interpessoais =====
  q("cp8a", "8A", 15, "No seu local de trabalho, você é informado antecipadamente sobre decisões importantes, mudanças ou planos para o futuro?", D.relacoes, "previsibilidade", "extent"),
  q("cp8b", "8B", 16, "Você recebe toda a informação necessária para fazer bem o seu trabalho?", D.relacoes, "previsibilidade", "extent"),
  q("cp9a", "9A", 17, "O seu trabalho é reconhecido e valorizado pelos seus superiores?", D.relacoes, "reconhecimento", "extent"),
  q("cp9b", "9B", 18, "Você é tratado de forma justa no seu local de trabalho?", D.relacoes, "reconhecimento", "extent"),
  q("cp10a", "10A", 19, "O seu trabalho tem objetivos/metas claros(as)?", D.relacoes, "clareza_papel", "extent"),
  q("cp10b", "10B", 20, "Você sabe exatamente o que se espera de você no trabalho?", D.relacoes, "clareza_papel", "extent"),
  q("cp11a", "11A", 21, "Você diria que o seu superior imediato dá alta prioridade para a satisfação com o trabalho?", D.relacoes, "qualidade_lideranca", "extent"),
  q("cp11b", "11B", 22, "Você diria que o seu superior imediato é bom no planejamento do trabalho?", D.relacoes, "qualidade_lideranca", "extent"),
  q("cp12a", "12A", 23, "Com que frequência o seu superior imediato está disposto a ouvir os seus problemas no trabalho?", D.relacoes, "suporte_social", "freq_good"),
  q("cp12b", "12B", 24, "Com que frequência você recebe ajuda e suporte do seu superior imediato?", D.relacoes, "suporte_social", "freq_good"),

  // ===== Interface trabalho-indivíduo =====
  q("cp13", "13", 25, "Qual o seu nível de satisfação com o seu trabalho como um todo, considerando todos os aspectos?", D.interface, "satisfacao", "satisfaction"),
  q("cp14a", "14A", 26, "Você sente que o seu trabalho consome tanto sua energia que ele tem um efeito negativo na sua vida particular?", D.interface, "conflito_trabalho_familia", "degree"),
  q("cp14b", "14B", 27, "Você sente que o seu trabalho ocupa tanto tempo que ele tem um efeito negativo na sua vida particular?", D.interface, "conflito_trabalho_familia", "degree"),

  // ===== Valores do local de trabalho =====
  q("cp15a", "15A", 28, "Você pode confiar nas informações que vêm dos seus superiores?", D.valores, "confianca_gestao", "extent"),
  q("cp15b", "15B", 29, "Os seus superiores confiam que os funcionários farão bem seu trabalho?", D.valores, "confianca_gestao", "extent"),
  q("cp16a", "16A", 30, "Os conflitos são resolvidos de forma justa?", D.valores, "justica", "extent"),
  q("cp16b", "16B", 31, "O trabalho é distribuído de forma justa?", D.valores, "justica", "extent"),

  // ===== Saúde e bem-estar =====
  q("cp17", "17", 32, "Em geral, você diria que a sua saúde é:", D.saude, "saude_geral", "health"),
  q("cp18a", "18A", 33, "Com que frequência você tem se sentido fisicamente esgotado?", D.saude, "burnout", "freq_risk"),
  q("cp18b", "18B", 34, "Com que frequência você tem se sentido emocionalmente esgotado?", D.saude, "burnout", "freq_risk"),
  q("cp19a", "19A", 35, "Com que frequência você tem se sentido estressado?", D.saude, "estresse", "freq_risk"),
  q("cp19b", "19B", 36, "Com que frequência você tem se sentido irritado?", D.saude, "estresse", "freq_risk"),

  // ===== Comportamentos ofensivos =====
  q("cp20", "20", 37, "Você foi exposto a atenção sexual indesejada no seu local de trabalho durante os últimos 12 meses?", D.ofensivos, "atencao_sexual", "offensive"),
  q("cp21", "21", 38, "Você foi exposto a ameaças de violência no seu local de trabalho nos últimos 12 meses?", D.ofensivos, "ameacas_violencia", "offensive"),
  q("cp22", "22", 39, "Você foi exposto a violência física em seu local de trabalho durante os últimos 12 meses?", D.ofensivos, "violencia_fisica", "offensive"),
  q("cp23", "23", 40, "Você foi exposto a bullying no seu local de trabalho nos últimos 12 meses?", D.ofensivos, "bullying", "offensive"),
];

export const COPSOQ_QUESTION_IDS = new Set(COPSOQ_QUESTIONS.map(q => q.id));

export const COPSOQ_OFFENSIVE_QUESTION_IDS = COPSOQ_QUESTIONS
  .filter(q => q.domainId === "ofensivos")
  .map(q => q.id);

export function getCopsoqQuestion(id: string): CopsoqQuestion | undefined {
  return COPSOQ_QUESTIONS.find(q => q.id === id);
}

export function getCopsoqOptions(questionId: string): CopsoqOption[] {
  const question = getCopsoqQuestion(questionId);
  return question ? COPSOQ_OPTION_SETS[question.optionSet] : COPSOQ_OPTION_SETS.freq_risk;
}

/** Perguntas abertas (mesma lógica do PROART) */
export const COPSOQ_OPEN_QUESTIONS = [
  { id: "open1", text: "Descreva como você percebe as condições e a organização do seu trabalho.", hint: "Fique à vontade para escrever possíveis desconfortos e também contribuir com sugestões." },
  { id: "open2", text: "Descreva como você percebe a atuação do seu(sua) líder.", hint: "Fique à vontade para escrever possíveis desconfortos e também contribuir com sugestões." },
  { id: "open3", text: "Descreva como você percebe a sua saúde e o seu bem-estar no trabalho.", hint: "Fique à vontade para escrever possíveis desconfortos e também contribuir com sugestões." },
  { id: "open4", text: "Caso alguma informação importante não tenha sido abordada neste questionário, fique à vontade para descrever.", hint: "" },
];

/** Agrupa as questões por domínio, para a navegação passo a passo */
export function getCopsoqQuestionsByDomain() {
  const domains = [
    { id: "demandas", name: "Demandas", fullName: "Demandas no trabalho", shortName: "Demandas" },
    { id: "organizacao", name: "Organização do Trabalho", fullName: "Organização e conteúdo do trabalho", shortName: "Organização" },
    { id: "relacoes", name: "Relações Interpessoais", fullName: "Relações interpessoais e liderança", shortName: "Relações" },
    { id: "interface", name: "Trabalho e Indivíduo", fullName: "Interface trabalho-indivíduo", shortName: "Interface" },
    { id: "valores", name: "Valores da Organização", fullName: "Valores do local de trabalho", shortName: "Valores" },
    { id: "saude", name: "Saúde e Bem-estar", fullName: "Saúde e bem-estar", shortName: "Saúde" },
    { id: "ofensivos", name: "Comportamentos Ofensivos", fullName: "Comportamentos ofensivos nos últimos 12 meses", shortName: "Ofensivos" },
  ];

  return domains.map(d => ({
    ...d,
    questions: COPSOQ_QUESTIONS.filter(q => q.domainId === d.id),
  }));
}
