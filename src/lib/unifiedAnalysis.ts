/**
 * Camada de unificação PROART x COPSOQ para as telas de análise.
 *
 * O PROART trabalha com 4 escalas (pilares) em uma média 1-5.
 * O COPSOQ trabalha com 7 domínios cuja pontuação é a soma de cada dimensão.
 *
 * Para que as visualizações (Visão Geral, Comparativo, Evolução, Relatórios)
 * fiquem semelhantes entre as duas metodologias, os domínios COPSOQ são
 * convertidos em um "índice de favorabilidade" na mesma escala 0-5,
 * onde maior = melhor (menor risco).
 */

import {
  COPSOQ_DOMAINS,
  dimensionScore,
  normalizedRisk,
  getCopsoqDimension,
  type CopsoqDimension,
} from "@/lib/copsoqMethodology";

import { questions, sections } from "@/data/mockData";

export const COPSOQ_SECTION_PREFIX = "copsoq:";

export interface UnifiedSection {
  id: string;
  name: string;
  shortName: string;
  methodology: "proart" | "copsoq";
}

export function copsoqSectionId(domainId: string) {
  return `${COPSOQ_SECTION_PREFIX}${domainId}`;
}

export function isCopsoqSectionId(sectionId: string) {
  return sectionId.startsWith(COPSOQ_SECTION_PREFIX);
}

export function copsoqDomainIdFromSection(sectionId: string) {
  return sectionId.slice(COPSOQ_SECTION_PREFIX.length);
}

export const COPSOQ_SECTIONS: UnifiedSection[] = COPSOQ_DOMAINS.map(d => ({
  id: copsoqSectionId(d.id),
  name: d.name,
  shortName: d.shortName,
  methodology: "copsoq" as const,
}));

/** Índice 0-5 (maior = melhor) para uma dimensão a partir da sua pontuação bruta */
export function copsoqFavorabilityIndex(dim: CopsoqDimension, score: number): number {
  return Math.round((1 - normalizedRisk(dim, score)) * 5 * 100) / 100;
}

/**
 * Índice 0-5 do domínio COPSOQ para um grupo de respondentes.
 * Média dos índices de favorabilidade das dimensões com dados.
 */
export function copsoqDomainIndex(
  domainId: string,
  pool: { answers: Record<string, number> }[],
): number {
  const domain = COPSOQ_DOMAINS.find(d => d.id === domainId);
  if (!domain || pool.length === 0) return 0;

  const values: number[] = [];
  domain.dimensions.forEach(dim => {
    const scores = pool
      .map(r => dimensionScore(dim, r.answers))
      .filter((v): v is number => v !== null);
    if (scores.length === 0) return;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    values.push(copsoqFavorabilityIndex(dim, avg));
  });

  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

/** Índice 0-5 de uma dimensão específica para um grupo */
export function copsoqDimensionIndex(
  dimensionId: string,
  pool: { answers: Record<string, number> }[],
): number {
  const dim = getCopsoqDimension(dimensionId);
  if (!dim) return 0;
  const scores = pool
    .map(r => dimensionScore(dim, r.answers))
    .filter((v): v is number => v !== null);
  if (scores.length === 0) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return copsoqFavorabilityIndex(dim, avg);
}

/** true se o grupo possui alguma resposta COPSOQ */
export function poolHasCopsoq(pool: { answers: Record<string, number> }[]): boolean {
  return pool.some(r => COPSOQ_DOMAINS.some(d => d.dimensions.some(dim =>
    dim.questionIds.some(q => r.answers[q] !== undefined))));
}

/**
 * Média de uma seção (escala PROART ou domínio COPSOQ) para um conjunto de respondentes.
 * PROART: média bruta 1-5. COPSOQ: índice de favorabilidade 0-5 (maior = melhor).
 */
export function sectionAverageForPool(
  sectionId: string,
  pool: { answers: Record<string, number> }[]
): number {
  if (pool.length === 0) return 0;
  if (isCopsoqSectionId(sectionId)) {
    return copsoqDomainIndex(copsoqDomainIdFromSection(sectionId), pool);
  }
  const qs = questions.filter(q => q.section === sectionId);
  const qsWithData = qs.filter(q => pool.some(r => r.answers[q.id] !== undefined));
  if (qsWithData.length === 0) return 0;
  const avg = qsWithData.reduce((acc, q) => {
    const withAns = pool.filter(r => r.answers[q.id] !== undefined);
    return acc + (withAns.length > 0 ? withAns.reduce((a, r) => a + (r.answers[q.id] || 0), 0) / withAns.length : 0);
  }, 0) / qsWithData.length;
  return Math.round(avg * 100) / 100;
}

/** Seções (PROART + COPSOQ) que possuem dados no conjunto informado */
export function availableSectionsForPool(pool: { answers: Record<string, number> }[]) {
  const answered = new Set<string>();
  pool.forEach(r => Object.keys(r.answers).forEach(k => answered.add(k)));
  const proart = sections
    .filter(s => questions.some(q => q.section === s.id && answered.has(q.id)))
    .map(s => ({ ...s, methodology: "proart" as const }));
  const copsoq = COPSOQ_SECTIONS.filter(s => {
    const domain = COPSOQ_DOMAINS.find(d => copsoqSectionId(d.id) === s.id);
    return !!domain && domain.dimensions.some(dim => dim.questionIds.some(qid => answered.has(qid)));
  });
  return [...proart, ...copsoq];
}
