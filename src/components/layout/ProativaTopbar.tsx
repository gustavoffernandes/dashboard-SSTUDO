import { useState, useRef, useEffect } from "react";
import { Search, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const allSearchableItems = [
  { label: "Visão Geral", path: "/", keywords: ["dashboard", "home", "início"], adminOnly: false },
  { label: "Análise por Pergunta", path: "/analise", keywords: ["análise", "pergunta", "survey"], adminOnly: false },
  { label: "Comparação de Empresas", path: "/empresas", keywords: ["comparação", "empresa", "benchmark"], adminOnly: false },
  { label: "Perfil Demográfico", path: "/demografico", keywords: ["demográfico", "perfil", "gênero", "idade"], adminOnly: false },
  { label: "Heatmap de Satisfação", path: "/heatmap", keywords: ["heatmap", "calor", "satisfação"], adminOnly: false },
  { label: "Relatórios", path: "/relatorios", keywords: ["relatório", "exportar", "pdf", "csv"], adminOnly: false },
  { label: "Integrações", path: "/integracoes", keywords: ["integração", "google", "sheets"], adminOnly: true },
  { label: "Configurações", path: "/configuracoes", keywords: ["configuração", "tema", "perfil"], adminOnly: false },
];

interface TopbarProps {
  onMenuClick: () => void;
}

export function ProativaTopbar({ onMenuClick }: TopbarProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { isAdmin, user, isSuperAdmin } = useAuth();

  const searchableItems = allSearchableItems.filter(item => !item.adminOnly || isAdmin);

  const results = query.trim().length > 0
    ? searchableItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.keywords.some(k => k.includes(query.toLowerCase()))
      )
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (path: string) => {
    navigate(path);
    setQuery("");
    setShowResults(false);
  };

  // Derive display name and role from user metadata
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const displayRole = user?.user_metadata?.role_label || (isAdmin ? "Administrador" : "Usuário");
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b border-border bg-card/80 px-4 md:px-6 backdrop-blur-md gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative flex-1 max-w-[320px]" ref={wrapperRef}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar página..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            className="w-full border-none bg-secondary pl-10 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
          />
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-50 overflow-hidden">
              {results.map(item => (
                <button
                  key={item.path}
                  onClick={() => handleSelect(item.path)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {showResults && query.trim().length > 0 && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-50 p-3">
              <p className="text-xs text-muted-foreground">Nenhum resultado encontrado.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="ml-1 md:ml-2 flex items-center gap-2 md:gap-3">
          <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs md:text-sm font-semibold shrink-0">
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-foreground truncate max-w-[160px]">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{displayRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
