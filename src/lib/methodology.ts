/**
 * Camada de resolução de metodologia.
 *
 * Recebe a metodologia de um formulário/empresa e devolve as questões,
 * blocos de navegação, opções de resposta e rótulos correspondentes,
 * para que as telas não importem PROART ou COPSOQ diretamente.
 */

import {
  PROART_QUESTIONS,
  OPEN_QUESTIONS as PROART_OPEN_QUESTIONS,
  LIKERT_OPTIONS,
  getQuestionsByScale,
} from "@/lib/proartQuestions";
import {
  COPSOQ_QUESTIONS,
  COPSOQ_OPEN_QUESTIONS,
  COPSOQ_OPTION_SETS,
  COPSOQ_QUESTION_IDS,
  COPSOQ_OFFENSIVE_QUESTION_IDS,
  getCopsoqQuestionsByDomain,
} from "@/lib/copsoqQuestions";

export type Methodology = "proart" | "copsoq";

export const METHODOLOGIES: { id: Methodology; label: string; description: string; questionCount: number; duration: string }[] = [
  {
    id: "proart",
    label: "PROART",
    description: "Protocolo de Avaliação dos Riscos Psicossociais no Trabalho — 91 questões, 4 escalas, 10 fatores.",
    questionCount: PROART_QUESTIONS.length,
    duration: "15-20",
  },
  {
    id: "copsoq",
    label: "COPSOQ II-Br",
    description: "Copenhagen Psychosocial Questionnaire (versão curta brasileira) — 40 questões, 7 domínios, 23 dimensões.",
    questionCount: COPSOQ_QUESTIONS.length,
    duration: "8-12",
  },
];

export function normalizeMethodology(value: any): Methodology {
  return String(value || "").toLowerCase() === "copsoq" ? "copsoq" : "proart";
}

export function methodologyLabel(m: Methodology): string {
  return m === "copsoq" ? "COPSOQ II-Br" : "PROART";
}

export interface ResolvedOption {
  value: number;
  label: string;
}

export interface ResolvedQuestion {
  id: string;
  number: number;
  text: string;
  options: ResolvedOption[];
  /** true para as questões de comportamentos ofensivos (COPSOQ 20-23) */
  isOffensive?: boolean;
}

export interface SurveyBlock {
  id: string;
  name: string;
  fullName: string;
  shortName: string;
  questions: ResolvedQuestion[];
  /** legenda comum quando todas as questões do bloco usam a mesma escala */
  sharedOptions?: ResolvedOption[];
}

function proartBlocks(): SurveyBlock[] {
  return getQuestionsByScale().map(s => ({
    id: s.id,
    name: s.name,
    fullName: s.fullName,
    shortName: s.shortName,
    sharedOptions: LIKERT_OPTIONS.map(o => ({ value: o.value, label: o.label })),
    questions: s.questions.map(q => ({
      id: q.id,
      number: q.number,
      text: q.text,
      options: LIKERT_OPTIONS.map(o => ({ value: o.value, label: o.label })),
    })),
  }));
}

function copsoqBlocks(): SurveyBlock[] {
  return getCopsoqQuestionsByDomain().map(d => {
    const questions: ResolvedQuestion[] = d.questions.map(q => ({
      id: q.id,
      number: q.number,
      text: q.text,
      options: COPSOQ_OPTION_SETS[q.optionSet],
      isOffensive: q.domainId === "ofensivos",
    }));
    const optionSets = new Set(d.questions.map(q => q.optionSet));
    return {
      id: d.id,
      name: d.name,
      fullName: d.fullName,
      shortName: d.shortName,
      questions,
      sharedOptions: optionSets.size === 1 ? questions[0]?.options : undefined,
    };
  });
}

export function getSurveyBlocks(m: Methodology): SurveyBlock[] {
  return m === "copsoq" ? copsoqBlocks() : proartBlocks();
}

export function getTotalQuestions(m: Methodology): number {
  return m === "copsoq" ? COPSOQ_QUESTIONS.length : PROART_QUESTIONS.length;
}

export function getOpenQuestions(m: Methodology) {
  return m === "copsoq" ? COPSOQ_OPEN_QUESTIONS : PROART_OPEN_QUESTIONS;
}

export function getMethodologyMeta(m: Methodology) {
  return METHODOLOGIES.find(x => x.id === m) || METHODOLOGIES[0];
}

/** Ids de questões válidos para a metodologia (usado na leitura de respostas) */
export function isCopsoqQuestionId(id: string): boolean {
  return COPSOQ_QUESTION_IDS.has(id);
}

export const OFFENSIVE_QUESTION_IDS = COPSOQ_OFFENSIVE_QUESTION_IDS;

/** Detecta a metodologia a partir das chaves de resposta gravadas */
export function detectMethodologyFromAnswers(answers: Record<string, number>): Methodology {
  return Object.keys(answers).some(k => COPSOQ_QUESTION_IDS.has(k)) ? "copsoq" : "proart";
}
