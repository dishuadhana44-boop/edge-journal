import React, { useEffect, useState } from "react";

export default function BrokerIntegrationPage() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState("");

  // ==========================================
  // CHECK CONNECTION
  // ==========================================

  const checkConnection = async () => {
    try {
      const res = await fetch(
        "http://127.0.0.1:4000/api/ctrader/status"
      );

      const data = await res.json();

      setConnected(Boolean(data.connected));

      if (data.accountId) {
        setAccountId(data.accountId);
      }
    } catch (error) {
      console.error("Connection status error:", error);
    }
  };

  // ==========================================
  // PAGE LOAD
  // ==========================================

  useEffect(() => {
    checkConnection();

    const params = new URLSearchParams(
      window.location.search
    );

    const status = params.get("ctrader");
    const message = params.get("message");

    if (status === "connected") {
      alert("cTrader account connected successfully!");

      window.history.replaceState(
        {},
        document.title,
        "/settings"
      );

      checkConnection();
    }

    if (status === "error") {
      alert(
        `cTrader connection failed.\n\n${
          message || "Unknown error"
        }`
      );

      window.history.replaceState(
        {},
        document.title,
        "/settings"
      );
    }
  }, []);

  // ==========================================
  // CONNECT
  // ==========================================

  const handleConnectBroker = () => {
    window.location.href =
      "http://127.0.0.1:4000/api/ctrader/connect";
  };

  // ==========================================
  // SAVE ACCOUNT
  // ==========================================

  const handleSaveAccount = async () => {
    if (!accountId.trim()) {
      alert("Please enter your cTrader Account ID.");
      return;
    }

    try {
      const res = await fetch(
        "http://127.0.0.1:4000/api/ctrader/account",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountId: accountId.trim(),
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Failed to save account");
        return;
      }

      alert("cTrader Account ID saved successfully!");
    } catch (error) {
      console.error("Account save error:", error);

      alert("Failed to save account.");
    }
  };

  // ==========================================
  // DISCONNECT
  // ==========================================

  const handleDisconnect = async () => {
    try {
      await fetch(
        "http://127.0.0.1:4000/api/ctrader/disconnect",
        {
          method: "POST",
        }
      );

      setConnected(false);
      setAccountId("");

      alert("cTrader disconnected.");
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl max-w-xl">

        {/* HEADER */}

        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              cTrader Broker Integration
            </h3>

            <p className="text-xs text-slate-400">
              Connect your cTrader account to automatically sync trades.
            </p>
          </div>

          <span
            className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              connected
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {connected ? "Connected" : "Not Connected"}
          </span>
        </div>

        {!connected ? (
          <div className="space-y-4">

            <button
              onClick={handleConnectBroker}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition"
            >
              Connect cTrader
            </button>

            <p className="text-[11px] text-slate-500 text-center">
              You will be redirected to cTrader to authorize EdgeFlo.
            </p>

          </div>
        ) : (
          <div className="space-y-4 mt-4 pt-4 border-t border-slate-800">

            {/* ACCOUNT ID */}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                cTrader Account ID
              </label>

              <input
                type="text"
                value={accountId}
                onChange={(e) =>
                  setAccountId(e.target.value)
                }
                placeholder="Enter Account ID e.g. 5881795"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSaveAccount}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition"
            >
              Save Account
            </button>

            {/* SYNC */}

            <button
              disabled={!accountId || loading}
              onClick={() => {
                setLoading(true);

                setTimeout(() => {
                  setLoading(false);
                  alert(
                    "Account connected. Trade sync API will be added next."
                  );
                }, 1000);
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition"
            >
              {loading
                ? "Syncing..."
                : "Sync Trades Data"}
            </button>

            {/* DISCONNECT */}

            <button
              onClick={handleDisconnect}
              className="w-full text-xs text-red-400 hover:underline pt-2"
            >
              Disconnect Account
            </button>

          </div>
        )}
      </div>
    </div>
  );
}