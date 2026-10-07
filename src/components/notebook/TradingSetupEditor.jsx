import { useMemo, useState } from "react";

import {
    ArrowLeft,
    BarChart3,
    BookOpen,
    Calculator,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock3,
    Crosshair,
    DollarSign,
    ImagePlus,
    Layers3,
    LineChart,
    Save,
    ShieldAlert,
    Target,
    TrendingDown,
    TrendingUp,
    Upload,
    X,
  } from "lucide-react";

export default function TradingSetupEditor({
  note,
  onBack,
  onSave,
}) {
  const [setup, setSetup] = useState(
    note?.setup || ""
  );

  const [symbol, setSymbol] = useState(
    note?.symbol || ""
  );

  const [market, setMarket] = useState(
    note?.market || "Forex"
  );

  const [timeframe, setTimeframe] =
    useState(
      note?.timeframe || "15m"
    );

  const [higherTimeframe, setHigherTimeframe] =
    useState(
      note?.higherTimeframe || "4H"
    );

  const [bias, setBias] = useState(
    note?.bias || "Bullish"
  );

  const [session, setSession] = useState(
    note?.session || "London"
  );

  const [entryModel, setEntryModel] =
    useState(
      note?.entryModel || ""
    );

  const [entry, setEntry] = useState(
    note?.entry || ""
  );

  const [stopLoss, setStopLoss] =
    useState(note?.stopLoss || "");

  const [takeProfit, setTakeProfit] =
    useState(note?.takeProfit || "");

  const [risk, setRisk] = useState(
    note?.risk || ""
  );

  const [positionSize, setPositionSize] =
    useState(
      note?.positionSize || ""
    );

  const [liquidity, setLiquidity] =
    useState(
      note?.liquidity || ""
    );

  const [marketStructure, setMarketStructure] =
    useState(
      note?.marketStructure || ""
    );

  const [bosChoch, setBosChoch] =
    useState(
      note?.bosChoch || ""
    );

  const [fvg, setFvg] = useState(
    note?.fvg || ""
  );

  const [orderBlock, setOrderBlock] =
    useState(
      note?.orderBlock || ""
    );

  const [supportResistance, setSupportResistance] =
    useState(
      note?.supportResistance || ""
    );

  const [confluences, setConfluences] =
    useState(
      note?.confluences || ""
    );

  const [invalidation, setInvalidation] =
    useState(
      note?.invalidation || ""
    );

  const [tradeManagement, setTradeManagement] =
    useState(
      note?.tradeManagement || ""
    );

  const [setupReasoning, setSetupReasoning] =
    useState(
      note?.content || ""
    );

  const [mistakes, setMistakes] =
    useState(
      note?.mistakes || ""
    );

  const [lessons, setLessons] =
    useState(
      note?.lessons || ""
    );

  const [checklist, setChecklist] =
    useState(
      note?.checklist || {
        higherTimeframeBias: false,
        marketStructure: false,
        liquidity: false,
        bosChoch: false,
        fvg: false,
        orderBlock: false,
        entryConfirmation: false,
        riskDefined: false,
        invalidationDefined: false,
        rrAcceptable: false,
      }
    );

  const [expandedSections, setExpandedSections] =
    useState({
      market: true,
      structure: true,
      levels: true,
      risk: true,
      reasoning: true,
      checklist: true,
      review: false,
    });

  const [screenshots, setScreenshots] =
    useState(
      Array.isArray(note?.screenshots)
        ? note.screenshots
        : []
    );

  const toggleSection = (section) => {
    setExpandedSections(
      (current) => ({
        ...current,
        [section]:
          !current[section],
      })
    );
  };

  const updateChecklist = (
    field,
    value
  ) => {
    setChecklist(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  };

  const rewardRisk = useMemo(() => {
    const entryPrice = Number(entry);
    const slPrice = Number(stopLoss);
    const tpPrice = Number(takeProfit);

    if (
      !Number.isFinite(entryPrice) ||
      !Number.isFinite(slPrice) ||
      !Number.isFinite(tpPrice) ||
      entryPrice <= 0
    ) {
      return null;
    }

    const riskAmount = Math.abs(
      entryPrice - slPrice
    );

    const rewardAmount = Math.abs(
      tpPrice - entryPrice
    );

    if (riskAmount <= 0) {
      return null;
    }

    return (
      rewardAmount / riskAmount
    ).toFixed(2);
  }, [
    entry,
    stopLoss,
    takeProfit,
  ]);

  const riskDistance = useMemo(() => {
    const entryPrice = Number(entry);
    const slPrice = Number(stopLoss);

    if (
      !Number.isFinite(entryPrice) ||
      !Number.isFinite(slPrice)
    ) {
      return null;
    }

    return Math.abs(
      entryPrice - slPrice
    ).toFixed(5);
  }, [entry, stopLoss]);

  const rewardDistance = useMemo(() => {
    const entryPrice = Number(entry);
    const tpPrice = Number(takeProfit);

    if (
      !Number.isFinite(entryPrice) ||
      !Number.isFinite(tpPrice)
    ) {
      return null;
    }

    return Math.abs(
      tpPrice - entryPrice
    ).toFixed(5);
  }, [entry, takeProfit]);

  const checklistProgress = useMemo(() => {
    const values =
      Object.values(checklist);

    if (!values.length) {
      return 0;
    }

    const completed =
      values.filter(Boolean).length;

    return Math.round(
      (completed / values.length) *
        100
    );
  }, [checklist]);

  const handleScreenshotUpload = (
    event
  ) => {
    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) {
      return;
    }

    files.forEach((file) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        setScreenshots(
          (current) => [
            ...current,
            {
              id: `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 7)}`,
              name: file.name,
              data: reader.result,
            },
          ]
        );
      };

      reader.readAsDataURL(file);
    });

    event.target.value = "";
  };

  const removeScreenshot = (
    screenshotId
  ) => {
    setScreenshots(
      (current) =>
        current.filter(
          (item) =>
            item.id !== screenshotId
        )
    );
  };

  const handleSave = () => {
    onSave?.({
      setup,
      symbol,
      market,
      timeframe,
      higherTimeframe,
      bias,
      session,
      entryModel,
      entry,
      stopLoss,
      takeProfit,
      risk,
      positionSize,
      rewardRisk,
      riskDistance,
      rewardDistance,
      liquidity,
      marketStructure,
      bosChoch,
      fvg,
      orderBlock,
      supportResistance,
      confluences,
      invalidation,
      tradeManagement,
      content: setupReasoning,
      mistakes,
      lessons,
      checklist,
      checklistProgress,
      screenshots,
    });
  };

  const SectionHeader = ({
    id,
    icon,
    title,
    description,
  }) => {
    const Icon = icon;

    return (
      <button
        type="button"
        onClick={() =>
          toggleSection(id)
        }
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Icon size={19} />
          </div>

          <div>
            <h3 className="font-bold text-gray-900">
              {title}
            </h3>

            <p className="mt-0.5 text-xs text-gray-500">
              {description}
            </p>
          </div>
        </div>

        {expandedSections[id] ? (
          <ChevronUp
            size={19}
            className="text-gray-400"
          />
        ) : (
          <ChevronDown
            size={19}
            className="text-gray-400"
          />
        )}
      </button>
    );
  };

  const Field = ({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
  }) => (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
      />
    </div>
  );

  const TextArea = ({
    label,
    value,
    onChange,
    placeholder,
    rows = 5,
  }) => (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-7 text-gray-800 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
      />
    </div>
  );

  return (
    <div className="min-h-full bg-gray-50">
      {/* HEADER */}

      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <LineChart
                  size={20}
                  className="shrink-0 text-purple-600"
                />

                <h2 className="truncate text-xl font-bold text-gray-900">
                  Trading Setup
                </h2>
              </div>

              <p className="mt-1 text-xs text-gray-500">
                Advanced setup planning &
                trade execution framework
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
          >
            <Save size={17} />
            Save Setup
          </button>
        </div>
      </div>

      {/* CONTENT */}

      <div className="mx-auto max-w-6xl space-y-5 p-6">
        {/* BASIC SETUP */}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="p-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Field
                  label="Setup Name"
                  value={setup}
                  onChange={setSetup}
                  placeholder="e.g. London Liquidity Sweep"
                />
              </div>

              <Field
                label="Symbol"
                value={symbol}
                onChange={(value) =>
                  setSymbol(
                    value.toUpperCase()
                  )
                }
                placeholder="EURUSD"
              />

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Market
                </label>

                <select
                  value={market}
                  onChange={(event) =>
                    setMarket(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                >
                  <option>Forex</option>
                  <option>Crypto</option>
                  <option>Indices</option>
                  <option>Stocks</option>
                  <option>Commodities</option>
                  <option>Futures</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* MARKET CONTEXT */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <SectionHeader
            id="market"
            icon={BarChart3}
            title="Market Context"
            description="Define the environment before looking for an entry."
          />

          {expandedSections.market && (
            <div className="border-t border-gray-100 p-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Higher Timeframe
                  </label>

                  <select
                    value={
                      higherTimeframe
                    }
                    onChange={(event) =>
                      setHigherTimeframe(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                  >
                    <option>1D</option>
                    <option>4H</option>
                    <option>1H</option>
                    <option>30m</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Entry Timeframe
                  </label>

                  <select
                    value={timeframe}
                    onChange={(event) =>
                      setTimeframe(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                  >
                    <option>1m</option>
                    <option>5m</option>
                    <option>15m</option>
                    <option>30m</option>
                    <option>1H</option>
                    <option>4H</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Session
                  </label>

                  <select
                    value={session}
                    onChange={(event) =>
                      setSession(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                  >
                    <option>Asian</option>
                    <option>London</option>
                    <option>New York</option>
                    <option>London / NY</option>
                    <option>Any Session</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Bias
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setBias(
                          "Bullish"
                        )
                      }
                      className={`rounded-xl border px-2 py-3 text-xs font-bold transition ${
                        bias === "Bullish"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      Bullish
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setBias(
                          "Bearish"
                        )
                      }
                      className={`rounded-xl border px-2 py-3 text-xs font-bold transition ${
                        bias === "Bearish"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      Bearish
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setBias(
                          "Neutral"
                        )
                      }
                      className={`rounded-xl border px-2 py-3 text-xs font-bold transition ${
                        bias === "Neutral"
                          ? "border-gray-500 bg-gray-50 text-gray-700"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      Neutral
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MARKET STRUCTURE */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <SectionHeader
            id="structure"
            icon={Layers3}
            title="Market Structure & Confluences"
            description="Document the technical reasons behind the setup."
          />

          {expandedSections.structure && (
            <div className="space-y-5 border-t border-gray-100 p-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextArea
                  label="Market Structure"
                  value={marketStructure}
                  onChange={
                    setMarketStructure
                  }
                  placeholder="HH/HL, LH/LL, range, accumulation, distribution, trend, expansion..."
                />

                <TextArea
                  label="Liquidity"
                  value={liquidity}
                  onChange={setLiquidity}
                  placeholder="Buy-side liquidity, sell-side liquidity, equal highs/lows, previous day high/low..."
                />

                <TextArea
                  label="BOS / CHOCH / MSS"
                  value={bosChoch}
                  onChange={setBosChoch}
                  placeholder="Describe the structure break or market shift..."
                />

                <TextArea
                  label="Fair Value Gap"
                  value={fvg}
                  onChange={setFvg}
                  placeholder="Bullish FVG / Bearish FVG, timeframe, price zone..."
                />

                <TextArea
                  label="Order Block"
                  value={orderBlock}
                  onChange={setOrderBlock}
                  placeholder="Bullish OB / Bearish OB, timeframe, price zone, confirmation..."
                />

                <TextArea
                  label="Support / Resistance"
                  value={
                    supportResistance
                  }
                  onChange={
                    setSupportResistance
                  }
                  placeholder="Key levels, previous highs/lows, supply/demand..."
                />
              </div>

              <TextArea
                label="Other Confluences"
                value={confluences}
                onChange={setConfluences}
                placeholder="Premium/discount, Fibonacci, VWAP, moving averages, volume, session levels, news, correlations..."
                rows={6}
              />
            </div>
          )}
        </div>

        {/* ENTRY + RISK */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <SectionHeader
            id="levels"
            icon={Crosshair}
            title="Entry, Stop Loss & Take Profit"
            description="Define the exact trade plan."
          />

          {expandedSections.levels && (
            <div className="border-t border-gray-100 p-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Entry Model"
                  value={entryModel}
                  onChange={setEntryModel}
                  placeholder="FVG entry / OB retest / breakout / liquidity sweep..."
                />

                <Field
                  label="Entry Price"
                  value={entry}
                  onChange={setEntry}
                  placeholder="1.15350"
                  type="number"
                />

                <Field
                  label="Stop Loss"
                  value={stopLoss}
                  onChange={setStopLoss}
                  placeholder="1.15000"
                  type="number"
                />

                <Field
                  label="Take Profit"
                  value={takeProfit}
                  onChange={setTakeProfit}
                  placeholder="1.16000"
                  type="number"
                />

                <Field
                  label="Risk %"
                  value={risk}
                  onChange={setRisk}
                  placeholder="1"
                  type="number"
                />

                <Field
                  label="Position Size / Lots"
                  value={positionSize}
                  onChange={
                    setPositionSize
                  }
                  placeholder="0.50"
                  type="number"
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500">
                    Risk Distance
                  </p>

                  <p className="mt-2 text-xl font-bold text-red-700">
                    {riskDistance ||
                      "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                    Reward Distance
                  </p>

                  <p className="mt-2 text-xl font-bold text-green-700">
                    {rewardDistance ||
                      "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-purple-100 bg-purple-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                    Reward / Risk
                  </p>

                  <p className="mt-2 text-xl font-bold text-purple-700">
                    {rewardRisk
                      ? `1 : ${rewardRisk}`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RISK MANAGEMENT */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <SectionHeader
            id="risk"
            icon={ShieldAlert}
            title="Risk Management"
            description="Define exactly when the trade is valid and invalid."
          />

          {expandedSections.risk && (
            <div className="space-y-5 border-t border-gray-100 p-5">
              <TextArea
                label="Invalidation"
                value={invalidation}
                onChange={setInvalidation}
                placeholder="What exact condition makes this setup invalid?"
                rows={5}
              />

              <TextArea
                label="Trade Management"
                value={tradeManagement}
                onChange={
                  setTradeManagement
                }
                placeholder="Partial TP, break-even, trailing stop, scale-in, scale-out, maximum holding time..."
                rows={5}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-gray-500">
                    <DollarSign
                      size={16}
                    />
                    <span className="text-xs font-semibold">
                      Planned Risk
                    </span>
                  </div>

                  <p className="mt-2 text-lg font-bold text-gray-900">
                    {risk
                      ? `${risk}%`
                      : "Not defined"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Target
                      size={16}
                    />
                    <span className="text-xs font-semibold">
                      Target
                    </span>
                  </div>

                  <p className="mt-2 text-lg font-bold text-gray-900">
                    {takeProfit ||
                      "Not defined"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock3
                      size={16}
                    />
                    <span className="text-xs font-semibold">
                      Session
                    </span>
                  </div>

                  <p className="mt-2 text-lg font-bold text-gray-900">
                    {session}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* REASONING */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <SectionHeader
            id="reasoning"
            icon={BookOpen}
            title="Trade Thesis"
            description="Write the complete reasoning behind your idea."
          />

          {expandedSections.reasoning && (
            <div className="space-y-5 border-t border-gray-100 p-5">
              <TextArea
                label="Setup Reasoning"
                value={setupReasoning}
                onChange={
                  setSetupReasoning
                }
                placeholder="Explain the setup from start to finish. Why this symbol? Why this direction? What liquidity is being targeted? What confirms the entry? Why is the stop placed there? Why is the target there?"
                rows={10}
              />
            </div>
          )}
        </div>

        {/* CHECKLIST */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <SectionHeader
            id="checklist"
            icon={CheckCircle2}
            title="Pre-Trade Checklist"
            description="Make sure the setup follows your trading rules."
          />

          {expandedSections.checklist && (
            <div className="border-t border-gray-100 p-5">
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Setup Quality
                  </span>

                  <span className="text-sm font-bold text-purple-600">
                    {checklistProgress}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-purple-600 transition-all"
                    style={{
                      width: `${checklistProgress}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  [
                    "higherTimeframeBias",
                    "Higher timeframe bias confirmed",
                  ],
                  [
                    "marketStructure",
                    "Market structure supports the idea",
                  ],
                  [
                    "liquidity",
                    "Liquidity target identified",
                  ],
                  [
                    "bosChoch",
                    "BOS / CHOCH / MSS confirmed",
                  ],
                  [
                    "fvg",
                    "FVG / imbalance identified",
                  ],
                  [
                    "orderBlock",
                    "Order Block identified",
                  ],
                  [
                    "entryConfirmation",
                    "Entry confirmation present",
                  ],
                  [
                    "riskDefined",
                    "Risk is clearly defined",
                  ],
                  [
                    "invalidationDefined",
                    "Invalidation is defined",
                  ],
                  [
                    "rrAcceptable",
                    "Reward/Risk is acceptable",
                  ],
                ].map(
                  ([
                    key,
                    label,
                  ]) => (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                        checklist[key]
                          ? "border-green-200 bg-green-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={
                          Boolean(
                            checklist[key]
                          )
                        }
                        onChange={(
                          event
                        ) =>
                          updateChecklist(
                            key,
                            event.target
                              .checked
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />

                      <span className="text-sm font-medium text-gray-700">
                        {label}
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* SCREENSHOTS */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <ImagePlus size={19} />
                </div>

                <div>
                  <h3 className="font-bold text-gray-900">
                    Setup Screenshots
                  </h3>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Attach chart screenshots to
                    document the setup.
                  </p>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600">
                <Upload size={16} />
                Add Image

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={
                    handleScreenshotUpload
                  }
                  className="hidden"
                />
              </label>
            </div>

            {screenshots.length > 0 ? (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {screenshots.map(
                  (screenshot) => (
                    <div
                      key={
                        screenshot.id
                      }
                      className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
                    >
                      <img
                        src={
                          screenshot.data
                        }
                        alt={
                          screenshot.name ||
                          "Trading setup"
                        }
                        className="max-h-[360px] w-full object-contain"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeScreenshot(
                            screenshot.id
                          )
                        }
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-gray-500 shadow-md transition hover:bg-red-50 hover:text-red-600"
                        title="Remove image"
                      >
                        <X
                          size={16}
                        />
                      </button>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                <ImagePlus
                  size={34}
                  className="mx-auto text-gray-300"
                />

                <p className="mt-3 text-sm font-semibold text-gray-600">
                  No screenshots attached
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Upload your chart and mark
                  the important levels.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* REVIEW */}

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <SectionHeader
            id="review"
            icon={BookOpen}
            title="Post-Trade Review"
            description="Use this section after the trade is completed."
          />

          {expandedSections.review && (
            <div className="space-y-5 border-t border-gray-100 p-5">
              <TextArea
                label="Mistakes"
                value={mistakes}
                onChange={setMistakes}
                placeholder="What did you do wrong? What should you have avoided?"
                rows={6}
              />

              <TextArea
                label="Lessons Learned"
                value={lessons}
                onChange={setLessons}
                placeholder="What did this trade teach you?"
                rows={6}
              />
            </div>
          )}
        </div>

        {/* BOTTOM SAVE */}

        <div className="flex items-center justify-between rounded-2xl border border-purple-100 bg-purple-50 p-5">
          <div>
            <p className="font-bold text-gray-900">
              Ready to save this setup?
            </p>

            <p className="mt-1 text-xs text-gray-500">
              All fields, checklist progress
              and screenshots will be stored
              inside this note.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
          >
            <Save size={17} />
            Save Trading Setup
          </button>
        </div>
      </div>
    </div>
  );
}