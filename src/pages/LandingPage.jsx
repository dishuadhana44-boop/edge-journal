import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  LineChart,
  LockKeyhole,
  NotebookPen,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  Activity,
  Bot,
  Crosshair,
  Wallet,
  Clock3,
  Layers3,
  CircleDollarSign,
} from "lucide-react";

import logo from "../assets/logo.png";

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 50,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: "easeOut",
    },
  },
};

const fadeLeft = {
  hidden: {
    opacity: 0,
    x: -60,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.7,
      ease: "easeOut",
    },
  },
};

const fadeRight = {
  hidden: {
    opacity: 0,
    x: 60,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.7,
      ease: "easeOut",
    },
  },
};

const floatAnimation = {
  y: [0, -12, 0],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

function openLogin() {
  window.location.href = "/login";
}

/* =========================================================
   FLOATING BACKGROUND
========================================================= */

function FloatingParticles() {
  const particles = [
    { left: "8%", top: "22%", size: 5, delay: 0 },
    { left: "17%", top: "65%", size: 4, delay: 0.7 },
    { left: "30%", top: "18%", size: 3, delay: 1.2 },
    { left: "72%", top: "24%", size: 4, delay: 0.4 },
    { left: "84%", top: "54%", size: 5, delay: 1 },
    { left: "92%", top: "28%", size: 3, delay: 1.5 },
    { left: "65%", top: "78%", size: 4, delay: 0.8 },
    { left: "35%", top: "82%", size: 3, delay: 1.8 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full bg-violet-400/40 blur-[1px]"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: 3 + index * 0.3,
            repeat: Infinity,
            delay: particle.delay,
          }}
        />
      ))}
    </div>
  );
}

/* =========================================================
   FEATURE CARD
========================================================= */

function FeatureCard({
  icon: Icon,
  title,
  description,
  number,
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{
        y: -10,
        scale: 1.02,
      }}
      transition={{ duration: 0.25 }}
      className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
    >
      <motion.div
        className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-violet-200/50 blur-3xl"
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 via-transparent to-violet-50/50 opacity-0 transition duration-500 group-hover:opacity-100" />

      <div className="relative">
        <div className="mb-6 flex items-center justify-between">
          <motion.div
            whileHover={{
              rotate: 8,
              scale: 1.08,
            }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"
          >
            <Icon size={23} />
          </motion.div>

          <span className="text-sm font-semibold text-slate-300">
            {number}
          </span>
        </div>

        <h3 className="mb-3 text-xl font-bold text-slate-950">
          {title}
        </h3>

        <p className="text-sm leading-6 text-slate-500">
          {description}
        </p>

        <div className="mt-6 h-px w-0 bg-violet-500 transition-all duration-500 group-hover:w-full" />
      </div>
    </motion.div>
  );
}

/* =========================================================
   MARKET TICKER
========================================================= */

function MarketTicker() {
  const markets = [
    ["EURUSD", "1.15775", "+0.42%"],
    ["GBPUSD", "1.34530", "+0.28%"],
    ["USDJPY", "147.265", "-0.17%"],
    ["XAUUSD", "3342.80", "+0.91%"],
    ["NAS100", "23842.20", "+0.64%"],
  ];

  return (
    <div className="overflow-hidden border-y border-slate-200 bg-white/80 backdrop-blur-xl">
      <motion.div
        animate={{
          x: ["0%", "-50%"],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        className="flex min-w-max"
      >
        {[...markets, ...markets].map(
          ([symbol, price, change], index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-r border-slate-200 px-8 py-4"
            >
              <span className="text-xs font-bold text-slate-800">
                {symbol}
              </span>

              <span className="font-mono text-xs text-slate-500">
                {price}
              </span>

              <span
                className={`text-xs font-bold ${
                  change.startsWith("+")
                    ? "text-emerald-500"
                    : "text-rose-500"
                }`}
              >
                {change}
              </span>
            </div>
          )
        )}
      </motion.div>
    </div>
  );
}

/* =========================================================
   ADVANCED DASHBOARD PREVIEW
========================================================= */

function DashboardPreview() {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 80,
        scale: 0.94,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      viewport={{
        once: true,
        amount: 0.15,
      }}
      transition={{
        duration: 1,
      }}
      className="relative mx-auto mt-16 max-w-6xl"
    >
      <motion.div
        className="absolute inset-0 -z-10 rounded-[50px] bg-violet-500/20 blur-[100px]"
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.3, 0.55, 0.3],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
        }}
      />

      <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
        {/* Browser header */}
        <div className="flex h-12 items-center gap-2 border-b border-slate-200 bg-slate-50 px-5">
          <div className="h-3 w-3 rounded-full bg-rose-300" />
          <div className="h-3 w-3 rounded-full bg-amber-300" />
          <div className="h-3 w-3 rounded-full bg-emerald-300" />

          <div className="ml-5 flex h-7 flex-1 items-center rounded-lg bg-white px-4 shadow-sm">
            <span className="text-[10px] text-slate-400">
              app.edgefinder.local/dashboard
            </span>
          </div>
        </div>

        <div className="grid min-h-[470px] grid-cols-[82px_1fr] bg-[#f8fafc]">
          {/* Preview sidebar */}
          <div className="border-r border-slate-200 bg-white p-3">
            <div className="mb-8 flex justify-center">
              <img
                src={logo}
                alt="EdgeFinder"
                className="h-10 w-10 object-contain"
              />
            </div>

            <div className="space-y-4">
              {[
                BarChart3,
                TrendingUp,
                NotebookPen,
                LineChart,
                Brain,
                Target,
              ].map((Icon, index) => (
                <motion.div
                  key={index}
                  animate={
                    index === 0
                      ? {
                          boxShadow: [
                            "0 0 0 rgba(124,58,237,0)",
                            "0 0 22px rgba(124,58,237,0.35)",
                            "0 0 0 rgba(124,58,237,0)",
                          ],
                        }
                      : {}
                  }
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                  }}
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl ${
                    index === 0
                      ? "bg-violet-600 text-white"
                      : "text-slate-400"
                  }`}
                >
                  <Icon size={18} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Main dashboard */}
          <div className="p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="mb-2 text-xl font-black text-slate-900">
                  Good morning, Trader
                </div>

                <div className="text-xs text-slate-400">
                  Here's your trading performance today.
                </div>
              </div>

              <motion.div
                animate={floatAnimation}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white"
              >
                +12.84% this month
              </motion.div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                ["Balance", "$100,000"],
                ["Net P&L", "+$4,820"],
                ["Win Rate", "68.4%"],
                ["Profit Factor", "1.92"],
              ].map(([label, value], index) => (
                <motion.div
                  key={label}
                  animate={{
                    y: [0, -4, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: index * 0.15,
                  }}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="mb-2 text-[10px] font-medium text-slate-400">
                    {label}
                  </div>

                  <div className="text-lg font-black text-slate-900">
                    {value}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-4">
              {/* Equity chart */}
              <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Equity Curve
                    </div>

                    <div className="mt-1 text-[10px] text-slate-400">
                      Last 30 trading sessions
                    </div>
                  </div>

                  <div className="rounded-lg bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-600">
                    +8.42%
                  </div>
                </div>

                <div className="relative h-44 overflow-hidden">
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="h-px w-full bg-slate-100"
                      />
                    ))}
                  </div>

                  <motion.svg
                    viewBox="0 0 600 200"
                    className="relative h-full w-full"
                  >
                    <motion.path
                      d="M0 170 C60 160 80 145 130 150 C190 155 210 105 270 120 C330 135 360 82 420 95 C480 108 520 58 600 30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-violet-600"
                      initial={{
                        pathLength: 0,
                      }}
                      whileInView={{
                        pathLength: 1,
                      }}
                      viewport={{
                        once: true,
                      }}
                      transition={{
                        duration: 2.5,
                        ease: "easeInOut",
                      }}
                    />

                    <motion.path
                      d="M0 170 C60 160 80 145 130 150 C190 155 210 105 270 120 C330 135 360 82 420 95 C480 108 520 58 600 30 L600 200 L0 200 Z"
                      fill="url(#equityGradient)"
                      opacity="0.15"
                    />

                    <defs>
                      <linearGradient
                        id="equityGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#7c3aed"
                        />
                        <stop
                          offset="100%"
                          stopColor="#7c3aed"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                  </motion.svg>
                </div>
              </div>

              {/* Performance score */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-bold text-slate-900">
                  Performance
                </div>

                <div className="mt-8 flex justify-center">
                  <motion.div
                    animate={{
                      rotate: 360,
                    }}
                    transition={{
                      duration: 12,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="relative flex h-32 w-32 items-center justify-center rounded-full border-[14px] border-violet-100"
                  >
                    <div className="absolute inset-[-14px] rounded-full border-[14px] border-transparent border-t-violet-600 border-r-violet-600" />

                    <motion.div
                      animate={{
                        scale: [1, 1.08, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                      }}
                      className="flex h-full w-full items-center justify-center"
                    >
                      <span className="text-2xl font-black text-slate-900">
                        85
                      </span>
                    </motion.div>
                  </motion.div>
                </div>

                <div className="mt-6 text-center text-[10px] text-slate-400">
                  Trading Performance Score
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* =========================================================
   PRODUCT DEMO / VIDEO STYLE VISUAL
========================================================= */

function ProductDemo() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="relative mt-20 overflow-hidden rounded-[32px] border border-white/10 bg-black/40 shadow-2xl"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.22),transparent_55%)]" />

      <div className="relative">
        {/* Video header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400">
              <Play size={16} fill="currentColor" />
            </div>

            <div>
              <div className="text-sm font-bold text-white">
                Trading Workspace
              </div>

              <div className="text-[10px] text-slate-500">
                Live product preview
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">
            <motion.span
              animate={{
                opacity: [1, 0.3, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
              }}
              className="h-2 w-2 rounded-full bg-emerald-400"
            />

            <span className="text-[10px] font-bold text-emerald-400">
              LIVE
            </span>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
          {/* Chart */}
          <div className="relative min-h-[420px] overflow-hidden border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-lg font-black text-white">
                  EURUSD
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-400">
                    1.15775
                  </span>

                  <span className="text-xs font-bold text-emerald-400">
                    +0.42%
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                15m
              </div>
            </div>

            {/* Candles */}
            <div className="relative h-[300px]">
              <div className="absolute inset-0 flex flex-col justify-between">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div
                    key={item}
                    className="h-px bg-white/5"
                  />
                ))}
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.svg
                  viewBox="0 0 800 300"
                  className="h-full w-full"
                >
                  <motion.path
                    d="M0 235 C50 220 70 245 115 205 C155 170 190 205 225 180 C260 155 285 190 330 145 C370 105 405 155 450 120 C500 80 525 130 575 90 C620 55 650 95 690 55 C730 25 765 65 800 25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-violet-400"
                    initial={{
                      pathLength: 0,
                    }}
                    whileInView={{
                      pathLength: 1,
                    }}
                    viewport={{
                      once: true,
                    }}
                    transition={{
                      duration: 3,
                      ease: "easeInOut",
                    }}
                  />

                  <motion.circle
                    cx="800"
                    cy="25"
                    r="6"
                    fill="currentColor"
                    className="text-violet-400"
                    animate={{
                      r: [5, 9, 5],
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                  />
                </motion.svg>
              </div>

              {/* Moving price line */}
              <motion.div
                animate={{
                  y: [0, -160, -40, -180, -70, -150],
                }}
                transition={{
                  duration: 7,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute right-8 top-1/2 h-px w-20 border-t border-dashed border-violet-400"
              />
            </div>

            <div className="mt-5 flex items-center gap-6 text-[10px] text-slate-500">
              <span>O 1.15742</span>
              <span>H 1.15810</span>
              <span>L 1.15690</span>
              <span>C 1.15775</span>
            </div>
          </div>

          {/* Order panel */}
          <div className="bg-white/[0.03] p-6">
            <div className="mb-5 text-sm font-bold text-white">
              Quick Order
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  EURUSD
                </span>

                <span className="text-[10px] text-slate-500">
                  Market
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="rounded-xl bg-rose-500/10 p-3 text-center"
                >
                  <div className="text-[9px] text-rose-300">
                    SELL
                  </div>

                  <div className="mt-1 font-mono text-sm font-bold text-white">
                    1.15774
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="rounded-xl bg-emerald-500/10 p-3 text-center"
                >
                  <div className="text-[9px] text-emerald-300">
                    BUY
                  </div>

                  <div className="mt-1 font-mono text-sm font-bold text-white">
                    1.15775
                  </div>
                </motion.div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[9px] text-slate-500">
                  Position Size
                </div>

                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    0.50 lots
                  </span>

                  <span className="text-[10px] text-slate-500">
                    Risk 1%
                  </span>
                </div>
              </div>

              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 0 rgba(124,58,237,0)",
                    "0 0 25px rgba(124,58,237,0.3)",
                    "0 0 0 rgba(124,58,237,0)",
                  ],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                }}
                className="mt-4 rounded-xl bg-violet-600 px-4 py-3 text-center text-xs font-bold text-white"
              >
                Execute Trade
              </motion.div>
            </div>

            <div className="mt-5 space-y-2">
              {[
                ["Risk", "1.00%"],
                ["Stop Loss", "15 pips"],
                ["Take Profit", "30 pips"],
                ["R:R", "1 : 2"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2"
                >
                  <span className="text-[10px] text-slate-500">
                    {label}
                  </span>

                  <span className="text-[10px] font-bold text-slate-300">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* =========================================================
   INSIGHT CARDS
========================================================= */

function InsightVisuals() {
  const insights = [
    {
      icon: Bot,
      title: "AI Pattern Detection",
      text: "Your strongest setups are performing best during London session.",
      value: "87%",
    },
    {
      icon: Crosshair,
      title: "Execution Quality",
      text: "Your average entry precision improved this month.",
      value: "+14%",
    },
    {
      icon: Activity,
      title: "Risk Discipline",
      text: "You stayed inside your planned risk parameters.",
      value: "94%",
    },
  ];

  return (
    <div className="mt-16 grid gap-5 md:grid-cols-3">
      {insights.map((item, index) => {
        const Icon = item.icon;

        return (
          <motion.div
            key={item.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{
              delay: index * 0.12,
            }}
            whileHover={{
              y: -8,
            }}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                <Icon size={21} />
              </div>

              <span className="text-2xl font-black text-white">
                {item.value}
              </span>
            </div>

            <h3 className="mt-6 font-bold text-white">
              {item.title}
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {item.text}
            </p>

            <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{
                  width: item.value.replace("+", ""),
                }}
                viewport={{ once: true }}
                transition={{
                  duration: 1.2,
                }}
                className="h-full rounded-full bg-violet-500"
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* =========================================================
   LANDING PAGE
========================================================= */

export default function LandingPage() {
  const { scrollYProgress } = useScroll();

  const headerOpacity = useTransform(
    scrollYProgress,
    [0, 0.15],
    [1, 0.96]
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      {/* Scroll progress */}
      <motion.div
        style={{ scaleX: scrollYProgress }}
        className="fixed left-0 right-0 top-0 z-[100] h-[3px] origin-left bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500"
      />

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <motion.header
        style={{ opacity: headerOpacity }}
        className="fixed left-0 right-0 top-0 z-50"
      >
        <div className="mx-auto mt-4 flex max-w-7xl items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{
                rotate: [0, 3, 0, -3, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
              }}
              className="flex h-10 w-10 items-center justify-center"
            >
              <img
                src={logo}
                alt="EdgeFinder Logo"
                className="h-10 w-10 object-contain"
              />
            </motion.div>

            <div>
              <div className="text-sm font-black tracking-wide">
                EDGE
              </div>

              <div className="text-xs font-bold text-violet-600">
                FINDER
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-slate-600 transition hover:text-violet-600"
            >
              Features
            </a>

            <a
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 transition hover:text-violet-600"
            >
              How it works
            </a>

            <a
              href="#platform"
              className="text-sm font-medium text-slate-600 transition hover:text-violet-600"
            >
              Platform
            </a>

            <a
              href="#ai"
              className="text-sm font-medium text-slate-600 transition hover:text-violet-600"
            >
              AI
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={openLogin}
              className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:block"
            >
              Login
            </button>

            <motion.button
              whileHover={{
                scale: 1.03,
              }}
              whileTap={{
                scale: 0.97,
              }}
              onClick={openLogin}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"
            >
              Get Started
              <ArrowRight size={16} />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative flex min-h-screen items-center overflow-hidden px-6 pt-28">
        <FloatingParticles />

        <div className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-[550px] w-[550px] -translate-x-1/2 rounded-full bg-violet-200/40 blur-[130px]" />

        <div className="pointer-events-none absolute right-0 top-1/3 -z-10 h-[350px] w-[350px] rounded-full bg-purple-100 blur-[110px]" />

        <div className="mx-auto w-full max-w-6xl text-center">
          <motion.div
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.7,
            }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700"
          >
            <Sparkles size={16} />

            Your complete trading performance system
          </motion.div>

          <motion.h1
            initial={{
              opacity: 0,
              y: 35,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.8,
              delay: 0.1,
            }}
            className="mx-auto max-w-5xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
          >
            Welcome to your

            <span className="block bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 bg-clip-text text-transparent">
              Trading Journal.
            </span>
          </motion.h1>

          <motion.p
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.7,
              delay: 0.25,
            }}
            className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-500"
          >
            Track every trade, analyze your performance,
            understand your behavior, and discover the edge
            that makes you a better trader.
          </motion.p>

          <motion.div
            initial={{
              opacity: 0,
              y: 25,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.7,
              delay: 0.35,
            }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <motion.button
              whileHover={{
                scale: 1.04,
              }}
              whileTap={{
                scale: 0.97,
              }}
              onClick={openLogin}
              className="group flex items-center gap-3 rounded-2xl bg-violet-600 px-7 py-4 font-bold text-white shadow-xl shadow-violet-200 transition hover:bg-violet-700"
            >
              Start Trading Smarter

              <ArrowRight
                size={19}
                className="transition group-hover:translate-x-1"
              />
            </motion.button>

            <button
              onClick={() =>
                document
                  .getElementById("platform")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-4 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Play size={17} />
              Explore Platform
            </button>
          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            transition={{
              duration: 1,
              delay: 1,
            }}
            className="mt-12 flex justify-center"
          >
            <ChevronDown
              size={22}
              className="animate-bounce text-slate-400"
            />
          </motion.div>

          <DashboardPreview />
        </div>
      </section>

      {/* =====================================================
          MARKET TICKER
      ===================================================== */}

      <MarketTicker />

      {/* =====================================================
          TRUST
      ===================================================== */}

      <section className="border-b border-slate-100 bg-slate-50/70 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-12 gap-y-5 text-sm text-slate-400">
          {[
            [CheckCircle2, "Trade tracking"],
            [BarChart3, "Performance analytics"],
            [NotebookPen, "Trading journal"],
            [Brain, "AI insights"],
            [Wallet, "Broker integration"],
            [ShieldCheck, "Risk management"],
          ].map(([Icon, text]) => (
            <span
              key={text}
              className="flex items-center gap-2"
            >
              <Icon size={17} />
              {text}
            </span>
          ))}
        </div>
      </section>

      {/* =====================================================
          FEATURES
      ===================================================== */}

      <section
        id="features"
        className="px-6 py-28"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-violet-600">
              Everything in one place
            </span>

            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Stop guessing.
              <br />
              Start understanding your trading.
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-500">
              EdgeFinder connects execution, journaling,
              analytics, strategies, risk management and
              AI-powered insights into one workspace.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              number="01"
              icon={BarChart3}
              title="Trading Dashboard"
              description="Get a complete overview of your balance, P&L, win rate, expectancy, equity curve and trading performance."
            />

            <FeatureCard
              number="02"
              icon={NotebookPen}
              title="Trade Journal"
              description="Record your setup, reasoning, emotions, screenshots, mistakes and results for every trade."
            />

            <FeatureCard
              number="03"
              icon={LineChart}
              title="Performance Analytics"
              description="Analyze profitability, drawdown, RR, sessions, setups, risk and execution patterns."
            />

            <FeatureCard
              number="04"
              icon={BookOpen}
              title="Trading Notebook"
              description="Build a knowledge system for lessons, strategies, routines, ideas and market observations."
            />

            <FeatureCard
              number="05"
              icon={Target}
              title="Trading Plans"
              description="Define your setups, conditions, entries, invalidation rules and execution process."
            />

            <FeatureCard
              number="06"
              icon={Brain}
              title="AI Insights"
              description="Turn your trading data into useful insights about behavior, mistakes, patterns and improvement opportunities."
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          PLATFORM
      ===================================================== */}

      <section
        id="platform"
        className="overflow-hidden bg-slate-950 px-6 py-28 text-white"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div
            variants={fadeLeft}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-violet-400">
              Your entire trading workspace
            </span>

            <h2 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
              One platform.
              <br />
              Your entire trading journey.
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-400">
              From execution to review, everything you need
              to understand and improve your trading is connected.
            </p>
          </motion.div>

          <ProductDemo />

          <InsightVisuals />
        </div>
      </section>

      {/* =====================================================
          HOW IT WORKS
      ===================================================== */}

      <section
        id="how-it-works"
        className="px-6 py-28"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center"
          >
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-violet-600">
              Simple process
            </span>

            <h2 className="mt-4 text-4xl font-black md:text-5xl">
              From trade to insight.
            </h2>
          </motion.div>

          <div className="relative mt-20 grid gap-10 md:grid-cols-4">
            <div className="pointer-events-none absolute left-[12%] right-[12%] top-8 hidden h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent md:block" />

            {[
              {
                number: "01",
                icon: TrendingUp,
                title: "Trade",
                text: "Execute your setup and capture the important details.",
              },
              {
                number: "02",
                icon: NotebookPen,
                title: "Journal",
                text: "Record your reasoning, emotions, mistakes and results.",
              },
              {
                number: "03",
                icon: BarChart3,
                title: "Analyze",
                text: "Review performance across setups, sessions and time.",
              },
              {
                number: "04",
                icon: Brain,
                title: "Improve",
                text: "Turn your data into better decisions and stronger habits.",
              },
            ].map((step, index) => {
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.number}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  transition={{
                    delay: index * 0.12,
                  }}
                  className="relative text-center"
                >
                  <motion.div
                    whileHover={{
                      scale: 1.08,
                      rotate: 5,
                    }}
                    className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200"
                  >
                    <Icon size={25} />
                  </motion.div>

                  <div className="mt-5 text-xs font-bold tracking-widest text-violet-500">
                    {step.number}
                  </div>

                  <h3 className="mt-2 text-xl font-bold">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {step.text}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================
          ADVANCED FEATURES
      ===================================================== */}

      <section className="bg-slate-50 px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center"
          >
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-violet-600">
              Built for serious traders
            </span>

            <h2 className="mt-4 text-4xl font-black md:text-5xl">
              More than a journal.
            </h2>
          </motion.div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Wallet,
                title: "Broker Sync",
                text: "Connect trading accounts and sync positions, orders and trade history.",
              },
              {
                icon: CircleDollarSign,
                title: "Risk Engine",
                text: "Understand position sizing, risk, reward and exposure before execution.",
              },
              {
                icon: Clock3,
                title: "Session Analytics",
                text: "Discover when your trading performs best across market sessions.",
              },
              {
                icon: Layers3,
                title: "Trading System",
                text: "Connect your plans, setups, journal, analytics and reviews.",
              },
            ].map((item, index) => {
              const Icon = item.icon;

              return (
                <motion.div
                  key={item.title}
                  initial={{
                    opacity: 0,
                    y: 30,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{
                    once: true,
                  }}
                  transition={{
                    delay: index * 0.1,
                  }}
                  whileHover={{
                    y: -8,
                  }}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <Icon size={21} />
                  </div>

                  <h3 className="mt-5 font-bold">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {item.text}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================
          AI
      ===================================================== */}

      <section
        id="ai"
        className="relative overflow-hidden bg-white px-6 py-28"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-200/30 blur-[120px]" />

        <div className="relative mx-auto max-w-5xl text-center">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-xl shadow-violet-200">
              <Brain size={29} />
            </div>

            <span className="mt-6 block text-sm font-bold uppercase tracking-[0.2em] text-violet-600">
              Intelligence layer
            </span>

            <h2 className="mt-4 text-4xl font-black md:text-5xl">
              Your data should
              <span className="text-violet-600">
                {" "}teach you.
              </span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-500">
              EdgeFinder turns your trading history into patterns,
              observations and actionable insights so every trade
              can make the next one better.
            </p>
          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
              scale: 0.94,
            }}
            whileInView={{
              opacity: 1,
              scale: 1,
            }}
            viewport={{
              once: true,
            }}
            transition={{
              duration: 0.8,
            }}
            className="mx-auto mt-14 max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-2xl shadow-slate-200/60"
          >
            <div className="rounded-2xl bg-slate-950 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400">
                  <Sparkles size={19} />
                </div>

                <div>
                  <div className="text-sm font-bold text-white">
                    EdgeFinder AI
                  </div>

                  <div className="text-[10px] text-slate-500">
                    Trading performance analysis
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs font-bold text-violet-400">
                  Performance observation
                </div>

                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Your best-performing trades currently share
                  three characteristics: London session,
                  trend continuation setups and risk below 1%.
                  Trades outside these conditions show a lower
                  historical expectancy.
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ["Best Session", "London"],
                  ["Best Setup", "Continuation"],
                  ["Ideal Risk", "< 1%"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="text-[10px] text-slate-500">
                      {label}
                    </div>

                    <div className="mt-1 text-sm font-bold text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================
          SECURITY
      ===================================================== */}

      <section className="px-6 pb-28">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mx-auto max-w-5xl rounded-[32px] border border-violet-100 bg-violet-50 p-10 text-center md:p-14"
        >
          <motion.div
            animate={{
              y: [0, -6, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm"
          >
            <ShieldCheck size={26} />
          </motion.div>

          <h2 className="mt-6 text-3xl font-black">
            Your trading data. Your workspace.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-500">
            Built around a secure and organized trading workflow
            so you can focus on your decisions instead of managing
            scattered information.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600">
              <LockKeyhole
                className="mr-2 inline"
                size={15}
              />
              Secure workspace
            </span>

            <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600">
              <CheckCircle2
                className="mr-2 inline"
                size={15}
              />
              Organized data
            </span>
          </div>
        </motion.div>
      </section>

      {/* =====================================================
          FINAL CTA
      ===================================================== */}

      <section className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700 px-6 py-28 text-white">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-[100px]"
        />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative mx-auto max-w-3xl text-center"
        >
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
            }}
          >
            <Sparkles
              className="mx-auto mb-6"
              size={30}
            />
          </motion.div>

          <h2 className="text-4xl font-black tracking-tight md:text-6xl">
            Ready to find your edge?
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-violet-100">
            Stop trading without understanding your process.
            Start building a system around your edge.
          </p>

          <motion.button
            whileHover={{
              scale: 1.05,
            }}
            whileTap={{
              scale: 0.97,
            }}
            onClick={openLogin}
            className="mt-9 inline-flex items-center gap-3 rounded-2xl bg-white px-7 py-4 font-bold text-violet-700 shadow-2xl"
          >
            Get Started
            <ArrowRight size={19} />
          </motion.button>
        </motion.div>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center">
              <img
                src={logo}
                alt="EdgeFinder Logo"
                className="h-10 w-10 object-contain"
              />
            </div>

            <div>
              <div className="text-sm font-black">
                EDGE FINDER
              </div>

              <div className="text-xs text-slate-500">
                Your trading edge, measured.
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Edge Finder.
            All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}