import React, { useEffect, useState } from "react";

export default function ConnectBroker({ onTradesImported }) {
  const [accessToken, setAccessToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-read access token from URL after redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("ctrader_token");
    if (token) {
      setAccessToken(token);
      localStorage.setItem("ctrader_access_token", token);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const savedToken = localStorage.getItem("ctrader_access_token");
      if (savedToken) setAccessToken(savedToken);
    }
  }, []);

  // Step A: Trigger cTrader OAuth Login
  const handleConnectBroker = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/ctrader/login");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert("Failed to initiate cTrader Connection");
    }
  };

  // Step B: Import Trades using Token & Account ID
  const handleImportTrades = async () => {
    if (!accountId) return alert("Please enter Account ID");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:4000/api/ctrader/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, accountId }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Trades imported successfully!");
        if (onTradesImported) onTradesImported(data.trades);
      }
    } catch (err) {
      alert("Error importing trades");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl border border-slate-800 max-w-md">
      <h2 className="text-lg font-bold mb-4">cTrader Broker Integration</h2>

      {!accessToken ? (
        <button
          onClick={handleConnectBroker}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded text-sm transition"
        >
          Connect cTrader Broker
        </button>
      ) : (
        <div className="space-y-4">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 text-xs rounded border border-emerald-500/20 text-center font-medium">
            ✓ cTrader Account Authorized
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Account ID</label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Enter cTrader Account ID (e.g. 123456)"
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleImportTrades}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded text-sm transition"
          >
            {loading ? "Syncing..." : "Sync Trades Data"}
          </button>
        </div>
      )}
    </div>
  );
}