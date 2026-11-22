
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Lock,
  UserPlus,
} from "lucide-react";
import logo from "../assets/logo.png";
import GoogleLoginButton from "../components/GoogleLoginButton";

function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  const passwordStrong =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);

  const validateEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const getAuthRedirectUrl = () =>
    import.meta.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
    `${window.location.origin}/auth/callback`;

  const getAuthErrorMessage = (authError, action) => {
    const code = authError?.code;
    const message = authError?.message?.toLowerCase() || "";

    if (code === "invalid_credentials" || code === "user_not_found") {
      return "Invalid email or password.";
    }

    if (code === "email_not_confirmed") {
      return "Confirm your email using the link we sent before signing in.";
    }

    if (code === "weak_password") {
      return "Choose a stronger password and try again.";
    }

    if (code === "over_email_send_rate_limit" || code === "rate_limit_exceeded") {
      return "Too many attempts. Wait a little while and try again.";
    }

    if (message.includes("provider is not enabled") || code === "provider_disabled") {
      return "Google sign-in is not enabled for this project yet.";
    }

    return action === "signup"
      ? "We couldn't create your account. Check your details and try again."
      : "We couldn't sign you in. Please try again.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!validateEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isLogin) {
      if (!name.trim()) {
        setError("Please enter your full name.");
        return;
      }

      if (password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }

      if (!passwordStrong) {
        setError("Password must include uppercase, lowercase, and a number.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        setSuccess("Signed in successfully. Redirecting...");
        navigate("/dashboard", { replace: true });
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
            data: { full_name: name.trim() },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        setPassword("");
        setConfirmPassword("");

        if (data.session) {
          setSuccess("Account created. Redirecting...");
          navigate("/dashboard", { replace: true });
        } else {
          setSuccess("Check your email for a confirmation link to finish creating your account.");
        }
      }
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, isLogin ? "login" : "signup"));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const cleanEmail = email.trim().toLowerCase();
    setError("");
    setSuccess("");

    if (!validateEmail(cleanEmail)) {
      setError("Enter your email address first, then request a password reset.");
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo: getAuthRedirectUrl() }
      );

      if (resetError) {
        throw resetError;
      }

      setSuccess("If an account exists for that address, a password reset link is on its way.");
    } catch {
      setError("We couldn't send a password reset email. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleGoogleError = (message) => {
    setError(message);
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* LEFT SIDE */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center border-r border-white/10">
        <div className="absolute w-[500px] h-[500px] bg-purple-600/20 blur-[150px] rounded-full" />
        <div className="absolute w-[350px] h-[350px] bg-blue-600/15 blur-[130px] rounded-full -bottom-20 -right-20" />

        <div className="relative z-10 max-w-xl px-12">
          <div className="flex justify-center mb-10">
            <img
              src={logo}
              alt="EdgeFlo"
              className="w-44 h-44 object-contain"
            />
          </div>

          <div className="text-center">
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight">
              Trade With Your Edge.
            </h1>

            <p className="mt-5 text-gray-400 text-lg leading-relaxed">
              Track your trades, analyze your performance, build your edge,
              and become a more disciplined trader.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-12">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <BarChart3 className="w-6 h-6 text-purple-400 mb-3" />
              <p className="font-semibold text-sm">Trade Analytics</p>
              <p className="text-xs text-gray-500 mt-1">
                Understand your performance.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <Zap className="w-6 h-6 text-blue-400 mb-3" />
              <p className="font-semibold text-sm">Live Trading</p>
              <p className="text-xs text-gray-500 mt-1">
                Execute with confidence.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <ShieldCheck className="w-6 h-6 text-green-400 mb-3" />
              <p className="font-semibold text-sm">Guardrails</p>
              <p className="text-xs text-gray-500 mt-1">
                Protect your process.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center lg:hidden mb-8">
            <img
              src={logo}
              alt="EdgeFlo"
              className="w-28 h-28 object-contain"
            />
          </div>

          <div className="mb-8">
            <p className="text-sm text-purple-400 font-medium mb-2">
              {isLogin ? "WELCOME BACK" : "GET STARTED"}
            </p>

            <h2 className="text-3xl font-bold">
              {isLogin ? "Sign in to EdgeFlo" : "Create your EdgeFlo account"}
            </h2>

            <p className="text-gray-500 mt-2">
              {isLogin
                ? "Continue your trading journey."
                : "Build your trading edge with us."}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b0b0b] p-7 shadow-2xl">
            {/* TABS */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/[0.04] p-1 mb-7">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                  isLogin
                    ? "bg-purple-600 text-white"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                  !isLogin
                    ? "bg-purple-600 text-white"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* NAME */}
              {!isLogin && (
                <div>
                  <label htmlFor="full-name" className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name
                  </label>

                  <input
                    id="full-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                    className="w-full h-12 px-4 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              )}

              {/* EMAIL */}
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>

                <input
                  id="email-address"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full h-12 px-4 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    className="w-full h-12 px-4 pr-12 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>

                {!isLogin && password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          passwordStrong
                            ? "w-full bg-emerald-500"
                            : password.length >= 8
                              ? "w-2/3 bg-yellow-500"
                              : "w-1/3 bg-red-500"
                        }`}
                      />
                    </div>

                    <p className="text-[11px] text-gray-500">
                      Use 8+ characters, uppercase, lowercase, and a number.
                    </p>
                  </div>
                )}
              </div>

              {/* CONFIRM PASSWORD */}
              {!isLogin && (
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm Password
                  </label>

                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      className="w-full h-12 px-4 pr-12 rounded-xl bg-black border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((value) => !value)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* LOGIN OPTIONS */}
              {isLogin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading}
                    className="text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* ERROR */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-400">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* SUCCESS */}
              {success && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-400">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-purple-900/20"
              >
                {loading ? (
                  "Please wait..."
                ) : (
                  <>
                    {isLogin ? "Sign In" : "Create Account"}
                    {isLogin ? (
                      <ArrowRight size={18} />
                    ) : (
                      <UserPlus size={18} />
                    )}
                  </>
                )}
              </button>
            </form>

            {/* OR DIVIDER */}
            <div className="flex items-center gap-4 my-6">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-gray-600">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* GOOGLE SIGN-IN */}
            <GoogleLoginButton onError={handleGoogleError} />

            <div className="flex items-center gap-4 my-7">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-gray-600">SECURE ACCESS</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Lock size={14} />
              <span>Your trading workspace is protected</span>
            </div>
          </div>

          <div className="text-center mt-7">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-white transition"
            >
              ← Back to EdgeFinder
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
