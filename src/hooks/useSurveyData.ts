import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { questions, sections, type Respondent, type Company } from "@/data/mockData";

export interface SurveyResponse {
  id: string;
  config_id: string;
  response_timestamp: string | null;
  respondent_name: string | null;
  sex: string | null;
  age: number | null;
  sector: string | null;
  answers: Record<string, number>;
}

export interface RealCompany {
  id: string;
  name: string;
  sector: string;
  employees: number;
  color: string;
}

export interface FormConfig {
  configId: string;
  companyKey: string;
  title: string;
}

const COMPANY_COLORS = [
  "hsl(217, 71%, 45%)", "hsl(170, 60%, 45%)", "hsl(38, 92%, 55%)",
  "hsl(280, 60%, 55%)", "hsl(0, 72%, 55%)", "hsl(200, 80%, 50%)",
  "hsl(330, 65%, 50%)", "hsl(150, 55%, 45%)",
];

// Build a set of valid question IDs for fast lookup
const VALID_QUESTION_IDS = new Set(questions.map(q => q.id));

export function useSurveyData() {
  const { userCompanyId, isCompanyUser } = useAuth();

  const { data: configs = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ["google-forms-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_forms_config")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { data: rawResponses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ["survey-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*");
      if (error) throw error;
      return (data || []) as SurveyResponse[];
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const isLoading = loadingConfigs || loadingResponses;

  const cnpjToConfigIds = new Map<string, string[]>();
  const cnpjToCompanyInfo = new Map<string, { name: string; sector: string; employees: number | null; cnpj: string; city: string }>();

  const formConfigs: FormConfig[] = [];

  const normalizeCity = (v: any) => (v || "").toString().trim().toLowerCase();
  const branchKey = (c: any) => c.cnpj ? `${c.cnpj}__${normalizeCity(c.address_city)}` : c.id;

  configs.forEach((c: any) => {
    const key = branchKey(c);
    const cityLabel = (c.address_city || "").toString().trim();
    const baseName = c.company_name || "Empresa sem nome";
    if (!cnpjToConfigIds.has(key)) {
      cnpjToConfigIds.set(key, []);
      cnpjToCompanyInfo.set(key, {
        name: cityLabel ? `${baseName} — ${cityLabel}` : baseName,
        sector: c.sector ? c.sector.charAt(0).toUpperCase() + c.sector.slice(1).toLowerCase() : "Não informado",
        employees: c.employee_count || null,
        cnpj: c.cnpj || "",
        city: cityLabel,
      });
    }
    cnpjToConfigIds.get(key)!.push(c.id);

    if (c.spreadsheet_id !== "__placeholder__") {
      formConfigs.push({
        configId: c.id,
        companyKey: key,
        title: c.form_title || c.sheet_name || `Formulário ${cnpjToConfigIds.get(key)!.length}`,
      });
    }
  });

  // Sort companies and forms alphabetically (pt-BR) for consistent filter ordering
  const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
  formConfigs.sort((a, b) => collator.compare(a.title, b.title));

  const configIdToCompanyKey = new Map<string, string>();
  cnpjToConfigIds.forEach((configIds, key) => {
    configIds.forEach(configId => configIdToCompanyKey.set(configId, key));
  });

  const userCompanyKey = userCompanyId ? configIdToCompanyKey.get(userCompanyId) || userCompanyId : null;

  const filteredCompanyKeys = isCompanyUser && userCompanyKey
    ? [userCompanyKey]
    : Array.from(cnpjToConfigIds.keys());

  const filteredConfigIds = new Set<string>();
  filteredCompanyKeys.forEach(key => {
    (cnpjToConfigIds.get(key) || []).forEach(id => filteredConfigIds.add(id));
  });

  const filteredRawResponses = rawResponses.filter(r => filteredConfigIds.has(r.config_id));

  const companies: RealCompany[] = filteredCompanyKeys
    .map((key, i) => {
      const info = cnpjToCompanyInfo.get(key);
      if (!info) return null;
      const companyConfigIds = cnpjToConfigIds.get(key) || [];
      const responseCount = filteredRawResponses.filter(r => companyConfigIds.includes(r.config_id)).length;
      return {
        id: key,
        name: info.name || "Empresa sem nome",
        sector: info.sector,
        employees: info.employees || responseCount,
        color: COMPANY_COLORS[i % COMPANY_COLORS.length],
        cnpj: info.cnpj,
      };
    })
    .filter((c): c is RealCompany => c !== null)
    .sort((a, b) => collator.compare(a.name, b.name));

  const respondents: Respondent[] = filteredRawResponses.map(r => {
    const formattedAnswers: Record<string, number> = {};

    if (r.answers) {
      Object.entries(r.answers).forEach(([key, cellValue]) => {
        // Strategy 1: Key is already a valid question ID (internal forms)
        if (VALID_QUESTION_IDS.has(key)) {
          const numValue = parseInt(String(cellValue), 10);
          if (numValue >= 1 && numValue <= 5) {
            formattedAnswers[key] = numValue;
          }
          return;
        }

        // Strategy 2: Try text-based value parsing for legacy data
        let numValue = parseInt(String(cellValue), 10);
        if (isNaN(numValue)) {
          const textVal = String(cellValue).toLowerCase();
          if (textVal.includes("nunca")) numValue = 1;
          else if (textVal.includes("raramente")) numValue = 2;
          else if (textVal.includes("vezes") || textVal.includes("às vezes")) numValue = 3;
          else if (textVal.includes("frequentemente") || textVal.includes("frequente")) numValue = 4;
          else if (textVal.includes("sempre")) numValue = 5;
        }

        if (numValue >= 1 && numValue <= 5) {
          // Try to find question by key as-is (shouldn't match but safe fallback)
          formattedAnswers[key] = numValue;
        }
      });
    }

    return {
      id: r.id,
      configId: r.config_id,
      companyId: configIdToCompanyKey.get(r.config_id) || r.config_id,
      name: r.respondent_name || `RESP${r.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`,
      sex: (r.sex === "Masculino" || r.sex === "Feminino") ? r.sex : "Prefiro não declarar",
      age: r.age || 0,
      sector: r.sector ? r.sector.charAt(0).toUpperCase() + r.sector.slice(1).toLowerCase() : "Não informado",
      answers: formattedAnswers,
      responseTimestamp: r.response_timestamp,
    };
  });

  const hasData = respondents.length > 0;

  function getCompanyRespondents(companyId: string): Respondent[] {
    return respondents.filter(r => r.companyId === companyId);
  }

  function getQuestionAverage(questionId: string, companyId?: string): number {
    const pool = companyId ? getCompanyRespondents(companyId) : respondents;
    const withAnswer = pool.filter(r => r.answers[questionId] !== undefined);
    if (withAnswer.length === 0) return 0;
    const sum = withAnswer.reduce((acc, r) => acc + (r.answers[questionId] || 0), 0);
    return Math.round((sum / withAnswer.length) * 100) / 100;
  }

  function getSectionAverage(sectionId: string, companyId?: string): number {
    const sectionQuestions = questions.filter(q => q.section === sectionId);
    if (sectionQuestions.length === 0) return 0;
    const pool = companyId ? getCompanyRespondents(companyId) : respondents;
    if (pool.length === 0) return 0;

    const questionsWithData = sectionQuestions.filter(q =>
      pool.some(r => r.answers[q.id] !== undefined)
    );
    if (questionsWithData.length === 0) return 0;

    const avg = questionsWithData.reduce((acc, q) => acc + getQuestionAverage(q.id, companyId), 0) / questionsWithData.length;
    return Math.round(avg * 100) / 100;
  }

  function getAnswerDistribution(questionId: string, companyId?: string) {
    const pool = companyId ? getCompanyRespondents(companyId) : respondents;
    const withAnswer = pool.filter(r => r.answers[questionId] !== undefined);
    return [1, 2, 3, 4, 5].map(value => {
      const count = withAnswer.filter(r => r.answers[questionId] === value).length;
      return {
        value,
        count,
        percentage: withAnswer.length > 0 ? Math.round((count / withAnswer.length) * 100) : 0,
      };
    });
  }

  function getAvailableQuestions() {
    const available = new Set<string>();
    respondents.forEach(r => {
      Object.keys(r.answers).forEach(k => available.add(k));
    });
    return questions.filter(q => available.has(q.id));
  }

  function getAvailableSections() {
    const availableQs = getAvailableQuestions();
    const sectionIds = new Set(availableQs.map(q => q.section));
    return sections.filter(s => sectionIds.has(s.id));
  }

  function getOutlierResponses(companyId: string, threshold: number = 1.5) {
    const pool = getCompanyRespondents(companyId);
    const outliers: { respondent: Respondent; questionId: string; value: number; sectorAvg: number; deviation: number }[] = [];

    const sectorGroups: Record<string, Respondent[]> = {};
    pool.forEach(r => {
      if (!sectorGroups[r.sector]) sectorGroups[r.sector] = [];
      sectorGroups[r.sector].push(r);
    });

    Object.entries(sectorGroups).forEach(([, sectorRespondents]) => {
      if (sectorRespondents.length < 3) return;

      const availableQs = getAvailableQuestions();
      availableQs.forEach(q => {
        const answers = sectorRespondents.filter(r => r.answers[q.id] !== undefined).map(r => r.answers[q.id]);
        if (answers.length < 3) return;

        const mean = answers.reduce((a, b) => a + b, 0) / answers.length;
        const stdDev = Math.sqrt(answers.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / answers.length);
        if (stdDev === 0) return;

        sectorRespondents.forEach(r => {
          if (r.answers[q.id] === undefined) return;
          const deviation = Math.abs(r.answers[q.id] - mean) / stdDev;
          if (deviation >= threshold) {
            outliers.push({
              respondent: r,
              questionId: q.id,
              value: r.answers[q.id],
              sectorAvg: Math.round(mean * 100) / 100,
              deviation: Math.round(deviation * 100) / 100,
            });
          }
        });
      });
    });

    return outliers.sort((a, b) => b.deviation - a.deviation);
  }

  function getSectorAverages(companyId: string) {
    const pool = getCompanyRespondents(companyId);
    const sectorSet = [...new Set(pool.map(r => r.sector))].sort();
    const availableSects = getAvailableSections();

    return sectorSet.map(sector => {
      const sectorPool = pool.filter(r => r.sector === sector);
      const sectionAvgs: Record<string, number> = {};
      availableSects.forEach(s => {
        const qs = questions.filter(q => q.section === s.id);
        const qsWithData = qs.filter(q => sectorPool.some(r => r.answers[q.id] !== undefined));
        if (qsWithData.length === 0) { sectionAvgs[s.id] = 0; return; }
        const avg = qsWithData.reduce((acc, q) => {
          const withAns = sectorPool.filter(r => r.answers[q.id] !== undefined);
          if (withAns.length === 0) return acc;
          return acc + withAns.reduce((a, r) => a + r.answers[q.id], 0) / withAns.length;
        }, 0) / qsWithData.length;
        sectionAvgs[s.id] = Math.round(avg * 100) / 100;
      });
      return { sector, count: sectorPool.length, sectionAvgs };
    });
  }

  function getFormConfigsForCompany(companyKey: string): FormConfig[] {
    return formConfigs.filter(f => f.companyKey === companyKey);
  }

  return {
    isLoading,
    hasData,
    companies,
    respondents,
    formConfigs,
    getCompanyRespondents,
    getQuestionAverage,
    getSectionAverage,
    getAnswerDistribution,
    getAvailableQuestions,
    getAvailableSections,
    getOutlierResponses,
    getSectorAverages,
    getFormConfigsForCompany,
  };
}
