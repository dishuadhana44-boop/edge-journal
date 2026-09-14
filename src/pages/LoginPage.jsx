import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
} from "lucide-react";

import logo from "../assets/logo.png";

function LoginPage() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    // Frontend prototype login
    if (!email || !password) {
      return;
    }

    if (rememberMe) {
      localStorage.setItem("edgeflo_remember_email", email);
    }

    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-black text-white flex">

      {/* LEFT SIDE */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center border-r border-white/10">

        {/* Background glow */}
        <div className="absolute w-[500px] h-[500px] bg-purple-600/20 blur-[150px] rounded-full" />
        <div className="absolute w-[350px] h-[350px] bg-blue-600/15 blur-[130px] rounded-full -bottom-20 -right-20" />

        <div className="relative z-10 max-w-xl px-12">

          {/* Logo */}
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
              Track your trades, analyze your performance,
              build your edge and become a more disciplined trader.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 mt-12">

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <BarChart3 className="w-6 h-6 text-purple-400 mb-3" />
              <p className="font-semibold text-sm">
                Trade Analytics
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Understand your performance.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <Zap className="w-6 h-6 text-blue-400 mb-3" />
              <p className="font-semibold text-sm">
                Live Trading
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Execute with confidence.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <ShieldCheck className="w-6 h-6 text-green-400 mb-3" />
              <p className="font-semibold text-sm">
                Guardrails
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Protect your trading process.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">

        <div className="w-full max-w-md">

          {/* Mobile Logo */}
          <div className="flex justify-center lg:hidden mb-8">
            <img
              src={logo}
              alt="EdgeFlo"
              className="w-28 h-28 object-contain"
            />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <p className="text-sm text-purple-400 font-medium mb-2">
              WELCOME BACK
            </p>

            <h2 className="text-3xl font-bold">
              Sign in to EdgeFlo
            </h2>

            <p className="text-gray-500 mt-2">
              Continue your trading journey.
            </p>
          </div>

          {/* Login Card */}
          <div className="rounded-3xl border border-white/10 bg-[#0b0b0b] p-7 shadow-2xl">

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="
                    w-full
                    h-12
                    px-4
                    rounded-xl
                    bg-black
                    border border-white/10
                    text-white
                    placeholder:text-gray-600
                    outline-none
                    transition
                    focus:border-purple-500
                    focus:ring-2
                    focus:ring-purple-500/20
                  "
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="
                      w-full
                      h-12
                      px-4
                      pr-12
                      rounded-xl
                      bg-black
                      border border-white/10
                      text-white
                      placeholder:text-gray-600
                      outline-none
                      transition
                      focus:border-purple-500
                      focus:ring-2
                      focus:ring-purple-500/20
                    "
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-gray-500
                      hover:text-white
                      transition
                    "
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-purple-600"
                  />

                  <span className="text-sm text-gray-400">
                    Remember me
                  </span>
                </label>

                <button
                  type="button"
                  className="text-sm text-purple-400 hover:text-purple-300 transition"
                >
                  Forgot password?
                </button>

              </div>

              {/* Login Button */}
              <button
                type="submit"
                className="
                  w-full
                  h-12
                  rounded-xl
                  bg-gradient-to-r
                  from-purple-600
                  to-blue-600
                  hover:from-purple-500
                  hover:to-blue-500
                  font-semibold
                  flex
                  items-center
                  justify-center
                  gap-2
                  transition
                  shadow-lg
                  shadow-purple-900/20
                "
              >
                Sign In
                <ArrowRight size={18} />
              </button>

            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-7">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-gray-600">
                SECURE ACCESS
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Security */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <ShieldCheck size={15} />
              <span>Your trading workspace is protected</span>
            </div>

          </div>

          {/* Back */}
          <div className="text-center mt-7">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-white transition"
            >
              ← Back to EdgeFlo
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

export default LoginPage;