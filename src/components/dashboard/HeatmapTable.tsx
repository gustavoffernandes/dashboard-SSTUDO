import { questions, type Question } from "@/data/mockData";

function getColor(value: number, isNegative: boolean): string {
  const v = isNegative ? 6 - value : value;
  if (v >= 4) return "bg-success/80 text-success-foreground";
  if (v >= 3) return "bg-warning/70 text-warning-foreground";
  return "bg-destructive/70 text-destructive-foreground";
}

function getLabel(value: number, isNegative: boolean): string {
  const v = isNegative ? 6 - value : value;
  if (v >= 4) return "Bom";
  if (v >= 3) return "Moderado";
  return "Ruim";
}

export interface HeatmapColumn {
  id: string;
  name: string;
}

interface HeatmapProps {
  sectionId: string;
  columns: HeatmapColumn[];
  getQuestionAverage: (questionId: string, columnId?: string) => number;
  getAvailableQuestions: () => Question[];
  isNegativeSection?: boolean;
  hideHeader?: boolean;
  hideLegend?: boolean;
  title?: string;
}

export function HeatmapTable({ sectionId, columns, getQuestionAverage, getAvailableQuestions, isNegativeSection, hideHeader, hideLegend, title }: HeatmapProps) {
  const availableQuestions = getAvailableQuestions();
  const sectionQuestions = availableQuestions.filter((q) => q.section === sectionId);
  const isNegative = isNegativeSection ?? (sectionId === "vivencias" || sectionId === "saude");

  if (sectionQuestions.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma pergunta com dados nesta seção.</p>;
  }

  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">Selecione pelo menos uma empresa ou formulário para visualizar o heatmap.</p>;
  }

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <div className="flex items-center gap-3 flex-wrap">
          {title && <span className="text-sm font-semibold text-foreground">{title}</span>}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isNegative ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
            {isNegative ? "⚠ Perguntas Negativas" : "✓ Perguntas Positivas"}
          </span>
          <span className="text-xs text-muted-foreground">
            {isNegative
              ? "Valores mais altos indicam maior risco"
              : "Valores mais altos indicam melhor resultado"}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="sticky left-0 z-10 bg-secondary/90 px-4 py-3 text-left font-semibold text-foreground min-w-[200px]">
                Pergunta
              </th>
              {columns.map((c) => (
                <th key={c.id} className="px-3 py-3 text-center font-semibold text-foreground min-w-[110px]">
                  <span className="block truncate max-w-[160px]" title={c.name}>{c.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sectionQuestions.map((q) => (
              <tr key={q.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="sticky left-0 z-10 bg-card px-4 py-2.5 text-foreground font-medium">
                  <span className="text-muted-foreground mr-1.5">{q.number}.</span>
                  {q.text}
                </td>
                {columns.map((c) => {
                  const avg = getQuestionAverage(q.id, c.id);
                  const label = getLabel(avg, isNegative);
                  return (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <span
                        className={`inline-flex flex-col items-center justify-center rounded-md px-2 py-1 min-w-[64px] ${getColor(avg, isNegative)}`}
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
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          <span className="text-xs font-semibold text-muted-foreground">Legenda:</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-success/80" />
            <span className="text-xs text-foreground font-medium">Bom</span>
            <span className="text-[10px] text-muted-foreground">
              ({isNegative ? "≤ 2.0" : "≥ 4.0"})
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-warning/70" />
            <span className="text-xs text-foreground font-medium">Moderado</span>
            <span className="text-[10px] text-muted-foreground">
              ({isNegative ? "2.1 – 3.0" : "3.0 – 3.9"})
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-destructive/70" />
            <span className="text-xs text-foreground font-medium">Ruim</span>
            <span className="text-[10px] text-muted-foreground">
              ({isNegative ? "> 3.0" : "< 3.0"})
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
