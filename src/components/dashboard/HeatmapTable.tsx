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
        rowSpans[j] = -1; // skipped
      }
      rowSpans[i] = span;
    }
  }

  return (
    <div className="space-y-3">
      {title && <span className="text-sm font-semibold text-foreground">{title}</span>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="sticky left-0 z-10 bg-secondary/90 px-4 py-3 text-left font-semibold text-foreground min-w-[200px]">
                Pergunta
              </th>
              <th className="px-3 py-3 text-left font-semibold text-foreground min-w-[160px]">
                Fator
              </th>
              {columns.map((c) => (
                <th key={c.id} className="px-3 py-3 text-center font-semibold text-foreground min-w-[110px]">
                  <span className="block truncate max-w-[160px]" title={c.name}>{c.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ q, factor }, idx) => (
              <tr key={q.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5 text-foreground font-medium">
                  <span className="text-muted-foreground mr-1.5">{q.number}.</span>
                  {q.text}
                </td>
                {rowSpans[idx] > 0 && (
                  <td
                    rowSpan={rowSpans[idx]}
                    className="px-3 py-2 align-middle border-l border-border/50 bg-muted/10"
                  >
                    {factor ? (
                      <div className="flex flex-col gap-1" title={factor.name}>
                        <span className="text-xs font-semibold text-foreground leading-tight">{factor.name}</span>
                        <span className={`inline-flex items-center self-start text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${factor.type === "positive" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                          {factor.type === "positive" ? "Positivo" : "Negativo"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                )}
                {columns.map((c) => {
                  const avg = getQuestionAverage(q.id, c.id);
                  const type = factor?.type ?? "positive";
                  const level = classifyRisk(avg, type);
                  const label = getLabel(level);
                  return (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <span
                        className={`inline-flex flex-col items-center justify-center rounded-md px-2 py-1 min-w-[64px] ${getColor(level)}`}
                        title={label}
                      >
                        <span className="text-xs font-bold leading-tight">{avg.toFixed(1)}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide opacity-95 leading-tight">{label}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!hideLegend && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-semibold text-success">Fatores positivos:</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded bg-success/80" />
              <span className="text-xs text-foreground font-medium">Bom</span>
              <span className="text-[10px] text-muted-foreground">(≥ 3.70)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded bg-warning/70" />
              <span className="text-xs text-foreground font-medium">Moderado</span>
              <span className="text-[10px] text-muted-foreground">(2.30 – 3.69)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded bg-destructive/70" />
              <span className="text-xs text-foreground font-medium">Ruim</span>
              <span className="text-[10px] text-muted-foreground">(&lt; 2.30)</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-semibold text-destructive">Fatores negativos:</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded bg-success/80" />
              <span className="text-xs text-foreground font-medium">Bom</span>
              <span className="text-[10px] text-muted-foreground">(≤ 2.29)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded bg-warning/70" />
              <span className="text-xs text-foreground font-medium">Moderado</span>
              <span className="text-[10px] text-muted-foreground">(2.30 – 3.69)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded bg-destructive/70" />
              <span className="text-xs text-foreground font-medium">Ruim</span>
              <span className="text-[10px] text-muted-foreground">(≥ 3.70)</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
