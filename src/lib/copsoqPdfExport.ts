import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  COPSOQ_DOMAINS,
  COPSOQ_SCORABLE_DIMENSIONS,
  COPSOQ_OFFENSIVE_DIMENSIONS,
  classifyCopsoq,
  copsoqClassLabel,
  copsoqBandsText,
  dimensionAverage,
  dimensionScore,
  dimensionDistribution,
  normalizedRisk,
  getCopsoqDimension,
  calculateCopsoqPxS,
  offensiveSummary,
  type CopsoqDimension,
} from "@/lib/copsoqMethodology";
import { COPSOQ_OPTION_SETS, getCopsoqQuestionsByDomain } from "@/lib/copsoqQuestions";
import { getPRLevelLabel } from "@/lib/proartMethodology";
import type { PDFExportData } from "@/lib/pdfExport";

const COLORS = {
  primary: [15, 30, 61] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  muted: [120, 120, 120] as [number, number, number],
  bg: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightBg: [241, 245, 249] as [number, number, number],
};

const BG_SAFE: [number, number, number] = [200, 240, 200];
const BG_ATT: [number, number, number] = [255, 240, 180];
const BG_RISK: [number, number, number] = [250, 200, 200];

const PAGE_WIDTH = 210;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function rd(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function addHeader(doc: jsPDF, companyName: string, subtitle: string) {
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, doc.internal.pageSize.width, 38, "F");
  doc.setFillColor(...COLORS.accent);
  doc.circle(22, 19, 10, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("P", 19, 23);
  doc.setFontSize(16);
  doc.text("SSTudo", 38, 17);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(rd(subtitle), 38, 25);
  doc.setFontSize(8);
  doc.text(rd(companyName), 38, 33);
}

function addFooter(doc: jsPDF, pageNum: number) {
  const pageHeight = doc.internal.pageSize.height;
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, pageHeight - 16, PAGE_WIDTH - MARGIN, pageHeight - 16);
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    rd(`SSTudo - Relatorio COPSOQ II-Br gerado em ${new Date().toLocaleDateString("pt-BR")}`),
    MARGIN,
    pageHeight - 10,
  );
  doc.text(`Pagina ${pageNum}`, doc.internal.pageSize.width - 30, pageHeight - 10);
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, companyName: string, subtitle: string, pageNum: { value: number }): number {
  if (y + needed > 265) {
    doc.addPage();
    pageNum.value++;
    addHeader(doc, companyName, subtitle);
    addFooter(doc, pageNum.value);
    return 48;
  }
  return y;
}

function addSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(rd(text), MARGIN + 4, y + 1.5);
  doc.setTextColor(...COLORS.text);
  return y + 12;
}

function classBg(cls: "seguro" | "atencao" | "risco"): [number, number, number] {
  return cls === "seguro" ? BG_SAFE : cls === "atencao" ? BG_ATT : BG_RISK;
}

export function exportCompanyCopsoqPDF(companyId: string, data: PDFExportData, formName?: string) {
  const company = data.companies.find(c => c.id === companyId);
  if (!company) return;

  const doc = new jsPDF();
  const pool = data.getCompanyRespondents(companyId) as any[];
  const bags = pool.map(r => ({ answers: r.answers as Record<string, number> }));
  const pageNum = { value: 1 };
  const subtitle = "Relatorio COPSOQ II-Br - Riscos Psicossociais";

  addHeader(doc, company.name, subtitle);
  addFooter(doc, pageNum.value);

  let y = 48;

  // ==================== 1. INFO ====================
  y = addSectionTitle(doc, "1. Informacoes da Avaliacao", y);
  autoTable(doc, {
    startY: y,
    body: [
      ["Empresa", rd(company.name)],
      ["Metodologia", "COPSOQ II-Br (versao curta) - 40 questoes, 7 dominios, 23 dimensoes"],
      ["Formulario", rd(formName || "Todos os formularios")],
      ["Setor da empresa", rd(company.sector || "Nao informado")],
      ["Questionarios Preenchidos", String(pool.length)],
      ["Data do Relatorio", new Date().toLocaleDateString("pt-BR")],
    ],
    theme: "plain",
    bodyStyles: { fontSize: 9, textColor: COLORS.text, cellPadding: { top: 2, bottom: 2, left: 4, right: 4 } },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;

  // ==================== 2. RESULTS BY DOMAIN / DIMENSION ====================
  y = checkPageBreak(doc, y, 25, company.name, subtitle, pageNum);
  y = addSectionTitle(doc, "2. Resultados por Dominio e Dimensao", y);

  const dimAvg: Record<string, number> = {};
  COPSOQ_SCORABLE_DIMENSIONS.forEach(d => { dimAvg[d.id] = dimensionAverage(d, bags); });

  const resultRows: any[] = [];
  COPSOQ_DOMAINS.forEach(domain => {
    const scorable = domain.dimensions.filter(d => d.scorable);
    if (scorable.length === 0) return;
    resultRows.push([
      { content: rd(domain.name), colSpan: 4, styles: { fontStyle: "bold" as const, fillColor: COLORS.lightBg, textColor: COLORS.primary, halign: "left" as const } },
    ]);
    scorable.forEach(d => {
      const avg = dimAvg[d.id] || 0;
      const cls = classifyCopsoq(d, avg);
      resultRows.push([
        { content: rd(`   ${d.name}`), styles: { halign: "left" as const } },
        `${avg.toFixed(2)} / ${d.maxScore}`,
        d.type === "positive" ? "Positiva" : "Negativa",
        { content: rd(copsoqClassLabel(cls)), styles: { fillColor: classBg(cls), fontStyle: "bold" as const } },
      ]);
    });
  });

  autoTable(doc, {
    startY: y,
    head: [["Dominio / Dimensao", "Pontuacao", "Tipo", "Classificacao"]],
    body: resultRows,
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2, halign: "center", valign: "middle", lineColor: [200, 200, 200], lineWidth: 0.2 },
    bodyStyles: { textColor: COLORS.text },
    columnStyles: { 0: { halign: "left", cellWidth: 85 }, 1: { cellWidth: 28 }, 2: { cellWidth: 22 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;

  // ==================== 3. MATRIX DOMAIN > DIMENSION > SECTOR ====================
  doc.addPage();
  pageNum.value++;
  addHeader(doc, company.name, "Matriz Dominio x Dimensao x Setor");
  addFooter(doc, pageNum.value);
  let my = 48;
  my = addSectionTitle(doc, "3. Classificacao das Dimensoes por Setor", my);

  const sectorSet = new Set<string>();
  pool.forEach(r => { if (r.sector) sectorSet.add(r.sector); });
  const sectorList = Array.from(sectorSet).sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (sectorList.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text("Nenhum setor identificado nas respostas.", MARGIN, my + 4);
    my += 10;
  } else {
    const scorableDomains = COPSOQ_DOMAINS.filter(d => d.dimensions.some(x => x.scorable));
    const allDims: CopsoqDimension[] = scorableDomains.flatMap(d => d.dimensions.filter(x => x.scorable));

    const domainHeaderRow: any[] = [
      { content: "Dominio", styles: { halign: "center", valign: "middle", fillColor: COLORS.primary, textColor: COLORS.white } },
      ...scorableDomains.map(d => ({
        content: rd(d.shortName),
        colSpan: d.dimensions.filter(x => x.scorable).length,
        styles: { halign: "center", fillColor: COLORS.primary, textColor: COLORS.white },
      })),
    ];
    const dimensionHeaderRow: any[] = [
      { content: "Dimensao", styles: { halign: "center", valign: "middle", fillColor: COLORS.white, textColor: COLORS.text, fontStyle: "bold" as const } },
      ...allDims.map(d => ({
        content: rd(d.shortName),
        styles: { halign: "center", fillColor: COLORS.white, textColor: COLORS.text, fontStyle: "bold" as const },
      })),
    ];
    const sectorHeaderRow: any[] = [
      { content: "Setor", styles: { halign: "center", valign: "middle", fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: "bold" as const } },
      ...allDims.map(() => ({ content: "", styles: { fillColor: COLORS.primary } })),
    ];

    type CellMeta = { label: string; bg: [number, number, number]; hasData: boolean };
    const matrix: CellMeta[][] = sectorList.map(sector => {
      const sectorBags = pool.filter(r => r.sector === sector).map(r => ({ answers: r.answers as Record<string, number> }));
      return allDims.map(d => {
        const withData = sectorBags.filter(b => dimensionScore(d, b.answers) !== null);
        if (withData.length === 0) return { label: "-", bg: COLORS.lightBg, hasData: false };
        const avg = dimensionAverage(d, withData);
        const cls = classifyCopsoq(d, avg);
        return { label: `${avg.toFixed(1)}\n${rd(copsoqClassLabel(cls))}`, bg: classBg(cls), hasData: true };
      });
    });

    autoTable(doc, {
      startY: my,
      head: [domainHeaderRow, dimensionHeaderRow, sectorHeaderRow],
      body: sectorList.map((sector, i) => [
        { content: rd(sector), styles: { fontStyle: "bold" as const, fillColor: COLORS.lightBg } },
        ...matrix[i].map(c => ({ content: c.label })),
      ]),
      theme: "grid",
      styles: { fontSize: 5.2, cellPadding: 1, halign: "center", valign: "middle", lineColor: [180, 180, 180], lineWidth: 0.2 },
      headStyles: { fontSize: 5.2, fontStyle: "bold" },
      bodyStyles: { textColor: COLORS.text },
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_WIDTH,
      columnStyles: { 0: { halign: "left", cellWidth: 24, fontSize: 6 } },
      didParseCell: d => {
        if (d.section === "body" && d.column.index > 0) {
          const cell = matrix[d.row.index]?.[d.column.index - 1];
          if (cell) {
            d.cell.styles.fillColor = cell.bg;
            d.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    my = (doc as any).lastAutoTable?.finalY + 6 || my + 40;

    // Color key
    my = checkPageBreak(doc, my, 12, company.name, "Legenda", pageNum);
    const legendItems: { label: string; bg: [number, number, number] }[] = [
      { label: "Seguro", bg: BG_SAFE },
      { label: "Atencao", bg: BG_ATT },
      { label: "Risco", bg: BG_RISK },
      { label: "Sem dados", bg: COLORS.lightBg },
    ];
    let lx = MARGIN;
    legendItems.forEach(it => {
      doc.setFillColor(...it.bg);
      doc.rect(lx, my - 3, 4, 4, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.text);
      doc.text(it.label, lx + 6, my);
      lx += 6 + doc.getTextWidth(it.label) + 6;
    });
    my += 8;
  }

  // Bands legend (COPSOQ classification)
  my = checkPageBreak(doc, my, 60, company.name, "Legenda COPSOQ", pageNum);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.primary);
  doc.text(rd("Classificacao das Dimensoes (COPSOQ II-Br)"), MARGIN, my);
  my += 5;

  autoTable(doc, {
    startY: my,
    head: [["Dimensao", "Pontuacao", "Seguro", "Atencao", "Risco"]],
    body: COPSOQ_SCORABLE_DIMENSIONS.map(d => {
      const b = copsoqBandsText(d);
      return [
        rd(d.name),
        `0 - ${d.maxScore}`,
        { content: b.safe, styles: { fillColor: BG_SAFE } },
        { content: b.attention, styles: { fillColor: BG_ATT } },
        { content: b.risk, styles: { fillColor: BG_RISK } },
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 7, fontStyle: "bold" },
    styles: { fontSize: 7, cellPadding: 1.5, halign: "center", valign: "middle", lineColor: [200, 200, 200], lineWidth: 0.2 },
    bodyStyles: { textColor: COLORS.text },
    columnStyles: { 0: { halign: "left", cellWidth: 60 } },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_WIDTH,
  });

  // ==================== 4. P×S ====================
  doc.addPage();
  pageNum.value++;
  addHeader(doc, company.name, "Calculo do Risco PxS");
  addFooter(doc, pageNum.value);
  let py = 48;
  py = addSectionTitle(doc, "4. Calculo do Risco e Matriz PxS", py);

  const highRiskCount = bags.filter(b =>
    COPSOQ_SCORABLE_DIMENSIONS.some(d => {
      const s = dimensionScore(d, b.answers);
      return s !== null && classifyCopsoq(d, s) === "risco";
    }),
  ).length;

  const pxs = calculateCopsoqPxS(dimAvg, bags.length, highRiskCount);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text("RISCO = PROBABILIDADE (P) x SEVERIDADE (S)", MARGIN, py);
  py += 8;

  autoTable(doc, {
    startY: py,
    head: [["Variavel", "Valor", "Descricao"]],
    body: [
      ["Probabilidade (P)", String(pxs.P), rd("Exposicao (demandas/conflito) e controle (influencia, suporte, lideranca)")],
      ["Severidade (S)", String(pxs.S), rd("Gravidade (saude geral, burnout, estresse) e pessoas expostas")],
      ["Risco (PxS)", String(pxs.risk), `${pxs.P} x ${pxs.S} = ${pxs.risk}`],
      ["Classificacao", rd(getPRLevelLabel(pxs.prLevel)), rd(`Prazo de acao: ${pxs.deadlineDays === 0 ? "Imediato" : pxs.deadlineDays + " dias"}`)],
      ["Respondentes em risco", `${highRiskCount} de ${bags.length}`, rd("Ao menos uma dimensao classificada como Risco")],
    ],
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: COLORS.text },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 42 }, 1: { cellWidth: 25, halign: "center" } },
    margin: { left: MARGIN, right: MARGIN },
  });
  py = (doc as any).lastAutoTable?.finalY + 8 || py + 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(rd("Matriz de Classificacao dos Riscos:"), MARGIN, py);
  py += 4;

  autoTable(doc, {
    startY: py,
    head: [["P \\ S", "S=1", "S=2", "S=3", "S=4", "S=5"]],
    body: [
      ["P=5", "5", "10", "15", "20", "25"],
      ["P=4", "4", "8", "12", "16", "20"],
      ["P=3", "3", "6", "9", "12", "15"],
      ["P=2", "2", "4", "6", "8", "10"],
      ["P=1", "1", "2", "3", "4", "5"],
    ],
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 8, fontStyle: "bold", halign: "center" },
    bodyStyles: { fontSize: 8, textColor: COLORS.text, halign: "center" },
    columnStyles: { 0: { fontStyle: "bold" } },
    margin: { left: 40, right: 40 },
    didParseCell: d => {
      if (d.section === "body") {
        const val = parseInt(d.cell.raw as string);
        if (!isNaN(val)) {
          if (val >= 17) d.cell.styles.fillColor = [254, 202, 202];
          else if (val >= 10) d.cell.styles.fillColor = [254, 240, 138];
          else if (val >= 5) d.cell.styles.fillColor = [187, 247, 208];
          else d.cell.styles.fillColor = [219, 234, 254];
          if (val === pxs.risk) {
            d.cell.styles.fontStyle = "bold";
            d.cell.styles.lineWidth = 0.5;
            d.cell.styles.lineColor = [0, 0, 0];
          }
        }
      }
    },
  });
  py = (doc as any).lastAutoTable?.finalY + 8 || py + 40;

  autoTable(doc, {
    startY: py,
    head: [["Nivel", "Classificacao", "Faixa de Risco", "Conduta"]],
    body: [
      ["Critico", "PR1", "25", rd("Acoes corretivas imediatas. Reavaliacao apos implementacao.")],
      ["Alto", "PR2", "15-24", rd("Rotinas reavaliadas e novas medidas em ate 30 dias.")],
      ["Moderado", "PR3", "10-14", rd("Rotinas monitoradas, novas medidas em ate 90 dias.")],
      ["Baixo", "PR4", "6-9", rd("Manter controle, avaliar prevencao em 180 dias.")],
      ["Muito Baixo", "NA", "1-5", rd("Manter controle existente, reavaliacao anual.")],
    ],
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 7, textColor: COLORS.text },
    columnStyles: { 3: { cellWidth: 70 } },
    margin: { left: MARGIN, right: MARGIN },
  });

  // ==================== 5. OFFENSIVE BEHAVIORS ====================
  doc.addPage();
  pageNum.value++;
  addHeader(doc, company.name, "Comportamentos Ofensivos");
  addFooter(doc, pageNum.value);
  let oy = 48;
  oy = addSectionTitle(doc, "5. Comportamentos Ofensivos (ultimos 12 meses)", oy);

  const offensive = offensiveSummary(bags);
  autoTable(doc, {
    startY: oy,
    head: [["Comportamento", "Respondentes", "Relataram exposicao", "%", "Frequencia semanal/diaria"]],
    body: offensive.map(o => [
      rd(o.dimension.name),
      String(o.total),
      String(o.exposed),
      `${o.pctExposed}%`,
      String(o.frequent),
    ]),
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2, halign: "center", valign: "middle" },
    bodyStyles: { textColor: COLORS.text },
    columnStyles: { 0: { halign: "left", cellWidth: 60 } },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: d => {
      if (d.section === "body" && d.column.index === 3) {
        const pct = parseInt(String(d.cell.raw));
        if (!isNaN(pct) && pct > 0) {
          d.cell.styles.fillColor = pct >= 10 ? BG_RISK : BG_ATT;
          d.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  oy = (doc as any).lastAutoTable?.finalY + 8 || oy + 40;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  const note = rd(
    "Os comportamentos ofensivos nao recebem classificacao de risco por faixas. Qualquer relato exige acolhimento imediato da pessoa exposta, apuracao com sigilo e divulgacao dos canais de denuncia, conforme politica interna e legislacao aplicavel.",
  );
  doc.splitTextToSize(note, CONTENT_WIDTH).forEach((line: string) => {
    doc.text(line, MARGIN, oy);
    oy += 4.5;
  });

  // ==================== 6. CONCLUSAO ====================
  doc.addPage();
  pageNum.value++;
  addHeader(doc, company.name, "Conclusao");
  addFooter(doc, pageNum.value);
  let cy = 48;
  cy = addSectionTitle(doc, "6. Conclusao", cy);

  const riskLabelMap: Record<string, string> = { PR1: "CRITICO", PR2: "ALTO", PR3: "MODERADO", PR4: "BAIXO", NA: "MUITO BAIXO" };
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);

  const conclusion = rd(
    `A avaliacao dos riscos psicossociais realizada por meio do COPSOQ II-Br (Copenhagen Psychosocial Questionnaire - versao curta brasileira), composto por 40 questoes distribuidas em 23 dimensoes e 7 dominios, indica que o ambiente de trabalho da empresa ${company.name} apresenta classificacao de risco ${riskLabelMap[pxs.prLevel] || "MODERADO"} (${pxs.prLevel}), com indice PxS igual a ${pxs.risk}. Foram considerados ${bags.length} questionarios respondidos.`,
  );
  doc.splitTextToSize(conclusion, CONTENT_WIDTH).forEach((line: string) => {
    doc.text(line, MARGIN, cy);
    cy += 4.5;
  });
  cy += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(rd("Principais pontos de atencao identificados:"), MARGIN, cy);
  cy += 6;

  const attentionRows: any[] = [];
  COPSOQ_DOMAINS.forEach(domain => {
    const scorable = domain.dimensions.filter(d => d.scorable);
    if (scorable.length === 0) return;
    const critical = scorable
      .map(d => ({ d, avg: dimAvg[d.id] || 0, cls: classifyCopsoq(d, dimAvg[d.id] || 0) }))
      .filter(x => x.cls !== "seguro")
      .sort((a, b) => (a.cls === "risco" ? -1 : 1) - (b.cls === "risco" ? -1 : 1));
    if (critical.length === 0) return;
    attentionRows.push([
      { content: rd(domain.name), colSpan: 3, styles: { fontStyle: "bold" as const, fillColor: COLORS.lightBg, textColor: COLORS.primary, halign: "left" as const } },
    ]);
    critical.forEach(x => {
      attentionRows.push([
        { content: rd(`   ${x.d.name}`), styles: { halign: "left" as const } },
        `${x.avg.toFixed(2)} / ${x.d.maxScore}`,
        { content: rd(copsoqClassLabel(x.cls)), styles: { fillColor: classBg(x.cls), fontStyle: "bold" as const } },
      ]);
    });
  });

  if (attentionRows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(rd("Nenhuma dimensao foi classificada como Atencao ou Risco."), MARGIN, cy);
    doc.setTextColor(...COLORS.text);
    cy += 8;
  } else {
    autoTable(doc, {
      startY: cy,
      head: [["Dominio / Dimensao", "Pontuacao", "Classificacao"]],
      body: attentionRows,
      theme: "grid",
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2, halign: "center", valign: "middle", lineColor: [200, 200, 200], lineWidth: 0.2 },
      bodyStyles: { textColor: COLORS.text },
      columnStyles: { 0: { halign: "left", cellWidth: 105 }, 1: { cellWidth: 30 } },
      margin: { left: MARGIN, right: MARGIN },
    });
    cy = (doc as any).lastAutoTable?.finalY + 8 || cy + 40;
  }

  cy = checkPageBreak(doc, cy, 24, company.name, "Conclusao", pageNum);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  const rec = rd(
    `Recomenda-se a implementacao prioritaria das acoes propostas no Plano de Acao (secao 7), com reavaliacao em ${pxs.deadlineDays === 0 ? "ate 30 dias" : pxs.deadlineDays + " dias"} para acompanhamento da evolucao dos indicadores. As intervencoes devem priorizar as dimensoes classificadas como Risco, seguidas das dimensoes em Atencao. Eventuais relatos de comportamentos ofensivos exigem tratativa imediata, independentemente do indice geral.`,
  );
  doc.splitTextToSize(rec, CONTENT_WIDTH).forEach((line: string) => {
    doc.text(line, MARGIN, cy);
    cy += 4.5;
  });

  // ==================== 7. ACTION PLANS ====================
  doc.addPage();
  pageNum.value++;
  addHeader(doc, company.name, "Plano de Acao");
  addFooter(doc, pageNum.value);
  let ay = 48;
  ay = addSectionTitle(doc, "7. Plano de Acao", ay);

  const realPlans = (data.actionPlans || []).filter(p =>
    p.company_config_id === companyId ||
    pool.some((r: any) => r.configId === p.company_config_id),
  );

  if (realPlans.length > 0) {
    const allDimsById = new Map(
      [...COPSOQ_SCORABLE_DIMENSIONS, ...COPSOQ_OFFENSIVE_DIMENSIONS].map(d => [d.id, d]),
    );

    const formConfigsMap = new Map<string, string>();
    (data.formConfigs || []).forEach(fc => formConfigsMap.set(fc.configId, fc.title));

    const plansByForm = new Map<string, typeof realPlans>();
    realPlans.forEach(plan => {
      const key = plan.company_config_id || "__unknown__";
      if (!plansByForm.has(key)) plansByForm.set(key, []);
      plansByForm.get(key)!.push(plan);
    });

    let planNum = 1;
    const formGroups = Array.from(plansByForm.entries());

    formGroups.forEach(([configId, formPlans], groupIdx) => {
      if (formGroups.length > 1) {
        ay = checkPageBreak(doc, ay, 20, company.name, "Plano de Acao (cont.)", pageNum);
        doc.setFillColor(...COLORS.accent);
        doc.rect(MARGIN, ay - 3, CONTENT_WIDTH, 7, "F");
        doc.setTextColor(...COLORS.white);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(rd(formConfigsMap.get(configId) || `Formulario ${groupIdx + 1}`), MARGIN + 4, ay + 1);
        doc.setTextColor(...COLORS.text);
        ay += 10;
      }

      formPlans.forEach(plan => {
        ay = checkPageBreak(doc, ay, 30, company.name, "Plano de Acao (cont.)", pageNum);
        const statusColor = plan.status === "completed" ? COLORS.success : plan.status === "in_progress" ? COLORS.warning : COLORS.muted;
        doc.setFillColor(...statusColor);
        doc.rect(MARGIN, ay - 3, 3, 6, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.text);
        doc.text(rd(`${planNum}. ${plan.title}`), MARGIN + 6, ay);

        const statusLabel = plan.status === "completed" ? "Concluido" : plan.status === "in_progress" ? "Em andamento" : "Pendente";
        doc.setFontSize(7);
        doc.setTextColor(...statusColor);
        doc.text(`[${statusLabel}]`, 160, ay);
        doc.setTextColor(...COLORS.text);
        ay += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.muted);
        doc.text(
          rd(`Dimensao: ${allDimsById.get(plan.factor_id)?.name || plan.factor_id} | Nivel: ${plan.risk_level}`),
          MARGIN + 6,
          ay,
        );
        doc.setTextColor(...COLORS.text);
        ay += 6;

        const planTasks = (data.actionTasks || []).filter(t => t.action_plan_id === plan.id);
        if (planTasks.length > 0) {
          autoTable(doc, {
            startY: ay,
            head: [["O que", "Por que", "Como", "Status"]],
            body: planTasks.map(t => [
              rd(t.title),
              rd(t.description || "-"),
              rd(t.observation || "-"),
              t.is_completed ? "Executada" : "Pendente",
            ]),
            theme: "grid",
            headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 7, fontStyle: "bold" },
            bodyStyles: { fontSize: 7, textColor: COLORS.text },
            columnStyles: { 3: { cellWidth: 22, halign: "center" } },
            alternateRowStyles: { fillColor: COLORS.bg },
            margin: { left: MARGIN + 4, right: MARGIN },
            didParseCell: cd => {
              if (cd.section === "body" && cd.column.index === 3) {
                const val = String(cd.cell.raw);
                cd.cell.styles.textColor = val === "Executada" ? COLORS.success : COLORS.warning;
                cd.cell.styles.fontStyle = "bold";
              }
            },
          });
          ay = (doc as any).lastAutoTable?.finalY + 6 || ay + 30;
        } else {
          ay += 4;
        }
        planNum++;
      });
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.splitTextToSize(
      rd("Nenhum plano de acao foi cadastrado para esta empresa ate o momento. Para criar planos de acao baseados nas dimensoes de risco identificadas, acesse a pagina 'Planos de Acao' na plataforma SSTudo."),
      CONTENT_WIDTH,
    ).forEach((line: string) => {
      doc.text(line, MARGIN, ay);
      ay += 4.5;
    });
    ay += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(rd("Os planos de acao serao incluidos neste relatorio assim que forem criados na plataforma."), MARGIN, ay);
    doc.setTextColor(...COLORS.text);
  }

  // ==================== 8. DETALHAMENTO POR QUESTAO ====================
  const domainBlocks = getCopsoqQuestionsByDomain();
  let detailIndex = 0;

  domainBlocks.forEach(block => {
    const answeredQs = block.questions.filter(q => pool.some((r: any) => typeof r.answers?.[q.id] === "number"));
    if (answeredQs.length === 0) return;

    doc.addPage();
    pageNum.value++;
    addHeader(doc, company.name, `Detalhamento - ${block.fullName}`);
    addFooter(doc, pageNum.value);

    let dy = 48;
    if (detailIndex === 0) {
      dy = addSectionTitle(doc, "8. Detalhamento das Questoes e Respostas", dy);
    } else {
      dy = addSectionTitle(doc, `8.${detailIndex + 1} ${block.fullName}`, dy);
    }
    detailIndex++;

    // agrupa por conjunto de opcoes (rotulos podem variar dentro do dominio)
    const bySet = new Map<string, typeof answeredQs>();
    answeredQs.forEach(q => {
      if (!bySet.has(q.optionSet)) bySet.set(q.optionSet, [] as any);
      bySet.get(q.optionSet)!.push(q);
    });

    bySet.forEach((qs, setId) => {
      const options = [...COPSOQ_OPTION_SETS[setId as keyof typeof COPSOQ_OPTION_SETS]].sort((a, b) => a.value - b.value);
      const maxValue = Math.max(...options.map(o => o.value));

      const rows = qs.map(q => {
        const values = pool
          .map((r: any) => r.answers?.[q.id])
          .filter((v: any) => typeof v === "number") as number[];
        const total = values.length;
        const avg = total > 0 ? values.reduce((a, b) => a + b, 0) / total : 0;
        const dim = getCopsoqDimension(q.dimensionId);
        const counts = options.map(o => {
          const c = values.filter(v => v === o.value).length;
          return `${c} (${total > 0 ? Math.round((c / total) * 100) : 0}%)`;
        });
        return { q, dim, avg, total, counts };
      });

      autoTable(doc, {
        startY: dy,
        head: [["No", "Pergunta", "Dimensao", "Media", ...options.map(o => rd(o.label))]],
        body: rows.map(r => [
          r.q.code,
          rd(r.q.text),
          rd(r.dim?.shortName || r.dim?.name || "-"),
          `${r.avg.toFixed(2)} / ${maxValue}`,
          ...r.counts,
        ]),
        theme: "grid",
        headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 6.5, fontStyle: "bold" },
        bodyStyles: { fontSize: 6.5, textColor: COLORS.text },
        styles: { cellPadding: 1.5, valign: "middle", lineColor: [200, 200, 200], lineWidth: 0.2 },
        columnStyles: {
          0: { cellWidth: 9, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 62 },
          2: { cellWidth: 26 },
          3: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        },
        alternateRowStyles: { fillColor: COLORS.bg },
        margin: { left: MARGIN, right: MARGIN },
        tableWidth: CONTENT_WIDTH,
        didParseCell: cd => {
          if (cd.section === "body" && cd.column.index >= 4) cd.cell.styles.halign = "center";
          if (cd.section === "body" && cd.column.index === 3) {
            const row = rows[cd.row.index];
            if (row && row.dim?.scorable && maxValue > 0) {
              const ratio = Math.max(0, Math.min(1, row.avg / maxValue));
              const riskRatio = row.dim.type === "negative" ? ratio : 1 - ratio;
              cd.cell.styles.fillColor = riskRatio >= 0.67 ? BG_RISK : riskRatio >= 0.34 ? BG_ATT : BG_SAFE;
            }
          }
        },
      });
      dy = (doc as any).lastAutoTable?.finalY + 6 || dy + 40;
      dy = checkPageBreak(doc, dy, 30, company.name, `Detalhamento - ${block.fullName}`, pageNum);
    });
  });

  // ==================== 9. RESPOSTAS POR SETOR ====================
  if (sectorList.length > 0) {
    doc.addPage();
    pageNum.value++;
    addHeader(doc, company.name, "Respostas por Setor");
    addFooter(doc, pageNum.value);
    let sy = 48;
    sy = addSectionTitle(doc, "9. Participacao e Indice de Risco por Setor", sy);

    const scorableDomainsForSector = COPSOQ_DOMAINS.filter(d => d.dimensions.some(x => x.scorable));

    autoTable(doc, {
      startY: sy,
      head: [["Setor", "Respondidos", "% Total", ...scorableDomainsForSector.map(d => rd(d.shortName))]],
      body: sectorList.map(sector => {
        const sectorPool = pool.filter((r: any) => r.sector === sector);
        const sectorBags = sectorPool.map((r: any) => ({ answers: r.answers as Record<string, number> }));
        const pct = pool.length > 0 ? `${Math.round((sectorPool.length / pool.length) * 100)}%` : "0%";
        const domainIdx = scorableDomainsForSector.map(dom => {
          const dims = dom.dimensions.filter(x => x.scorable);
          const vals = dims
            .map(d => {
              const withData = sectorBags.filter(b => dimensionScore(d, b.answers) !== null);
              if (withData.length === 0) return null;
              return normalizedRisk(d, dimensionAverage(d, withData));
            })
            .filter((v): v is number => v !== null);
          if (vals.length === 0) return "-";
          return String(Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100));
        });
        return [rd(sector), String(sectorPool.length), pct, ...domainIdx];
      }),
      theme: "grid",
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 7, textColor: COLORS.text },
      styles: { halign: "center", valign: "middle", cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
      columnStyles: { 0: { halign: "left", cellWidth: 34, fontStyle: "bold" } },
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_WIDTH,
      didParseCell: cd => {
        if (cd.section === "body" && cd.column.index >= 3) {
          const v = parseInt(String(cd.cell.raw));
          if (!isNaN(v)) {
            cd.cell.styles.fillColor = v >= 67 ? BG_RISK : v >= 34 ? BG_ATT : BG_SAFE;
            cd.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    sy = (doc as any).lastAutoTable?.finalY + 6 || sy + 40;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      rd("Indice de risco normalizado por dominio: 0 = melhor cenario possivel, 100 = pior cenario possivel."),
      MARGIN,
      sy,
    );
    doc.setTextColor(...COLORS.text);
  }

  // ==================== PAGINA FINAL ====================
  doc.addPage();
  pageNum.value++;
  addHeader(doc, company.name, "");
  addFooter(doc, pageNum.value);

  let fy = 80;
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.text("SSTudo", MARGIN, fy);
  fy += 8;
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.text(rd("COPSOQ II-Br - Copenhagen Psychosocial Questionnaire (versao curta brasileira)"), MARGIN, fy);
  fy += 5;
  doc.text(rd("Instrumento validado para avaliacao de fatores de risco psicossocial no trabalho."), MARGIN, fy);
  fy += 10;

  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.text(rd(`Relatorio gerado automaticamente em ${new Date().toLocaleDateString("pt-BR")}`), MARGIN, fy);
  fy += 5;
  doc.text(rd(`Empresa avaliada: ${company.name}`), MARGIN, fy);
  fy += 8;
  doc.text(rd("As interpretacoes e recomendacoes devem ser validadas por profissional habilitado em"), MARGIN, fy);
  fy += 4;
  doc.text(rd("saude e seguranca do trabalho."), MARGIN, fy);

  const safeName = company.name.replace(/[^a-z0-9]/gi, "_");
  doc.save(`Relatorio_COPSOQ_${safeName}_${new Date().toISOString().split("T")[0]}.pdf`);
}

