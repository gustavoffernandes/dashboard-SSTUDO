import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type AppRole = "admin" | "user" | "company_user" | "super_admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  userCompanyId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isCompanyUser: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string): Promise<{ role: AppRole; companyId: string | null }> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    
    // company_id is not yet in generated types, fetch separately
    const { data: fullData } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    
    return {
      role: (data?.role as AppRole) ?? "user",
      companyId: (fullData as any)?.company_id ?? null,
    };
  };

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const result = await fetchRole(session.user.id);
            if (isMounted) {
              setRole(result.role);
              setUserCompanyId(result.companyId);
            }
          }, 0);
        } else {
          setRole(null);
          setUserCompanyId(null);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const result = await fetchRole(session.user.id);
          if (isMounted) {
            setRole(result.role);
            setUserCompanyId(result.companyId);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = useCallback(async () => {
    setRole(null);
    setUserCompanyId(null);
    await supabase.auth.signOut();
  }, []);

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!session) return;
    timeoutRef.current = setTimeout(() => {
      toast({ title: "Sessão expirada", description: "Você foi desconectado por inatividade.", variant: "destructive" });
      signOut();
    }, SESSION_TIMEOUT_MS);
  }, [session, signOut]);

  useEffect(() => {
    if (!session) return;
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => resetTimeout();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimeout();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [session, resetTimeout]);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      role,
      userCompanyId,
      loading,
      isAdmin: role === "admin" || role === "super_admin",
      isCompanyUser: role === "company_user",
      isSuperAdmin: role === "super_admin",
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
