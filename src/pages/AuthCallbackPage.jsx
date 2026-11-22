import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const startedRef = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const completeSignIn = async () => {
      const params = new URLSearchParams(window.location.search);
      const callbackError = params.get("error_description") || params.get("error");

      if (callbackError) {
        setError("Google sign-in could not be completed. Please try again.");
        return;
      }

      const code = params.get("code");

      if (!code) {
        setError("The sign-in link is missing its verification code. Please try again.");
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError("Google sign-in could not be completed. Please try again.");
        return;
      }

      const next = params.get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//")
        ? next
        : params.get("type") === "recovery"
          ? "/reset-password"
          : "/dashboard";

      navigate(destination, { replace: true });
    };

    completeSignIn().catch(() => {
      setError("Google sign-in could not be completed. Please try again.");
    });
  }, [navigate]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0b] p-8 text-center shadow-2xl">
        {error ? (
          <>
            <h1 className="text-2xl font-bold">Sign-in needs another try</h1>
            <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="mt-6 rounded-xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500"
            >
              Return to sign in
            </button>
          </>
        ) : (
          <p role="status" className="text-gray-300">Completing secure sign-in…</p>
        )}
      </div>
    </main>
  );
}

export default AuthCallbackPage;
