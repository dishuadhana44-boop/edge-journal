// ==========================================================
// EDGEFLO (QODER) — ONE-COMMAND DEV STARTUP
//
// Starts together:
//   1. Node backend   -> http://localhost:4000
//   2. Vite frontend  -> http://localhost:5174 (auto-opens browser)
//   3. Python MT5 bridge -> http://127.0.0.1:5001 (skipped if no Python+MetaTrader5)
//
// Usage:
//   npm run dev
//
// Skip the MT5 bridge:
//   set EDGEFLO_SKIP_MT5=1 && npm run dev   (cmd)
//   EDGEFLO_SKIP_MT5=1 npm run dev          (bash)
//
// Use a specific Python:
//   set MT5_PYTHON=C:\path\to\python.exe
// ==========================================================

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(
  path.dirname(fileURLToPath(import.meta.url))
);

const IS_WINDOWS =
  process.platform === "win32";

const children = new Map(); // name -> ChildProcess

let shuttingDown = false;

// ==========================================================
// WINDOWS PROCESS TREE KILL
// ==========================================================

function killTree(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (IS_WINDOWS) {
    spawnSync(
      "taskkill",
      [
        "/pid",
        String(child.pid),
        "/T",
        "/F",
      ],
      { stdio: "ignore" }
    );
  } else {
    try {
      child.kill("SIGTERM");
    } catch {
      // Process already gone
    }
  }
}

// ==========================================================
// SHUTDOWN
// ==========================================================

function shutdown(reason) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log("");
  console.log(
    `🛑 Shutting down EdgeFlo (${reason})...`
  );

  for (const child of children.values()) {
    killTree(child);
  }

  // Give taskkill a moment before exit
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", () => shutdown("Ctrl+C"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ==========================================================
// SPAWN HELPER WITH PREFIXED LOGS
// ==========================================================

function startProcess(
  name,
  command,
  args,
  options = {}
) {
  const child = spawn(command, args, {
    cwd: options.cwd || ROOT,
    shell: false,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.set(name, child);

  const prefix = {
    backend: "\x1b[36m[backend]\x1b[0m ",
    frontend: "\x1b[35m[frontend]\x1b[0m ",
    bridge: "\x1b[33m[mt5-bridge]\x1b[0m ",
  }[name];

  const write = (stream, data) => {
    const lines = String(data).split("\n");

    for (const line of lines) {
      if (line.trim() !== "") {
        stream.write(`${prefix}${line}\n`);
      }
    }
  };

  child.stdout.on("data", (data) =>
    write(process.stdout, data)
  );

  child.stderr.on("data", (data) =>
    write(process.stderr, data)
  );

  child.on("exit", (code) => {
    children.delete(name);

    if (shuttingDown) {
      return;
    }

    console.log(
      `${prefix}exited with code ${code}`
    );

    if (name !== "bridge") {
      // Frontend or backend died -> stop everything
      shutdown(`${name} exited`);
    } else {
      console.log(
        "\x1b[33m[mt5-bridge]\x1b[0m Bridge stopped. App continues without MT5 live data.\n"
      );
    }
  });

  child.on("error", (error) => {
    console.error(
      `${prefix}failed to start: ${error.message}`
    );
  });

  return child;
}

// ==========================================================
// PYTHON MT5 BRIDGE DETECTION
// ==========================================================

function findPythonWithMt5() {
  const candidates = [];

  if (process.env.MT5_PYTHON) {
    candidates.push(process.env.MT5_PYTHON);
  }

  candidates.push("python");
  candidates.push("py");

  // Discovered on this machine during inspection
  candidates.push(
    "C:\\Users\\DELL\\AppData\\Local\\Programs\\Python\\Python313\\python.exe"
  );

  for (const candidate of candidates) {
    try {
      const probe = spawnSync(
        candidate,
        [
          "-c",
          "import MetaTrader5, flask, flask_cors",
        ],
        { stdio: "ignore", shell: false }
      );

      if (probe.status === 0) {
        return candidate;
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

// ==========================================================
// START: BACKEND
// ==========================================================

console.log("");
console.log("====================================");
console.log("🚀 STARTING EDGEFLO (QODER)");
console.log("====================================");
console.log("Frontend    : http://localhost:5174");
console.log("Backend API : http://localhost:4000");
console.log("MT5 bridge  : http://127.0.0.1:5001");
console.log("====================================");
console.log("");

startProcess(
  "backend",
  process.execPath,
  ["index.js"],
  { cwd: path.join(ROOT, "server") }
);

// ==========================================================
// START: FRONTEND (Vite — auto-opens browser, port 5174)
// ==========================================================

startProcess(
  "frontend",
  process.execPath,
  [path.join(ROOT, "node_modules", "vite", "bin", "vite.js")],
  { cwd: ROOT }
);

// ==========================================================
// START: PYTHON MT5 BRIDGE (optional)
// ==========================================================

if (process.env.EDGEFLO_SKIP_MT5 === "1") {
  console.log(
    "\x1b[33m[mt5-bridge]\x1b[0m Skipped (EDGEFLO_SKIP_MT5=1)\n"
  );
} else {
  const python = findPythonWithMt5();

  if (python) {
    console.log(
      `\x1b[33m[mt5-bridge]\x1b[0m Python found: ${python}\n`
    );

    startProcess(
      "bridge",
      python,
      [path.join(ROOT, "mt5-bridge", "app.py")],
      {
        cwd: path.join(ROOT, "mt5-bridge"),
        // app.py prints emojis; Windows cp1252 console
        // can't encode them without this
        env: { PYTHONIOENCODING: "utf-8" },
      }
    );
  } else {
    console.log(
      "\x1b[33m[mt5-bridge]\x1b[0m No Python with MetaTrader5 found — bridge skipped."
    );
    console.log(
      "\x1b[33m[mt5-bridge]\x1b[0m Install deps or set MT5_PYTHON to enable MT5 live data.\n"
    );
  }
}
