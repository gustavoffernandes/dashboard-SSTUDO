import {
  COPSOQ_DOMAINS,
  classifyCopsoq,
  copsoqClassLabel,
  copsoqClassBgColor,
  copsoqBandsText,
  type CopsoqDimension,
} from "@/lib/copsoqMethodology";

export interface CopsoqHeatmapColumn {
  id: string;
  name: string;
}

interface Props {
  /** ids das dimensões a exibir */
  dimensionIds: string[];
  columns: CopsoqHeatmapColumn[];
  /** pontuação média (soma) da dimensão na coluna */
  getDimensionAverage: (dimensionId: string, columnId?: string) => number;
  hideLegend?: boolean;
  title?: string;
}

export function CopsoqHeatmapTable({ dimensionIds, columns, getDimensionAverage, hideLegend, title }: Props) {
  const selected = new Set(dimensionIds);
  const domains = COPSOQ_DOMAINS
    .map(d => ({ ...d, dimensions: d.dimensions.filter(dim => selected.has(dim.id)) }))
    .filter(d => d.dimensions.length > 0);

  if (domains.length === 0) {
    return <p className="text-sm text-muted-foreground">Selecione pelo menos uma dimensão para visualizar o heatmap.</p>;
  }
  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">Selecione pelo menos uma empresa ou formulário para visualizar o heatmap.</p>;
  }

  const rows: { dim: CopsoqDimension; domainName: string; span: number }[] = [];
  domains.forEach(d => {
    d.dimensions.forEach((dim, i) => {
      rows.push({ dim, domainName: d.name, span: i === 0 ? d.dimensions.length : 0 });
    });
  });

  return (
    <div className="space-y-3">
      {title && <span className="text-sm font-semibold text-foreground">{title}</span>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/60">
              <th className="sticky left-0 z-20 bg-secondary/90 px-3 py-2.5 text-left font-semibold text-foreground min-w-[160px] border-r border-border">
                Domínio
              </th>
              <th className="sticky left-[160px] z-10 bg-secondary/90 px-3 py-2.5 text-left font-semibold text-foreground min-w-[220px] border-r border-border">
                Dimensão
              </th>
              {columns.map(c => (
                <th key={c.id} className="px-2 py-2.5 text-center font-semibold text-foreground min-w-[96px]">
                  <span className="block truncate max-w-[150px]" title={c.name}>{c.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ dim, domainName, span }, idx) => {
              const isLastOfGroup = idx === rows.length - 1 || rows[idx + 1].span > 0;
              return (
                <tr
                  key={dim.id}
                  className={`hover:bg-muted/30 transition-colors ${isLastOfGroup ? "border-b border-border" : "border-b border-border/30"}`}
                >
                  {span > 0 && (
                    <td
                      rowSpan={span}
                      className="sticky left-0 z-10 align-middle px-3 py-2 border-r border-border bg-muted/20"
                    >
                      <span className="text-xs font-semibold text-foreground leading-tight">{domainName}</span>
                    </td>
                  )}
                  <td className="sticky left-[160px] z-[5] bg-card px-3 py-2 text-foreground border-r border-border">
                    <div className="flex items-center gap-2">
                      <span className={`w-1 self-stretch rounded-full ${dim.type === "positive" ? "bg-success" : "bg-destructive"}`} />
                      <span>{dim.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">0–{dim.maxScore}</span>
                    </div>
                  </td>
                  {columns.map(c => {
                    const score = getDimensionAverage(dim.id, c.id);
                    if (!dim.scorable) {
                      return (
                        <td key={c.id} className="px-1.5 py-1.5 text-center">
                          <span className="inline-flex flex-col items-center justify-center rounded-md px-2 py-1 min-w-[60px] bg-muted text-muted-foreground">
                            <span className="text-xs font-bold leading-tight">{score.toFixed(1)}</span>
                            <span className="text-[9px] font-semibold uppercase tracking-wide leading-tight">s/ class.</span>
                          </span>
                        </td>
                      );
                    }
                    const cls = classifyCopsoq(dim, score);
                    return (
                      <td key={c.id} className="px-1.5 py-1.5 text-center">
                        <span
                          className={`inline-flex flex-col items-center justify-center rounded-md px-2 py-1 min-w-[60px] ${copsoqClassBgColor(cls)}`}
                          title={`${copsoqClassLabel(cls)} — ${score.toFixed(1)} de ${dim.maxScore}`}
                        >
                          <span className="text-xs font-bold leading-tight">{score.toFixed(1)}</span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide opacity-95 leading-tight">{copsoqClassLabel(cls)}</span>
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
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">Faixas de classificação — COPSOQ II-Br</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-1.5 text-left font-semibold">Dimensão</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Seguro</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Atenção</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Risco</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter(r => r.dim.scorable).map(({ dim }) => {
                  const b = copsoqBandsText(dim);
                  return (
                    <tr key={dim.id} className="border-b border-border/40 last:border-0">
                      <td className="px-2 py-1.5 text-foreground">{dim.name}</td>
                      <td className="px-2 py-1.5 text-center"><span className="rounded bg-success/20 text-success px-2 py-0.5 font-semibold">{b.safe}</span></td>
                      <td className="px-2 py-1.5 text-center"><span className="rounded bg-warning/20 text-warning px-2 py-0.5 font-semibold">{b.attention}</span></td>
                      <td className="px-2 py-1.5 text-center"><span className="rounded bg-destructive/20 text-destructive px-2 py-0.5 font-semibold">{b.risk}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Comportamentos ofensivos são apresentados apenas como frequência média, sem classificação de risco.
          </p>
        </div>
      )}
    </div>
  );
}
