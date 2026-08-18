import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { COPSOQ_DOMAINS, COPSOQ_DIMENSIONS } from "@/lib/copsoqMethodology";

interface Props {
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function CopsoqDimensionFilter({ selected, onChange, placeholder = "Todas as dimensões" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const selectedNames = COPSOQ_DIMENSIONS.filter(d => selected.includes(d.id)).map(d => d.shortName);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm min-w-[220px] transition-colors",
          "hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          open && "ring-2 ring-ring ring-offset-1"
        )}
      >
        <span className="flex-1 text-left truncate">
          {selected.length === 0
            ? <span className="text-muted-foreground">{placeholder}</span>
            : selectedNames.length <= 2
              ? selectedNames.join(", ")
              : `${selectedNames.length} dimensões selecionadas`}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-50 max-h-[28rem] overflow-y-auto min-w-[300px]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 gap-2">
            <button onClick={() => onChange(COPSOQ_DIMENSIONS.map(d => d.id))} className="text-xs text-primary hover:underline">
              Selecionar todas
            </button>
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="flex items-center gap-1 text-xs text-destructive hover:underline">
                <X className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
          {COPSOQ_DOMAINS.map(domain => (
            <div key={domain.id} className="border-b border-border/50 last:border-0">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40">
                {domain.name}
              </div>
              {domain.dimensions.map(d => (
                <button
                  key={d.id}
                  onClick={() => toggle(d.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                >
                  <div className={cn(
                    "h-4 w-4 rounded border border-border flex items-center justify-center transition-colors shrink-0",
                    selected.includes(d.id) && "bg-primary border-primary"
                  )}>
                    {selected.includes(d.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="flex-1 truncate text-foreground">{d.name}</span>
                  <span className={cn(
                    "text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded",
                    !d.scorable ? "bg-muted text-muted-foreground" : d.type === "positive" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                  )}>
                    {!d.scorable ? "Ofensivo" : d.type === "positive" ? "Positivo" : "Negativo"}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
