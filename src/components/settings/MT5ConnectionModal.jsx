import { useEffect, useState } from "react";
import {
  X,
  Server,
  UserRound,
  Link2,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";

const API_URL = "http://127.0.0.1:4000";

export default function MT5ConnectionModal({
  isOpen,
  account,
  onClose,
  onConnected,
}) {
  const [login, setLogin] = useState("");
  const [server, setServer] = useState("");
  const [password, setPassword] = useState("");

  const [isConnecting, setIsConnecting] =
    useState(false);

  const [message, setMessage] =
    useState(null);

  useEffect(() => {
    if (!isOpen || !account) {
      return;
    }

    setLogin(
      account.mt5Login
        ? String(account.mt5Login)
        : ""
    );

    setServer(
      account.mt5Server || ""
    );

    setPassword("");
    setMessage(null);
  }, [isOpen, account]);

  if (!isOpen || !account) {
    return null;
  }

  const handleConnect = async (event) => {
    event.preventDefault();

    setMessage(null);

    if (!login.trim()) {
      setMessage({
        type: "error",
        text: "Please enter your MT5 login.",
      });

      return;
    }

    if (!server.trim()) {
      setMessage({
        type: "error",
        text: "Please enter your MT5 server.",
      });

      return;
    }

    try {
      setIsConnecting(true);

      console.log(
        "🔵 MT5 CONNECTION REQUEST:",
        {
          edgefloAccountId:
            account.id,

          edgefloAccountName:
            account.accountName,

          mt5Login:
            login,

          mt5Server:
            server,
        }
      );

      const response =
        await fetch(
          `${API_URL}/api/mt5/connect`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              accountId:
                String(account.id),

              login:
                Number(login),

              server:
                server.trim(),

              ...(password
                ? {
                    password,
                  }
                : {}),
            }),
          }
        );

      const data =
        await response.json();

      console.log(
        "🟢 MT5 CONNECTION RESPONSE:",
        data
      );

      if (
        data.success === true &&
        data.connected === true
      ) {
        setMessage({
          type: "success",
          text:
            "MetaTrader 5 connected successfully.",
        });

        if (onConnected) {
          const mt5Account = data.account || {};
        
          onConnected({
            ...account,
        
            // ======================================================
            // MT5 CONNECTION
            // ======================================================
        
            mt5Login:
              mt5Account.login ?? Number(login),
        
            mt5Server:
              mt5Account.server ?? server.trim(),
        
            mt5Connected: true,
            connectionStatus: "connected",
        
            // ======================================================
            // ACTUAL MT5 ACCOUNT DATA
            // ======================================================
        
            // MT5 balance becomes EdgeFlo balance
            balance: Number(
              mt5Account.balance ??
                account.balance ??
                0
            ),
        
            // MT5 balance becomes the account's starting balance
            // so the old manually-entered $100,000 is replaced.
            startingBalance: Number(
              mt5Account.balance ??
                account.balance ??
                account.startingBalance ??
                0
            ),
        
            // MT5 equity
            equity: Number(
              mt5Account.equity ??
                account.equity ??
                0
            ),
        
            // MT5 used margin
            marginUsed: Number(
              mt5Account.margin ??
                account.marginUsed ??
                0
            ),
        
            // MT5 free margin
            freeMargin: Number(
              mt5Account.freeMargin ??
                mt5Account.margin_free ??
                account.freeMargin ??
                0
            ),
        
            // MT5 account currency
            currency:
              mt5Account.currency ??
              account.currency ??
              "USD",
        
            // MT5 leverage
            leverage: Number(
              mt5Account.leverage ??
                account.leverage ??
                0
            ),
        
            // MT5 floating profit/loss
            floatingPnL: Number(
              mt5Account.profit ??
                account.floatingPnL ??
                0
            ),
        
            // Last successful synchronization
            lastSynced:
              new Date().toISOString(),
          });
        }

        setTimeout(() => {
          onClose?.();
        }, 700);

        return;
      }

      setMessage({
        type: "error",
        text:
          data.message ||
          data.error ||
          "Unable to connect to MetaTrader 5.",
      });
    } catch (error) {
      console.error(
        "❌ MT5 CONNECTION ERROR:",
        error
      );

      setMessage({
        type: "error",
        text:
          "Unable to connect to the MT5 Bridge. Make sure the MT5 Bridge is running on port 5001.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <Link2
                size={20}
                className="text-violet-600"
              />

              <h2 className="text-lg font-bold text-gray-900">
                Connect MT5
              </h2>
            </div>

            <p className="mt-1 text-sm text-gray-500">
              Connect MetaTrader 5 to this
              EdgeFlo account.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isConnecting}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* ACCOUNT */}
        <div className="mx-6 mt-6 rounded-2xl border border-violet-100 bg-violet-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
            EdgeFlo Account
          </p>

          <p className="mt-1 text-lg font-bold text-gray-900">
            {account.accountName}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Account ID: {account.id}
          </p>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleConnect}
          className="space-y-5 p-6"
        >
          {/* LOGIN */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              MT5 Login
            </label>

            <div className="relative">
              <UserRound
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="number"
                value={login}
                onChange={(event) =>
                  setLogin(
                    event.target.value
                  )
                }
                placeholder="Enter MT5 login"
                disabled={isConnecting}
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* SERVER */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              MT5 Server
            </label>

            <div className="relative">
              <Server
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={server}
                onChange={(event) =>
                  setServer(
                    event.target.value
                  )
                }
                placeholder="Example: Broker-Demo"
                disabled={isConnecting}
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              MT5 Password
              <span className="ml-2 text-xs font-normal text-gray-400">
                Optional
              </span>
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Enter MT5 password if required"
              disabled={isConnecting}
              autoComplete="off"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-gray-50"
            />

            <p className="mt-2 text-xs leading-5 text-gray-400">
              The password is sent only for the
              connection request and is not saved
              in the EdgeFlo account data.
            </p>
          </div>

          {/* MESSAGE */}
          {message && (
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message.type ===
              "success" ? (
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0"
                />
              ) : (
                <CircleAlert
                  size={18}
                  className="mt-0.5 shrink-0"
                />
              )}

              <span>
                {message.text}
              </span>
            </div>
          )}

          {/* FOOTER */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isConnecting}
              className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isConnecting}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Link2 size={17} />

              {isConnecting
                ? "Connecting..."
                : "Connect MT5"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}