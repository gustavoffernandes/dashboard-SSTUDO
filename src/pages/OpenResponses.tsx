import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSurveyData } from "@/hooks/useSurveyData";
import { useGlobalFilter } from "@/contexts/GlobalFilterContext";
import { PageSkeleton } from "@/components/dashboard/PageSkeleton";
import { OPEN_QUESTIONS } from "@/lib/proartQuestions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Building2, Calendar, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface OpenResponse {
  id: string;
  config_id: string;
  respondent_name: string | null;
  sector: string | null;
  open_answers: Record<string, string> | null;
  response_timestamp: string | null;
}

export default function OpenResponses() {
  const { companies, formConfigs, isLoading: surveyLoading } = useSurveyData();
  const { companyId, formId: selectedFormId } = useGlobalFilter();

  const { data: responses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ["open-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("id, config_id, respondent_name, sector, open_answers, response_timestamp")
        .not("open_answers", "is", null);
      if (error) throw error;
      return (data || []) as OpenResponse[];
    },
  });

  const filteredResponses = useMemo(() => {
    return responses.filter(r => {
      if (selectedFormId && r.config_id !== selectedFormId) return false;
      // Filter out responses with empty open_answers
      if (!r.open_answers || Object.values(r.open_answers).every(v => !v || !v.trim())) return false;
      return true;
    });
  }, [responses, selectedFormId]);

  // Group by question
  const grouped = useMemo(() => {
    const map: Record<string, { text: string; responses: { id: string; answer: string; name: string | null; sector: string | null; date: string | null }[] }> = {};
    OPEN_QUESTIONS.forEach(q => {
      map[q.id] = { text: q.text, responses: [] };
    });
    filteredResponses.forEach(r => {
      if (!r.open_answers) return;
      Object.entries(r.open_answers).forEach(([qId, answer]) => {
        if (answer && answer.trim() && map[qId]) {
          map[qId].responses.push({
            id: r.id,
            answer: answer.trim(),
            name: r.respondent_name || `RESP${r.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`,
            sector: r.sector,
            date: r.response_timestamp,
          });
        }
      });
    });
    return map;
  }, [filteredResponses]);

  const totalOpenAnswers = Object.values(grouped).reduce((sum, g) => sum + g.responses.length, 0);

  if (surveyLoading || loadingResponses) return <DashboardLayout><PageSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Respostas Livres</h1>
            <p className="text-sm text-muted-foreground mt-1">Respostas abertas dos participantes organizadas por pergunta</p>
          </div>
          <Badge variant="secondary" className="text-sm gap-1.5 self-start">
            <MessageSquareText className="h-3.5 w-3.5" />
            {totalOpenAnswers} respostas
          </Badge>
        </div>

        {formConfigs.length > 1 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedFormId}
              onChange={e => setSelectedFormId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todos os formulários</option>
              {formConfigs
                .slice()
                .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
                .map(fc => (
                  <option key={fc.configId} value={fc.configId}>{fc.title}</option>
                ))}
            </select>
          </div>
        )}

        {totalOpenAnswers === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquareText className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma resposta livre encontrada</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                As respostas livres aparecerão aqui quando os participantes responderem às perguntas abertas do formulário.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {OPEN_QUESTIONS.map((q, qIdx) => {
              const group = grouped[q.id];
              if (!group || group.responses.length === 0) return null;
              return (
                <Card key={q.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                        {qIdx + 1}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{group.text}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{group.responses.length} resposta{group.responses.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {group.responses.map((resp, i) => (
                      <div key={resp.id + "-" + i} className="rounded-xl border bg-muted/30 p-4 space-y-2">
                        <p className="text-sm text-foreground leading-relaxed">&ldquo;{resp.answer}&rdquo;</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{resp.name}</span>
                          {resp.sector && (
                            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{resp.sector}</span>
                          )}
                          {resp.date && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(resp.date).toLocaleDateString("pt-BR")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
