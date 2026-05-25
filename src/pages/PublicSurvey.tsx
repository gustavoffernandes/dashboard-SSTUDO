/* eslint-disable react-hooks/rules-of-hooks */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PROART_QUESTIONS, OPEN_QUESTIONS, LIKERT_OPTIONS, DEMOGRAPHIC_OPTIONS, getQuestionsByScale } from "@/lib/proartQuestions";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Loader2, Lock, Save, Shield, AlertCircle, User, Briefcase, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "welcome" | "consent" | "password" | "demographics" | "scale-0" | "scale-1" | "scale-2" | "scale-3" | "open" | "review" | "submitted";

interface FormConfig {
  id: string;
  company_name: string;
  form_title: string | null;
  description: string | null;
  instructions: string | null;
  is_active: boolean;
  is_anonymous: boolean | null;
  require_consent: boolean | null;
  require_password: boolean | null;
  survey_password: string | null;
  start_date: string | null;
  end_date: string | null;
  sector: string | null;
}

interface Demographics {
  sex: string;
  age: string;
  escolaridade: string;
  estado_civil: string;
  tempo_empresa: string;
  sector: string;
  cargo: string;
  respondent_name: string;
}

interface SectorWithRoles {
  name: string;
  roles?: string[];
}

const STORAGE_KEY_PREFIX = "proativa_survey_";

// Navy & Teal palette
const navy = "220 60% 16%";
const navyLight = "218 40% 28%";
const teal = "174 62% 42%";
const tealLight = "174 50% 55%";
const slate = "215 20% 65%";
const cream = "210 20% 98%";

export default function PublicSurvey() {
  const { id } = useParams<{ id: string }>();
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [demographics, setDemographics] = useState<Demographics>({
    sex: "", age: "", escolaridade: "", estado_civil: "",
    tempo_empresa: "", sector: "", cargo: "", respondent_name: "",
  });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [openAnswers, setOpenAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sectors, setSectors] = useState<SectorWithRoles[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const scales = useMemo(() => getQuestionsByScale(), []);
  const totalQuestions = PROART_QUESTIONS.length;
  const answeredCount = Object.keys(answers).length;
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  useEffect(() => {
    if (!id) { setError("Link inválido"); setLoading(false); return; }
    (async () => {
      const { data, error: err } = await (supabase as any)
        .from("public_form_configs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (err || !data) { setError("Pesquisa não encontrada"); setLoading(false); return; }
      const cfg = data as any as FormConfig;
      if (!cfg.is_active) { setError("Esta pesquisa não está mais ativa. Status atual: " + ((data as any).form_status === "pausada" ? "Pausada" : (data as any).form_status === "rascunho" ? "Rascunho" : "Encerrada")); setLoading(false); return; }
      if (cfg.end_date && new Date(cfg.end_date) < new Date()) { setError("O prazo desta pesquisa encerrou"); setLoading(false); return; }
      if (cfg.start_date && new Date(cfg.start_date) > new Date()) { setError("Esta pesquisa ainda não começou"); setLoading(false); return; }
      setConfig(cfg);

      let configSectors: SectorWithRoles[] = [];
      const extractSectors = (sectorsData: any): SectorWithRoles[] => {
        const result: SectorWithRoles[] = [];
        if (Array.isArray(sectorsData)) {
          sectorsData.forEach((s: any) => {
            if (typeof s === "string") result.push({ name: s, roles: [] });
            else if (s && s.name) result.push({ name: s.name, roles: Array.isArray(s.roles) ? s.roles : [] });
          });
        }
        return result;
      };

      configSectors = extractSectors((data as any).sectors);

      // If form has no sectors, check the company's placeholder config
      if (configSectors.length === 0 && (data as any).cnpj) {
        const { data: placeholder } = await supabase
          .from("google_forms_config")
          .select("sectors")
          .eq("cnpj", (data as any).cnpj)
          .eq("spreadsheet_id", "__placeholder__")
          .maybeSingle();
        if (placeholder) {
          configSectors = extractSectors((placeholder as any).sectors);
        }
      }
      // Dedupe by name
      const seen = new Set<string>();
      setSectors(configSectors.filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true; }));

      const sessionToken = localStorage.getItem(STORAGE_KEY_PREFIX + id + "_token") || crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY_PREFIX + id + "_token", sessionToken);

      const { data: existingSession } = await (supabase.from("survey_sessions") as any)
        .select("id, status")
        .eq("config_id", id)
        .eq("session_token", sessionToken)
        .maybeSingle();

      if (existingSession) {
        if (existingSession.status === "completed") {
          setError("Você já respondeu esta pesquisa");
          setLoading(false);
          return;
        }
        setSessionId(existingSession.id);
        await (supabase.from("survey_sessions") as any)
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", existingSession.id);
      } else {
        const { data: newSession } = await (supabase.from("survey_sessions") as any)
          .insert([{ config_id: id, session_token: sessionToken, status: "in_progress" }])
          .select("id")
          .single();
        if (newSession) setSessionId(newSession.id);
      }

      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + id);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.answers) setAnswers(parsed.answers);
          if (parsed.openAnswers) setOpenAnswers(parsed.openAnswers);
          if (parsed.demographics) setDemographics(parsed.demographics);
        }
      } catch {}

      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!id || step === "submitted") return;
    const timeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify({ answers, openAnswers, demographics }));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [answers, openAnswers, demographics, id, step]);

  const setAnswer = useCallback((qId: string, value: number) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  }, []);

  const handleSubmit = async () => {
    if (answeredCount < totalQuestions) return;
    setSubmitting(true);
    try {
      const ageMap: Record<string, number> = { "18 a 25 anos": 21, "26 a 35 anos": 30, "36 a 45 anos": 40, "46 a 55 anos": 50, "Acima de 55 anos": 60 };
      const { error: err } = await supabase.from("survey_responses").insert([{
        config_id: id,
        respondent_name: config?.is_anonymous ? null : demographics.respondent_name || null,
        sex: demographics.sex || null,
        age: ageMap[demographics.age] || null,
        sector: demographics.sector || null,
        cargo: demographics.cargo || null,
        escolaridade: demographics.escolaridade || null,
        estado_civil: demographics.estado_civil || null,
        tempo_empresa: demographics.tempo_empresa || null,
        answers: answers as any,
        open_answers: openAnswers as any,
        response_timestamp: new Date().toISOString(),
      }] as any);
      if (err) throw err;

      if (sessionId) {
        await (supabase.from("survey_sessions") as any)
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", sessionId);
      }

      localStorage.removeItem(STORAGE_KEY_PREFIX + id);
      localStorage.removeItem(STORAGE_KEY_PREFIX + id + "_token");
      setStep("submitted");
    } catch (e: any) {
      alert("Erro ao enviar: " + (e.message || "Tente novamente"));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (loading || step === "submitted") return;

    const scrollToTop = () => window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    const frameId = window.requestAnimationFrame(scrollToTop);
    const timeoutId = window.setTimeout(scrollToTop, 80);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [step, loading]);

  const goNext = () => {
    const steps: Step[] = buildSteps();
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) {
      setStep(steps[idx + 1]);
    }
  };

  const goPrev = () => {
    const steps: Step[] = buildSteps();
    const idx = steps.indexOf(step);
    if (idx > 0) {
      setStep(steps[idx - 1]);
    }
  };

  const buildSteps = (): Step[] => {
    const s: Step[] = ["welcome"];
    if (config?.require_consent) s.push("consent");
    if (config?.require_password) s.push("password");
    s.push("demographics", "scale-0", "scale-1", "scale-2", "scale-3", "open", "review");
    return s;
  };

  const canProceed = (): boolean => {
    if (step === "consent") return consentAccepted;
    if (step === "password") return true; // Always clickable, validation happens on click
    if (step === "demographics") return !!(demographics.sex && demographics.age && demographics.escolaridade && demographics.tempo_empresa && demographics.sector);
    if (step.startsWith("scale-")) {
      const scaleIdx = parseInt(step.split("-")[1]);
      const scale = scales[scaleIdx];
      return scale.questions.every(q => answers[q.id] !== undefined);
    }
    return true;
  };

  // --- Loading ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: `hsl(${navy})` }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `hsl(${teal})` }}>
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
        <p className="text-sm font-medium text-white/70">Carregando pesquisa...</p>
      </div>
    </div>
  );

  // --- Error ---
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `hsl(${navy})` }}>
      <div className="rounded-2xl p-8 max-w-md text-center" style={{ background: `hsl(${navyLight})`, boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(0 72% 55% / 0.15)' }}>
          <AlertCircle className="h-7 w-7" style={{ color: 'hsl(0 72% 65%)' }} />
        </div>
        <h1 className="text-xl font-bold mb-2 text-white">Pesquisa Indisponível</h1>
        <p className="text-sm text-white/60">{error}</p>
      </div>
    </div>
  );

  // --- Submitted ---
  if (step === "submitted") return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `hsl(${navy})` }}>
      <div className="rounded-2xl p-8 max-w-md text-center" style={{ background: `hsl(${navyLight})`, boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: `hsl(${teal} / 0.15)` }}>
          <CheckCircle2 className="h-8 w-8" style={{ color: `hsl(${teal})` }} />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-white">Obrigado!</h1>
        <p className="text-sm mb-6 text-white/60">Suas respostas foram enviadas com sucesso. Agradecemos sua participação nesta pesquisa.</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium" style={{ background: `hsl(${teal} / 0.12)`, color: `hsl(${teal})` }}>
          <Shield className="h-3.5 w-3.5" /> Dados protegidos pela LGPD
        </div>
      </div>
    </div>
  );

  const steps = buildSteps();
  const currentStepIdx = steps.indexOf(step);
  const totalSteps = steps.length;

  const stepLabels: Record<string, string> = {
    welcome: "Início",
    consent: "Consentimento",
    password: "Senha",
    demographics: "Seus Dados",
    "scale-0": scales[0]?.name || "Escala 1",
    "scale-1": scales[1]?.name || "Escala 2",
    "scale-2": scales[2]?.name || "Escala 3",
    "scale-3": scales[3]?.name || "Escala 4",
    open: "Percepção",
    review: "Revisão",
  };

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(180deg, hsl(${navy}) 0%, hsl(${navyLight} / 0.5) 100%)` }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ background: `hsl(${navy} / 0.95)`, backdropFilter: 'blur(12px)', borderColor: `hsl(${slate} / 0.15)` }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: `hsl(${teal})` }}>P</div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white">SSTudo</p>
              <p className="text-[10px] font-medium text-white/40">Avaliação de Riscos Psicossociais</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: `hsl(${teal} / 0.12)`, color: `hsl(${tealLight})` }}>
              <Save className="h-3 w-3" /> Auto-save
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: progress === 100 ? `hsl(${teal} / 0.15)` : `hsl(${slate} / 0.1)`, color: progress === 100 ? `hsl(${teal})` : `hsl(${slate})` }}>
              {answeredCount}/{totalQuestions}
            </div>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      {step !== "welcome" && (
        <div className="sticky top-0 z-40 border-b" style={{ borderColor: `hsl(${slate} / 0.1)`, background: `hsl(${navy} / 0.95)`, backdropFilter: 'blur(12px)' }}>
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: `hsl(${teal})` }}>{stepLabels[step] || step}</span>
              <span className="text-xs font-medium" style={{ color: `hsl(${slate})` }}>Etapa {currentStepIdx + 1} de {totalSteps}</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: `hsl(${slate} / 0.15)` }}>
              <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${((currentStepIdx + 1) / totalSteps) * 100}%`, background: `linear-gradient(90deg, hsl(${teal}), hsl(${tealLight}))` }} />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28">
        {/* Welcome */}
        {step === "welcome" && (
          <div className="text-center space-y-8">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto" style={{ background: `linear-gradient(135deg, hsl(${teal}), hsl(${tealLight}))`, boxShadow: `0 15px 50px -12px hsl(${teal} / 0.5)` }}>
              <BookOpen className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 text-white">{config?.form_title || "Avaliação PROART"}</h1>
              <p className="text-sm max-w-lg mx-auto leading-relaxed" style={{ color: `hsl(${slate})` }}>
                {config?.description || "Pesquisa para avaliação de fatores de risco psicossocial no ambiente de trabalho, fundamentada no Protocolo PROART."}
              </p>
              {config?.company_name && (
                <div className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold" style={{ background: `hsl(${teal} / 0.1)`, color: `hsl(${teal})`, border: `1px solid hsl(${teal} / 0.2)` }}>
                  <Briefcase className="h-3.5 w-3.5" /> {config.company_name}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
              {[
                { icon: FileText, value: "91", label: "Questões" },
                { icon: Clock, value: "15-20", label: "Minutos" },
                { icon: Save, value: "Auto", label: "Salvamento" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="p-4 rounded-2xl" style={{ background: `hsl(${navyLight})`, border: `1px solid hsl(${slate} / 0.1)` }}>
                  <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: `hsl(${teal})` }} />
                  <p className="text-lg font-extrabold text-white">{value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: `hsl(${slate})` }}>{label}</p>
                </div>
              ))}
            </div>

            {config?.instructions && (
              <div className="rounded-2xl p-5 text-left" style={{ background: `hsl(${navyLight})`, border: `1px solid hsl(${teal} / 0.15)` }}>
                <p className="text-sm font-bold flex items-center gap-2 mb-2" style={{ color: `hsl(${teal})` }}><AlertCircle className="h-4 w-4" /> Instruções</p>
                <p className="text-sm leading-relaxed" style={{ color: `hsl(${slate})` }}>{config.instructions}</p>
              </div>
            )}

            <div className="rounded-2xl p-4 text-left" style={{ background: `hsl(${teal} / 0.08)`, border: `1px solid hsl(${teal} / 0.15)` }}>
              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: `hsl(${teal})` }}><Shield className="h-4 w-4" /> Privacidade e LGPD</p>
              <p className="text-xs mt-1" style={{ color: `hsl(${slate})` }}>
                Suas respostas são {config?.is_anonymous ? "anônimas e " : ""}confidenciais, protegidas conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Os dados serão utilizados exclusivamente para fins de pesquisa organizacional.
              </p>
            </div>

            <div className="rounded-2xl p-4 text-left" style={{ background: `hsl(${navyLight} / 0.6)`, border: `1px solid hsl(${slate} / 0.08)` }}>
              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: `hsl(${tealLight})` }}><Save className="h-4 w-4" /> Progresso salvo automaticamente</p>
              <p className="text-xs mt-1" style={{ color: `hsl(${slate} / 0.8)` }}>Se precisar interromper, você pode voltar depois e continuar de onde parou.</p>
            </div>
          </div>
        )}

        {/* Consent */}
        {step === "consent" && (
          <div className="space-y-6">
            <SectionHeader icon={Shield} title="Termo de Consentimento Livre e Esclarecido" subtitle="Leia atentamente antes de prosseguir" />
            <div className="rounded-2xl p-6 space-y-4 text-sm leading-relaxed" style={{ background: `hsl(${navyLight})`, border: `1px solid hsl(${slate} / 0.1)`, color: `hsl(${slate})` }}>
              <p className="font-semibold text-white">De acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), informamos que:</p>
              <ul className="space-y-3">
                {[
                  "Seus dados serão utilizados exclusivamente para fins de pesquisa organizacional e melhoria do ambiente de trabalho.",
                  `As respostas são ${config?.is_anonymous ? "anônimas e " : ""}confidenciais, garantindo total sigilo sobre suas informações.`,
                  "Os resultados serão apresentados de forma agregada, sem identificação individual dos participantes.",
                  "Você pode interromper a pesquisa a qualquer momento, sem qualquer prejuízo.",
                  "Os dados serão armazenados de forma segura, em servidores protegidos, e por tempo determinado conforme a legislação vigente.",
                  "Você tem direito a solicitar a exclusão dos seus dados a qualquer momento.",
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: `hsl(${teal} / 0.15)` }}>
                      <CheckCircle2 className="h-3 w-3" style={{ color: `hsl(${teal})` }} />
                    </div>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <label className="flex items-start gap-4 p-5 rounded-2xl cursor-pointer transition-all" style={{
              background: consentAccepted ? `hsl(${teal} / 0.08)` : `hsl(${navyLight})`,
              border: `2px solid ${consentAccepted ? `hsl(${teal} / 0.4)` : `hsl(${slate} / 0.1)`}`,
            }}>
              <div className="relative mt-0.5">
                <input type="checkbox" checked={consentAccepted} onChange={e => setConsentAccepted(e.target.checked)} className="sr-only" />
                <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all" style={{
                  borderColor: consentAccepted ? `hsl(${teal})` : `hsl(${slate} / 0.4)`,
                  background: consentAccepted ? `hsl(${teal})` : 'transparent',
                }}>
                  {consentAccepted && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
              </div>
              <span className="text-sm font-medium" style={{ color: consentAccepted ? `hsl(${teal})` : `hsl(${slate})` }}>
                Li e concordo com os termos acima e autorizo o tratamento dos meus dados para os fins descritos neste documento.
              </span>
            </label>
          </div>
        )}

        {/* Password */}
        {step === "password" && (
          <div className="space-y-6">
            <SectionHeader icon={Lock} title="Acesso Protegido" subtitle="Esta pesquisa é protegida por senha" />
            <div className="rounded-2xl p-6" style={{ background: `hsl(${navyLight})`, border: `1px solid hsl(${slate} / 0.1)` }}>
              <label className="text-xs font-semibold block mb-2" style={{ color: `hsl(${slate})` }}>Senha de Acesso</label>
              <input type="password" value={passwordInput}
                onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
                placeholder="Digite a senha fornecida"
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all text-white placeholder:text-white/30"
                style={{ background: `hsl(${navy})`, border: `1px solid ${passwordError ? 'hsl(0 72% 55%)' : `hsl(${slate} / 0.15)`}` }} />
              {passwordError && <p className="text-xs mt-2 font-medium" style={{ color: 'hsl(0 72% 65%)' }}>Senha incorreta. Tente novamente.</p>}
            </div>
          </div>
        )}

        {/* Demographics */}
        {step === "demographics" && (
          <div className="space-y-6">
            <SectionHeader icon={User} title="Seus Dados" subtitle="Informações para análise demográfica" />

            {!config?.is_anonymous && (
              <FormCard>
                <FieldLabel label="Nome Completo" />
                <StyledInput value={demographics.respondent_name} onChange={v => setDemographics({ ...demographics, respondent_name: v })} placeholder="Seu nome completo" />
              </FormCard>
            )}

            <FormCard title="Informações Pessoais" icon={User}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StyledSelect label="Gênero" required value={demographics.sex} onChange={v => setDemographics({ ...demographics, sex: v })} options={DEMOGRAPHIC_OPTIONS.genero} />
                <StyledSelect label="Faixa Etária" required value={demographics.age} onChange={v => setDemographics({ ...demographics, age: v })} options={DEMOGRAPHIC_OPTIONS.faixa_etaria} />
                <StyledSelect label="Escolaridade" required value={demographics.escolaridade} onChange={v => setDemographics({ ...demographics, escolaridade: v })} options={DEMOGRAPHIC_OPTIONS.escolaridade} />
                <StyledSelect label="Estado Civil" value={demographics.estado_civil} onChange={v => setDemographics({ ...demographics, estado_civil: v })} options={DEMOGRAPHIC_OPTIONS.estado_civil} />
              </div>
            </FormCard>

            <FormCard title="Informações Profissionais" icon={Briefcase}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StyledSelect label="Tempo na Empresa" required value={demographics.tempo_empresa} onChange={v => setDemographics({ ...demographics, tempo_empresa: v })} options={DEMOGRAPHIC_OPTIONS.tempo_empresa} />
                {sectors.length > 0 ? (
                  <StyledSelect label="Setor" required value={demographics.sector} onChange={v => setDemographics({ ...demographics, sector: v, cargo: "" })} options={sectors.map(s => s.name)} />
                ) : (
                  <div className="space-y-1.5">
                    <FieldLabel label="Setor" required />
                    <StyledInput value={demographics.sector} onChange={v => setDemographics({ ...demographics, sector: v })} placeholder="Digite seu setor" />
                  </div>
                )}
                {(() => {
                  const selectedSector = sectors.find(s => s.name === demographics.sector);
                  const rolesForSelected = selectedSector?.roles || [];
                  const allRoles = Array.from(new Set(sectors.flatMap(s => s.roles || [])));
                  const availableRoles = demographics.sector ? rolesForSelected : allRoles;
                  const handleCargo = (v: string) => {
                    if (!demographics.sector && v) {
                      const owner = sectors.find(s => (s.roles || []).includes(v));
                      setDemographics({ ...demographics, cargo: v, sector: owner?.name || demographics.sector });
                    } else {
                      setDemographics({ ...demographics, cargo: v });
                    }
                  };
                  if (availableRoles.length > 0) {
                    return <StyledSelect label="Função (opcional)" value={demographics.cargo} onChange={handleCargo} options={availableRoles} />;
                  }
                  return (
                    <div className="space-y-1.5">
                      <FieldLabel label="Função (opcional)" />
                      <StyledInput value={demographics.cargo} onChange={v => setDemographics({ ...demographics, cargo: v })} placeholder="Digite sua função" />
                    </div>
                  );
                })()}
              </div>
            </FormCard>
          </div>
        )}

        {/* Scale questions */}
        {step.startsWith("scale-") && (() => {
          const scaleIdx = parseInt(step.split("-")[1]);
          const scale = scales[scaleIdx];
          const scaleAnswered = scale.questions.filter(q => answers[q.id] !== undefined).length;
          return (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ background: `hsl(${teal})` }}>{scaleIdx + 1}</div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{scale.name}</h2>
                    <p className="text-xs" style={{ color: `hsl(${slate})` }}>{scale.fullName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: `hsl(${slate} / 0.15)` }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(scaleAnswered / scale.questions.length) * 100}%`, background: scaleAnswered === scale.questions.length ? `hsl(${teal})` : `linear-gradient(90deg, hsl(${teal}), hsl(${tealLight}))` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: scaleAnswered === scale.questions.length ? `hsl(${teal})` : `hsl(${slate})` }}>{scaleAnswered}/{scale.questions.length}</span>
                </div>
              </div>

              {/* Likert legend */}
              <div className="rounded-xl p-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1" style={{ background: `hsl(${navyLight})`, border: `1px solid hsl(${slate} / 0.1)` }}>
                {LIKERT_OPTIONS.map(opt => (
                  <span key={opt.value} className="text-[11px] font-medium" style={{ color: `hsl(${slate})` }}>
                    <strong className="font-bold" style={{ color: `hsl(${teal})` }}>{opt.value}</strong> = {opt.label}
                  </span>
                ))}
              </div>

              <div className="space-y-3">
                {scale.questions.map(q => (
                  <QuestionCard key={q.id} question={q} value={answers[q.id]} onChange={v => setAnswer(q.id, v)} />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Open questions */}
        {step === "open" && (
          <div className="space-y-5">
            <SectionHeader icon={FileText} title="Sua Percepção" subtitle="Respostas livres — opcional, mas muito valiosas para a análise" />
            {OPEN_QUESTIONS.map((q, i) => (
              <div key={q.id} className="rounded-2xl p-5 space-y-3" style={{ background: `hsl(${navyLight})`, border: `1px solid hsl(${slate} / 0.1)` }}>
                <p className="text-sm font-semibold text-white">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white mr-2" style={{ background: `hsl(${teal})` }}>{i + 1}</span>
                  {q.text}
                </p>
                {q.hint && <p className="text-xs pl-8" style={{ color: `hsl(${slate})` }}>{q.hint}</p>}
                <textarea value={openAnswers[q.id] || ""}
                  onChange={e => setOpenAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 min-h-[100px] resize-y transition-all text-white placeholder:text-white/25"
                  style={{ background: `hsl(${navy})`, border: `1px solid hsl(${slate} / 0.12)` }}
                  placeholder="Compartilhe sua perspectiva..." />
              </div>
            ))}
          </div>
        )}

        {/* Review */}
        {step === "review" && (
          <div className="space-y-6">
            <SectionHeader icon={CheckCircle2} title="Revisão Final" subtitle="Verifique suas respostas antes de enviar" />
            <div className="rounded-2xl p-6 space-y-5" style={{ background: `hsl(${navyLight})`, border: `1px solid hsl(${slate} / 0.1)` }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: `hsl(${slate})` }}>Questões respondidas</span>
                <span className="text-xl font-extrabold text-white">{answeredCount}/{totalQuestions}</span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: `hsl(${slate} / 0.15)` }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: progress === 100 ? `hsl(${teal})` : `linear-gradient(90deg, hsl(${teal}), hsl(${tealLight}))` }} />
              </div>
              {answeredCount < totalQuestions && (
                <div className="rounded-xl p-3" style={{ background: 'hsl(38 92% 55% / 0.08)', border: '1px solid hsl(38 92% 55% / 0.2)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'hsl(38 80% 60%)' }}>⚠️ Faltam {totalQuestions - answeredCount} questões para completar.</p>
                </div>
              )}
              <div className="space-y-1">
                {scales.map((scale, i) => {
                  const scaleAnswered = scale.questions.filter(q => answers[q.id] !== undefined).length;
                  const isComplete = scaleAnswered === scale.questions.length;
                  return (
                    <div key={i} className="flex items-center justify-between py-2.5 border-t" style={{ borderColor: `hsl(${slate} / 0.1)` }}>
                      <span className="text-sm font-medium text-white/80">{scale.name}</span>
                      <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full")}
                        style={{ background: isComplete ? `hsl(${teal} / 0.12)` : 'hsl(38 92% 55% / 0.1)', color: isComplete ? `hsl(${teal})` : 'hsl(38 80% 60%)' }}>
                        {scaleAnswered}/{scale.questions.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={goPrev} disabled={submitting}
                className="sm:w-auto w-full flex items-center justify-center gap-2 rounded-2xl py-4 px-6 text-sm font-bold transition-all disabled:opacity-30"
                style={{ color: `hsl(${tealLight})`, background: `hsl(${slate} / 0.12)`, border: `1px solid hsl(${slate} / 0.2)` }}>
                <ChevronLeft className="h-4 w-4" /> Voltar e revisar
              </button>
              <button onClick={handleSubmit} disabled={submitting || answeredCount < totalQuestions}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl text-white py-4 text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: answeredCount >= totalQuestions ? `linear-gradient(135deg, hsl(${teal}), hsl(${tealLight}))` : `hsl(${slate} / 0.3)`, boxShadow: answeredCount >= totalQuestions ? `0 10px 40px -10px hsl(${teal} / 0.5)` : 'none' }}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><CheckCircle2 className="h-4 w-4" /> Enviar Respostas</>}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Navigation footer */}
      {step !== "review" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t" style={{ background: `hsl(${navy} / 0.95)`, backdropFilter: 'blur(12px)', borderColor: `hsl(${slate} / 0.1)` }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
            <button onClick={goPrev} disabled={currentStepIdx === 0}
              className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              style={{ color: `hsl(${slate})`, background: `hsl(${slate} / 0.1)` }}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button onClick={() => {
              if (step === "password" && passwordInput !== config?.survey_password) {
                setPasswordError(true);
                return;
              }
              goNext();
            }} disabled={!canProceed()}
              className="flex items-center gap-1.5 rounded-xl text-white px-6 py-2.5 text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: `hsl(${teal})`, boxShadow: `0 4px 20px -4px hsl(${teal} / 0.4)` }}>
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== Sub-components ======

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `hsl(${teal} / 0.12)` }}>
        <Icon className="h-5 w-5" style={{ color: `hsl(${teal})` }} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-sm mt-0.5" style={{ color: `hsl(${slate})` }}>{subtitle}</p>
      </div>
    </div>
  );
}

function FormCard({ title, icon: Icon, children }: { title?: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: `hsl(${navyLight})`, border: `1px solid hsl(${slate} / 0.1)` }}>
      {title && (
        <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: `hsl(${slate} / 0.1)` }}>
          {Icon && <Icon className="h-4 w-4" style={{ color: `hsl(${teal})` }} />}
          <h3 className="text-sm font-bold text-white">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return <label className="text-xs font-semibold block" style={{ color: `hsl(${slate})` }}>{label}{required && <span style={{ color: `hsl(${teal})` }}> *</span>}</label>;
}

function StyledInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all text-white placeholder:text-white/25"
      style={{ background: `hsl(${navy})`, border: `1px solid hsl(${slate} / 0.12)` }} />
  );
}

function StyledSelect({ label, value, onChange, options, required }: { label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel label={label} required={required} />
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 appearance-none transition-all"
        style={{ background: `hsl(${navy})`, border: `1px solid hsl(${slate} / 0.12)`, color: value ? 'white' : `hsl(${slate} / 0.5)` }}>
        <option value="">Selecione...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function QuestionCard({ question, value, onChange }: { question: { id: string; number: number; text: string }; value?: number; onChange: (v: number) => void }) {
  const isAnswered = value !== undefined;
  return (
    <div className="rounded-2xl p-4 transition-all duration-200"
      style={{ background: isAnswered ? `hsl(${teal} / 0.08)` : `hsl(218 35% 32%)`, border: `1.5px solid ${isAnswered ? `hsl(${teal} / 0.45)` : `hsl(${slate} / 0.25)`}` }}>
      <p className="text-sm mb-3 text-white font-medium">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold text-white mr-2" style={{ background: isAnswered ? `hsl(${teal})` : `hsl(${slate} / 0.45)` }}>{question.number}</span>
        {question.text}
      </p>
      <div className="flex flex-wrap gap-2">
        {LIKERT_OPTIONS.map(opt => {
          const isSelected = value === opt.value;
          return (
            <button key={opt.value} onClick={() => onChange(opt.value)}
              className="flex-1 min-w-[56px] rounded-xl px-2 py-2.5 text-center transition-all duration-200 border-2"
              style={{
                background: isSelected ? `hsl(${teal})` : `hsl(0 0% 100% / 0.08)`,
                color: isSelected ? 'white' : 'white',
                borderColor: isSelected ? `hsl(${teal})` : `hsl(0 0% 100% / 0.25)`,
                boxShadow: isSelected ? `0 4px 15px -4px hsl(${teal} / 0.5)` : 'none',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
              }}>
              <span className="block text-sm font-extrabold">{opt.value}</span>
              <span className="block text-[9px] leading-tight mt-0.5 opacity-90 font-semibold">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
