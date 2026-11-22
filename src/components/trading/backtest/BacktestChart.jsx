import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
} from "lightweight-charts";

import {
  MousePointer2,
  Minus,
  ArrowUpRight,
  Square,
  Type,
  Eraser,
  Trash2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Search,
  Plus,
  ChevronDown,
  Undo2,
  Redo2,
  Settings,
  Camera,
  Maximize,
  Bell,
  BarChart3,
} from "lucide-react";

const TOOLS = [
  {
    id: "none",
    icon: MousePointer2,
    label: "Cursor",
  },
  {
    id: "trendline",
    icon: ArrowUpRight,
    label: "Trend Line",
  },
  {
    id: "horizontal",
    icon: Minus,
    label: "Horizontal Line",
  },
  {
    id: "rectangle",
    icon: Square,
    label: "Rectangle",
  },
  {
    id: "text",
    icon: Type,
    label: "Text",
  },
  {
    id: "eraser",
    icon: Eraser,
    label: "Erase",
  },
];

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  const lengthSq = dx * dx + dy * dy;

  let t =
    lengthSq === 0
      ? 0
      : ((px - x1) * dx + (py - y1) * dy) /
        lengthSq;

  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

export default function BacktestChart({
  candles,
  backtest,
  session,
  sim,
  toolbar,
  sidePanel,
  selectedPositionId,
  onOpenSettings,
  onSelectInterval,
}) {
  const chartContainerRef = useRef(null);
  const canvasRef = useRef(null);

  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const drawingsRef = useRef([]);
  const pendingPointRef = useRef(null);
  const simRef = useRef(null);
  const selectedRef = useRef(null);

  const [activeTool, setActiveTool] =
    useState("none");

  const [drawings, setDrawings] =
    useState([]);

  const symbol =
    session?.symbol || "EURUSD";

  const interval =
    session?.interval || "15m";

  // =========================================
  // DRAWINGS
  // =========================================

  // Markers and levels are read straight from the simulation engine, so the
  // chart can only show fills that actually happened at or before the cursor.
  function drawTrades(ctx, chart, series, canvas) {
    const sim = simRef.current;
    if (!sim) return;

    const cursor = backtest?.currentIndex ?? Infinity;
    const priceY = (price) => series.priceToCoordinate(price);
    const timeX = (time) => chart.timeScale().timeToCoordinate(chartTime(time));

    function level(price, color, label, dashed = true, width = 1) {
      const y = priceY(price);
      if (y == null) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;

      if (dashed) ctx.setLineDash([5, 4]);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = "10px Inter, sans-serif";
      ctx.fillText(label, 8, y - 4);
      ctx.restore();
    }

    function marker(x, y, kind, color) {
      if (x == null || y == null) return;

      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();

      if (kind === "exit") {
        ctx.rect(x - 4, y - 4, 8, 8);
        ctx.fill();
      } else if (kind === "buy") {
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x - 5, y + 21);
        ctx.lineTo(x + 5, y + 21);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x - 5, y - 21);
        ctx.lineTo(x + 5, y - 21);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    for (const order of sim.orders || []) {
      level(
        order.price,
        "#f59e0b",
        `${order.side} ${order.orderType} ${order.volume}`
      );
    }

    for (const position of sim.positions || []) {
      const selected = position.id === selectedRef.current;
      const color = position.side === "BUY" ? "#16c784" : "#ef4444";

      level(position.entryPrice, selected ? "#a855f7" : color, `Entry ${position.entryPrice}`, !selected, selected ? 2 : 1);
      if (position.sl != null) level(position.sl, "#ef4444", `SL ${position.sl}`);
      if (position.tp != null) level(position.tp, "#16c784", `TP ${position.tp}`);
    }

    for (const mark of sim.markers || []) {
      if (mark.atIndex > cursor) continue;

      const x = timeX(mark.time);
      const y = priceY(mark.price);

      marker(
        x,
        y,
        mark.kind,
        mark.kind === "buy" ? "#16c784" : mark.kind === "sell" ? "#ef4444" : "#a1a1aa"
      );
    }
  }

  function redraw() {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;

    if (!canvas || !chart || !series) return;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.strokeStyle = "#a855f7";
    ctx.fillStyle = "#a855f7";
    ctx.lineWidth = 1.5;
    ctx.font = "11px Inter, sans-serif";

    drawingsRef.current.forEach((d) => {
      // -------------------------------------
      // HORIZONTAL LINE
      // -------------------------------------

      if (d.type === "horizontal") {
        const y =
          series.priceToCoordinate(d.price);

        if (y == null) return;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();

        ctx.fillText(
          d.price.toFixed(5),
          canvas.width - 65,
          y - 5
        );
      }

      // -------------------------------------
      // TREND LINE
      // -------------------------------------

      if (d.type === "trendline") {
        const x1 =
          chart
            .timeScale()
            .timeToCoordinate(d.p1.time);

        const y1 =
          series.priceToCoordinate(
            d.p1.price
          );

        const x2 =
          chart
            .timeScale()
            .timeToCoordinate(d.p2.time);

        const y2 =
          series.priceToCoordinate(
            d.p2.price
          );

        if (
          x1 == null ||
          y1 == null ||
          x2 == null ||
          y2 == null
        ) {
          return;
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // -------------------------------------
      // RECTANGLE
      // -------------------------------------

      if (d.type === "rectangle") {
        const x1 =
          chart
            .timeScale()
            .timeToCoordinate(d.p1.time);

        const y1 =
          series.priceToCoordinate(
            d.p1.price
          );

        const x2 =
          chart
            .timeScale()
            .timeToCoordinate(d.p2.time);

        const y2 =
          series.priceToCoordinate(
            d.p2.price
          );

        if (
          x1 == null ||
          y1 == null ||
          x2 == null ||
          y2 == null
        ) {
          return;
        }

        ctx.save();

        ctx.fillStyle =
          "rgba(168,85,247,0.10)";

        ctx.strokeStyle =
          "#a855f7";

        ctx.fillRect(
          Math.min(x1, x2),
          Math.min(y1, y2),
          Math.abs(x2 - x1),
          Math.abs(y2 - y1)
        );

        ctx.strokeRect(
          Math.min(x1, x2),
          Math.min(y1, y2),
          Math.abs(x2 - x1),
          Math.abs(y2 - y1)
        );

        ctx.restore();
      }

      // -------------------------------------
      // TEXT
      // -------------------------------------

      if (d.type === "text") {
        const x =
          chart
            .timeScale()
            .timeToCoordinate(
              d.point.time
            );

        const y =
          series.priceToCoordinate(
            d.point.price
          );

        if (
          x == null ||
          y == null
        ) {
          return;
        }

        ctx.fillText(
          d.text,
          x + 5,
          y - 5
        );
      }
    });

    drawTrades(ctx, chart, series, canvas);
  }

  useEffect(() => {
    drawingsRef.current = drawings;
    redraw();
  }, [drawings]);

  // =========================================
  // CREATE CHART
  // =========================================

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    const container =
      chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: {
          type: ColorType.Solid,
          color: "#0b0c10",
        },

        textColor: "#a1a1aa",
      },

      grid: {
        vertLines: {
          color: "#1b1d24",
        },

        horzLines: {
          color: "#1b1d24",
        },
      },

      crosshair: {
        mode: 0,
      },

      rightPriceScale: {
        borderColor: "#292c34",

        scaleMargins: {
          top: 0.08,
          bottom: 0.08,
        },
      },

      timeScale: {
        borderColor: "#292c34",

        timeVisible: true,

        secondsVisible: false,

        rightOffset: 5,

        barSpacing: 8,

        minBarSpacing: 2,
      },

      handleScroll: true,
      handleScale: true,
    });

    const series =
      chart.addSeries(
        CandlestickSeries,
        {
          upColor: "#16c784",
          downColor: "#ef4444",

          borderUpColor: "#16c784",
          borderDownColor: "#ef4444",

          wickUpColor: "#16c784",
          wickDownColor: "#ef4444",
        }
      );

    chartRef.current = chart;
    seriesRef.current = series;

    const resize = () => {
      if (!container) return;

      const width =
        container.clientWidth;

      const height =
        container.clientHeight;

      if (
        width <= 0 ||
        height <= 0
      ) {
        return;
      }

      chart.applyOptions({
        width,
        height,
      });

      if (canvasRef.current) {
        canvasRef.current.width =
          width;

        canvasRef.current.height =
          height;
      }

      redraw();
    };

    resize();

    const resizeObserver =
      new ResizeObserver(resize);

    resizeObserver.observe(container);

    const unsubscribe =
      chart
        .timeScale()
        .subscribeVisibleTimeRangeChange(
          redraw
        );

    return () => {
      resizeObserver.disconnect();

      try {
        unsubscribe?.();
      } catch {}

      chart.remove();

      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // =========================================
  // SET DATA
  // =========================================

  // lightweight-charts reads bare numbers as UTC seconds, while the backtest
  // engine keeps millisecond stamps for duration maths.
  function chartTime(value) {
    const num = Number(value);
    return num > 1e11 ? Math.round(num / 1000) : num;
  }

  useEffect(() => {
    if (!seriesRef.current) return;
  
    const visibleCandles =
      backtest?.visibleCandles?.length
        ? backtest.visibleCandles
        : candles || [];
  
    if (!visibleCandles.length) {
      seriesRef.current.setData([]);
      return;
    }
  
    seriesRef.current.setData(
      visibleCandles.map((candle) => ({ ...candle, time: chartTime(candle.time) }))
    );
  
    redraw();
  }, [
    candles,
    backtest?.visibleCandles,
  ]);

  useEffect(() => {
    simRef.current = sim;
    selectedRef.current = selectedPositionId;
    redraw();
  }, [sim, selectedPositionId]);
  // =========================================
  // CANVAS CLICK
  // =========================================

  function handleCanvasClick(e) {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const canvas = canvasRef.current;

    if (
      !chart ||
      !series ||
      !canvas
    ) {
      return;
    }

    const rect =
      canvas.getBoundingClientRect();

    const x =
      e.clientX - rect.left;

    const y =
      e.clientY - rect.top;

    // ---------------------------------------
    // HORIZONTAL
    // ---------------------------------------

    if (
      activeTool === "horizontal"
    ) {
      const price =
        series.coordinateToPrice(y);

      if (price == null) return;

      setDrawings((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: "horizontal",
          price,
        },
      ]);

      setActiveTool("none");

      return;
    }

    // ---------------------------------------
    // TEXT
    // ---------------------------------------

    if (activeTool === "text") {
      const time =
        chart
          .timeScale()
          .coordinateToTime(x);

      const price =
        series.coordinateToPrice(y);

      if (
        time == null ||
        price == null
      ) {
        return;
      }

      const text =
        window.prompt(
          "Label text:"
        );

      if (text) {
        setDrawings((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: "text",

            point: {
              time,
              price,
            },

            text,
          },
        ]);
      }

      setActiveTool("none");

      return;
    }

    // ---------------------------------------
    // TRENDLINE / RECTANGLE
    // ---------------------------------------

    if (
      activeTool === "trendline" ||
      activeTool === "rectangle"
    ) {
      const time =
        chart
          .timeScale()
          .coordinateToTime(x);

      const price =
        series.coordinateToPrice(y);

      if (
        time == null ||
        price == null
      ) {
        return;
      }

      if (
        !pendingPointRef.current
      ) {
        pendingPointRef.current = {
          time,
          price,
        };

        return;
      }

      setDrawings((prev) => [
        ...prev,
        {
          id: Date.now(),

          type: activeTool,

          p1:
            pendingPointRef.current,

          p2: {
            time,
            price,
          },
        },
      ]);

      pendingPointRef.current =
        null;

      setActiveTool("none");

      return;
    }

    // ---------------------------------------
    // ERASER
    // ---------------------------------------

    if (
      activeTool === "eraser"
    ) {
      setDrawings((prev) =>
        prev.filter((d) => {
          if (
            d.type ===
            "horizontal"
          ) {
            const dy =
              series.priceToCoordinate(
                d.price
              );

            return (
              dy == null ||
              Math.abs(dy - y) > 8
            );
          }

          if (
            d.type === "text"
          ) {
            const dx =
              chart
                .timeScale()
                .timeToCoordinate(
                  d.point.time
                );

            const dy =
              series.priceToCoordinate(
                d.point.price
              );

            if (
              dx == null ||
              dy == null
            ) {
              return true;
            }

            return (
              Math.hypot(
                dx - x,
                dy - y
              ) > 14
            );
          }

          if (
            d.type === "trendline"
          ) {
            const x1 =
              chart
                .timeScale()
                .timeToCoordinate(
                  d.p1.time
                );

            const y1 =
              series.priceToCoordinate(
                d.p1.price
              );

            const x2 =
              chart
                .timeScale()
                .timeToCoordinate(
                  d.p2.time
                );

            const y2 =
              series.priceToCoordinate(
                d.p2.price
              );

            if (
              x1 == null ||
              y1 == null ||
              x2 == null ||
              y2 == null
            ) {
              return true;
            }

            return (
              distToSegment(
                x,
                y,
                x1,
                y1,
                x2,
                y2
              ) > 8
            );
          }

          if (
            d.type === "rectangle"
          ) {
            const x1 =
              chart
                .timeScale()
                .timeToCoordinate(
                  d.p1.time
                );

            const y1 =
              series.priceToCoordinate(
                d.p1.price
              );

            const x2 =
              chart
                .timeScale()
                .timeToCoordinate(
                  d.p2.time
                );

            const y2 =
              series.priceToCoordinate(
                d.p2.price
              );

            if (
              x1 == null ||
              y1 == null ||
              x2 == null ||
              y2 == null
            ) {
              return true;
            }

            const inside =
              x >=
                Math.min(
                  x1,
                  x2
                ) &&
              x <=
                Math.max(
                  x1,
                  x2
                ) &&
              y >=
                Math.min(
                  y1,
                  y2
                ) &&
              y <=
                Math.max(
                  y1,
                  y2
                );

            return !inside;
          }

          return true;
        })
      );

      setActiveTool("none");
    }
  }

  // =========================================
  // TOOL SELECT
  // =========================================

  const selectTool = (id) => {
    pendingPointRef.current =
      null;

    setActiveTool((prev) =>
      prev === id
        ? "none"
        : id
    );
  };

  // =========================================
  // UI
  // =========================================

  return (
    <div className="w-full h-full min-h-0 bg-[#0b0c10] text-white flex flex-col overflow-hidden">

      {toolbar}

      {/* =================================================
          TOP TOOLBAR
      ================================================= */}

      <div className="h-[58px] shrink-0 bg-[#0c0d12] border-b border-[#24262d] flex items-center px-4 gap-3">

        {/* SYMBOL */}

        <button
          className="
            h-9
            px-3
            rounded-lg
            border
            border-[#292c34]
            bg-[#111318]
            flex
            items-center
            gap-2
            text-sm
            font-medium
            hover:bg-[#171920]
          "
        >
          <Search size={15} />

          <span>
            {symbol}
          </span>

          <ChevronDown
            size={14}
            className="text-zinc-500"
          />
        </button>

        {/* ADD SYMBOL */}

    

        <div className="w-px h-6 bg-[#292c34]" />

        {/* TIMEFRAMES */}

        {[
          ["1m", "1m"],
          ["5m", "5m"],
          ["15m", "15m"],
          ["30m", "30m"],
          ["1h", "1h"],
          ["4h", "4h"],
          ["1d", "D"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => onSelectInterval?.(value)}
            className={`
              px-2
              text-sm
              transition-colors
              ${
                value === interval
                  ? "text-purple-400 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }
            `}
          >
            {label}
          </button>
        ))}

        <ChevronDown
          size={14}
          className="text-zinc-500"
        />

        <div className="w-px h-6 bg-[#292c34]" />

        {/* CHART TYPE */}

        <button
          className="text-zinc-400 hover:text-white"
          title="Chart type"
        >
          <BarChart3 size={18} />
        </button>

        {/* INDICATORS */}

        <button
          className="
            flex
            items-center
            gap-2
            text-sm
            text-zinc-300
            hover:text-white
          "
        >
          <BarChart3 size={17} />

          <span>
            Indicators
          </span>

          <ChevronDown size={13} />
        </button>

        <div className="flex-1" />

        {/* ALERT */}

        <button
          className="
            flex
            items-center
            gap-2
            text-sm
            text-zinc-400
            hover:text-white
          "
        >
          <Bell size={17} />

          <span>
            Alert
          </span>
        </button>

        {/* REPLAY */}

        <button
          className="
            h-9
            px-3
            rounded-lg
            bg-purple-600
            hover:bg-purple-500
            flex
            items-center
            gap-2
            text-sm
            font-medium
            shadow-[0_0_18px_rgba(168,85,247,0.25)]
          "
        >
          <SkipBack size={15} />

          Replay

          <ChevronDown size={13} />
        </button>

        {/* UNDO */}

        <button className="text-zinc-500 hover:text-white">
          <Undo2 size={18} />
        </button>

        {/* REDO */}

        <button className="text-zinc-600 hover:text-zinc-400">
          <Redo2 size={18} />
        </button>

        {/* SESSION */}

        <div className="px-3 text-right leading-tight">
          <div className="text-sm text-white">
            {session?.sessionName ||
              "Backtest"}
          </div>

          <div className="text-[10px] text-purple-400">
            Save
          </div>
        </div>

        {/* SETTINGS */}

        <button
          className="text-zinc-400 hover:text-white"
          title="Settings"
        >
          <Settings size={18} />
        </button>

        {/* CAMERA */}

        <button
          className="text-zinc-400 hover:text-white"
          title="Screenshot"
        >
          <Camera size={18} />
        </button>

        {/* FULLSCREEN */}

        <button
          className="text-zinc-400 hover:text-white"
          title="Fullscreen"
        >
          <Maximize size={18} />
        </button>
      </div>

      {/* =================================================
          MAIN AREA
      ================================================= */}

      <div className="flex-1 min-h-0 flex">

        {/* ===============================================
            LEFT TOOLBAR
        =============================================== */}

        <div
          className="
            w-[58px]
            shrink-0
            bg-[#0c0d12]
            border-r
            border-[#24262d]
            flex
            flex-col
            items-center
            py-3
            gap-2
          "
        >
          {TOOLS.map((tool) => {
            const Icon = tool.icon;

            return (
              <button
                key={tool.id}
                title={tool.label}
                onClick={() =>
                  selectTool(
                    tool.id
                  )
                }
                className={`
                  w-9
                  h-9
                  rounded-lg
                  flex
                  items-center
                  justify-center
                  transition-colors
                  ${
                    activeTool ===
                    tool.id
                      ? "bg-purple-600 text-white"
                      : "text-zinc-400 hover:bg-[#191b22] hover:text-white"
                  }
                `}
              >
                <Icon size={17} />
              </button>
            );
          })}

          <div className="flex-1" />

          <button
            title="Clear all drawings"
            onClick={() =>
              setDrawings([])
            }
            className="
              w-9
              h-9
              rounded-lg
              flex
              items-center
              justify-center
              text-zinc-500
              hover:bg-red-500/10
              hover:text-red-400
            "
          >
            <Trash2 size={17} />
          </button>
        </div>

        {/* ===============================================
            CHART
        =============================================== */}

        <div className="flex-1 relative min-w-0 min-h-0">

          {/* Chart information */}

          <div
            className="
              absolute
              z-10
              top-5
              left-5
              pointer-events-none
            "
          >
            <div className="text-sm font-medium text-zinc-200">
              {symbol}
              <span className="text-zinc-500 mx-2">
                ·
              </span>
              {interval}
            </div>

            {candles?.length > 0 &&
              candles[
                candles.length - 1
              ] && (
                <div className="mt-1 text-[11px] text-zinc-500">
                  O{" "}
                  {Number(
                    candles[
                      candles.length - 1
                    ].open
                  ).toFixed(5)}

                  {"  "}

                  H{" "}
                  {Number(
                    candles[
                      candles.length - 1
                    ].high
                  ).toFixed(5)}

                  {"  "}

                  L{" "}
                  {Number(
                    candles[
                      candles.length - 1
                    ].low
                  ).toFixed(5)}

                  {"  "}

                  C{" "}
                  {Number(
                    candles[
                      candles.length - 1
                    ].close
                  ).toFixed(5)}
                </div>
              )}
          </div>

          {/* LIGHTWEIGHT CHART */}

          <div
            ref={chartContainerRef}
            className="absolute inset-0"
          />

          {/* DRAWING CANVAS */}

          <canvas
            ref={canvasRef}
            onClick={
              handleCanvasClick
            }
            className="absolute inset-0"
            style={{
              pointerEvents:
                activeTool ===
                "none"
                  ? "none"
                  : "auto",

              cursor:
                activeTool ===
                "none"
                  ? "default"
                  : "crosshair",
            }}
          />
        </div>

        {sidePanel}
      </div>

      {/* =================================================
          BOTTOM REPLAY BAR
      ================================================= */}

      {backtest && (
        <div
          className="
            h-[74px]
            shrink-0
            bg-[#0c0d12]
            border-t
            border-[#24262d]
            flex
            items-center
            px-5
            gap-5
          "
        >
          {/* REPLAY TRADING */}

          <div className="flex items-center gap-2 min-w-[145px]">
            <span className="text-purple-400 font-semibold text-sm">
              Replay Trading
            </span>

            <ChevronDown
              size={15}
              className="text-purple-400"
            />
          </div>

          <div className="w-px h-8 bg-[#292c34]" />

          {/* RESET */}

          <button
            onClick={
              backtest.reset
            }
            title="Reset replay"
            className="text-zinc-400 hover:text-white"
          >
            <RotateCcw size={18} />
          </button>

          {/* PREVIOUS */}

          <button
            onClick={
              backtest.stepBack
            }
            title="Previous candle"
            className="text-zinc-400 hover:text-white"
          >
            <SkipBack size={20} />
          </button>

          {/* PLAY */}

          <button
            onClick={
              backtest.togglePlay
            }
            className="
              w-12
              h-12
              rounded-full
              bg-purple-600
              hover:bg-purple-500
              flex
              items-center
              justify-center
              shadow-[0_0_25px_rgba(168,85,247,0.35)]
              transition-all
            "
          >
            {backtest.isPlaying ? (
              <Pause
                size={19}
                fill="white"
              />
            ) : (
              <Play
                size={20}
                fill="white"
              />
            )}
          </button>

          {/* NEXT */}

          <button
            onClick={
              backtest.step
            }
            title="Next candle"
            className="text-zinc-400 hover:text-white"
          >
            <SkipForward size={20} />
          </button>

          {/* SPEED */}

          <div
            className="
              flex
              items-center
              rounded-lg
              border
              border-[#292c34]
              overflow-hidden
            "
          >
            {SPEEDS.map(
              (speed) => (
                <button
                  key={speed}
                  onClick={() =>
                    backtest.setSpeed(
                      speed
                    )
                  }
                  className={`
                    px-3
                    h-9
                    text-xs
                    font-medium
                    ${
                      backtest.speed ===
                      speed
                        ? "bg-purple-600 text-white"
                        : "bg-[#111318] text-zinc-400 hover:text-white"
                    }
                  `}
                >
                  {speed}x
                </button>
              )
            )}
          </div>

          {/* SLIDER */}

          <div
            className="
              flex-1
              flex
              items-center
              gap-4
            "
          >
            <input
              type="range"
              min={1}
              max={
                backtest.totalCandles ||
                1
              }
              value={
                backtest.currentIndex
              }
              onChange={(e) =>
                backtest.scrubTo(
                  Number(
                    e.target.value
                  )
                )
              }
              className="
                w-full
                accent-purple-600
              "
            />

            <span
              className="
                text-xs
                text-zinc-400
                whitespace-nowrap
                min-w-[85px]
                text-right
              "
            >
              {backtest.currentIndex}
              {" / "}
              {backtest.totalCandles}
            </span>
          </div>

          {/* SIMULATED CLOCK */}

          <div className="shrink-0 text-right leading-tight min-w-[150px]">
            <div className="text-[11px] text-zinc-500">
              Replay time (UTC)
            </div>

            <div className="text-xs font-medium text-white tabular-nums">
              {backtest.currentCandle
                ? new Date(backtest.currentCandle.time).toISOString().slice(0, 16).replace("T", " ")
                : "—"}
            </div>
          </div>

          {backtest.isFinished && (
            <span className="shrink-0 rounded-lg bg-purple-600/20 px-2.5 py-1 text-[11px] font-semibold text-purple-300">
              Replay Complete
            </span>
          )}

          {/* SETTINGS */}

          <button
            onClick={onOpenSettings}
            title="Backtest settings"
            className="text-zinc-400 hover:text-white"
          >
            <Settings
              size={18}
            />
          </button>
        </div>
      )}
    </div>
  );
}