import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Use at least 8 characters, including uppercase, lowercase, and a number.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      navigate("/dashboard", { replace: true });
    } catch {
      setError("This password reset link is invalid or expired. Request a new one and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0b] p-8 shadow-2xl">
        <p className="text-sm font-medium text-purple-400">ACCOUNT SECURITY</p>
        <h1 className="mt-2 text-3xl font-bold">Set a new password</h1>
        <p className="mt-2 text-gray-400">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-gray-300">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <div>
            <label htmlFor="confirm-new-password" className="mb-2 block text-sm font-medium text-gray-300">Confirm new password</label>
            <input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default ResetPasswordPage;
