import { type Question } from "@/data/mockData";
import { classifyRisk, getFactorByQuestionId, type RiskLevel } from "@/lib/proartMethodology";

function getColor(level: RiskLevel): string {
  if (level === "low") return "bg-success/80 text-success-foreground";
  if (level === "medium") return "bg-warning/70 text-warning-foreground";
  return "bg-destructive/70 text-destructive-foreground";
}

function getLabel(level: RiskLevel): string {
  if (level === "low") return "Bom";
  if (level === "medium") return "Moderado";
  return "Ruim";
}

export interface HeatmapColumn {
  id: string;
  name: string;
}

interface HeatmapProps {
  questions: Question[];
  columns: HeatmapColumn[];
  getQuestionAverage: (questionId: string, columnId?: string) => number;
  hideLegend?: boolean;
  title?: string;
}

export function HeatmapTable({ questions, columns, getQuestionAverage, hideLegend, title }: HeatmapProps) {
  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma pergunta disponível para os fatores selecionados.</p>;
  }

  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">Selecione pelo menos uma empresa ou formulário para visualizar o heatmap.</p>;
  }

  // Group consecutive questions by factor for rowSpan
  const rows = questions.map(q => {
    const factor = getFactorByQuestionId(q.id);
    return { q, factor };
  });

  const rowSpans: number[] = new Array(rows.length).fill(0);
  for (let i = 0; i < rows.length; i++) {
    if (rowSpans[i] === 0) {
      let span = 1;
      const fid = rows[i].factor?.id;
      for (let j = i + 1; j < rows.length && rows[j].factor?.id === fid; j++) {
        span++;
        rowSpans[j] = -1;
      }
      rowSpans[i] = span;
    }
  }

  return (
    <div className="space-y-3">
      {title && <span className="text-sm font-semibold text-foreground">{title}</span>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/60">
              <th className="sticky left-0 z-20 bg-secondary/90 px-3 py-2.5 text-left font-semibold text-foreground min-w-[150px] border-r border-border">
                Fator
              </th>
              <th className="sticky left-[150px] z-10 bg-secondary/90 px-3 py-2.5 text-left font-semibold text-foreground min-w-[260px] border-r border-border">
                Pergunta
              </th>
              {columns.map((c) => (
                <th key={c.id} className="px-2 py-2.5 text-center font-semibold text-foreground min-w-[96px]">
                  <span className="block truncate max-w-[150px]" title={c.name}>{c.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ q, factor }, idx) => {
              const isFirstOfGroup = rowSpans[idx] > 0;
              const isLastOfGroup = idx === rows.length - 1 || rows[idx + 1].factor?.id !== factor?.id;
              return (
                <tr
                  key={q.id}
                  className={`hover:bg-muted/30 transition-colors ${isLastOfGroup ? "border-b border-border" : "border-b border-border/30"}`}
                >
                  {isFirstOfGroup && (
                    <td
                      rowSpan={rowSpans[idx]}
                      className={`sticky left-0 z-10 align-middle px-3 py-2 border-r border-border ${factor?.type === "positive" ? "bg-success/5" : "bg-destructive/5"}`}
                    >
                      {factor ? (
                        <div className="flex items-center gap-2" title={factor.name}>
                          <span className={`w-1 self-stretch rounded-full ${factor.type === "positive" ? "bg-success" : "bg-destructive"}`} />
                          <span className="text-xs font-semibold text-foreground leading-tight">{factor.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  )}
                  <td className="sticky left-[150px] z-[5] bg-card px-3 py-2 text-foreground border-r border-border">
                    <span className="text-muted-foreground mr-1.5">{q.number}.</span>
                    {q.text}
                  </td>
                  {columns.map((c) => {
                    const avg = getQuestionAverage(q.id, c.id);
                    const type = factor?.type ?? "positive";
                    const level = classifyRisk(avg, type);
                    const label = getLabel(level);
                    return (
                      <td key={c.id} className="px-1.5 py-1.5 text-center">
                        <span
                          className={`inline-flex flex-col items-center justify-center rounded-md px-2 py-1 min-w-[60px] ${getColor(level)}`}
                          title={label}
                        >
                          <span className="text-xs font-bold leading-tight">{avg.toFixed(1)}</span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide opacity-95 leading-tight">{label}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!hideLegend && (
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1 rounded-lg border border-border bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-success inline-block" />
              Fatores Positivos
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-success/80 text-success-foreground font-bold">✓</span>
                  <span className="font-medium">Bom</span>
                </span>
                <span className="text-muted-foreground font-semibold">≥ 3,70</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-warning/70 text-warning-foreground font-bold">!</span>
                  <span className="font-medium">Moderado</span>
                </span>
                <span className="text-muted-foreground font-semibold">2,30 – 3,69</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-destructive/70 text-destructive-foreground font-bold">×</span>
                  <span className="font-medium">Ruim</span>
                </span>
                <span className="text-muted-foreground font-semibold">&lt; 2,30</span>
              </div>
            </div>
          </div>

          <div className="flex-1 rounded-lg border border-border bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-destructive inline-block" />
              Fatores Negativos
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-success/80 text-success-foreground font-bold">✓</span>
                  <span className="font-medium">Bom</span>
                </span>
                <span className="text-muted-foreground font-semibold">≤ 2,29</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-warning/70 text-warning-foreground font-bold">!</span>
                  <span className="font-medium">Moderado</span>
                </span>
                <span className="text-muted-foreground font-semibold">2,30 – 3,69</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-destructive/70 text-destructive-foreground font-bold">×</span>
                  <span className="font-medium">Ruim</span>
                </span>
                <span className="text-muted-foreground font-semibold">≥ 3,70</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
