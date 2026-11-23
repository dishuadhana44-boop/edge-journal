import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    const user = session?.user ?? null;

    const profile = user
      ? {
          id: user.id,
          email: user.email ?? "",
          name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            (user.email ? user.email.split("@")[0] : "Trader"),
          avatarUrl: user.user_metadata?.avatar_url ?? null,
          provider: user.app_metadata?.provider ?? null,
        }
      : null;

    return {
      session,
      user,
      profile,
      loading,
      isAuthenticated: Boolean(session),
      signInWithPassword: (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      signUp: (email, password, metadata) =>
        supabase.auth.signUp({
          email,
          password,
          options: { data: metadata },
        }),
      signInWithGoogle: () =>
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        }),
      signOut: () => supabase.auth.signOut(),
    };
  }, [session, loading]);

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
