import { useState } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { BarChart3, PieChartIcon, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { scaleLabels } from "@/data/mockData";
import { useIsMobile } from "@/hooks/use-mobile";

type ChartType = "bar" | "pie" | "line" | "radar";

interface QuestionChartProps {
  questionId: string;
  questionText: string;
  companyId?: string;
  getAnswerDistribution?: (questionId: string, companyId?: string) => { value: number; count: number; percentage: number }[];
  /** rótulos personalizados por valor (ex.: escala COPSOQ 0-4) */
  valueLabels?: Record<number, string>;
}

const COLORS = [
  "hsl(217, 71%, 45%)",
  "hsl(170, 60%, 45%)",
  "hsl(38, 92%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 72%, 55%)",
];

const chartTypes: { type: ChartType; icon: typeof BarChart3; label: string }[] = [
  { type: "bar", icon: BarChart3, label: "Barras" },
  { type: "pie", icon: PieChartIcon, label: "Pizza" },
  { type: "line", icon: TrendingUp, label: "Linha" },
  { type: "radar", icon: Target, label: "Radar" },
];

import { getAnswerDistribution as mockGetAnswerDistribution } from "@/data/mockData";

export function QuestionChart({ questionId, questionText, companyId, getAnswerDistribution, valueLabels }: QuestionChartProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const isMobile = useIsMobile();
  const distFn = getAnswerDistribution || mockGetAnswerDistribution;
  const dist = distFn(questionId, companyId);
  const allData = dist.map((d) => ({
    name: valueLabels?.[d.value] ?? scaleLabels[d.value],
    value: d.count,
    percentage: d.percentage,
    score: d.value,
  }));
  // Bar/Line/Radar mantêm todos os pontos (mostra zeros). Pie remove zeros para não sobrepor labels.
  const data = allData;
  const pieData = allData.filter(d => d.value > 0);
  const tickSize = isMobile ? 8 : 10;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-card-foreground line-clamp-2">{questionText}</p>
        <div className="flex gap-1 shrink-0">
          {chartTypes.map(ct => (
            <button
              key={ct.type}
              onClick={() => setChartType(ct.type)}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                chartType === ct.type
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={ct.label}
            >
              <ct.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="h-[180px] sm:h-[200px] min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
               <XAxis dataKey="name" tick={{ fontSize: tickSize, fill: "hsl(var(--muted-foreground))" }} />
               <YAxis tick={{ fontSize: tickSize, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          ) : chartType === "pie" ? (
            pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem respostas</div>
            ) : (
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={isMobile ? 30 : 40} outerRadius={isMobile ? 55 : 70} dataKey="value" label={isMobile ? false : ({ name, percentage }) => `${name}: ${percentage}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
            </PieChart>
            )
          ) : chartType === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
               <XAxis dataKey="name" tick={{ fontSize: tickSize, fill: "hsl(var(--muted-foreground))" }} />
               <YAxis tick={{ fontSize: tickSize, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          ) : (
            <RadarChart data={data} cx="50%" cy="50%" outerRadius={isMobile ? 50 : 65}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: isMobile ? 7 : 9, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis tick={{ fontSize: 8 }} />
              <Radar dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
