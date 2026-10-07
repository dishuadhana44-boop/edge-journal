import {
  Wallet,
  CircleDollarSign,
  BadgeCheck,
  Landmark,
  Link2,
  Server,
  UserRound,
  CheckCircle2,
  Unplug,
} from "lucide-react";

export default function TradingAccountsView({ account }) {
  const isConnected =
    account?.isBrokerAccount ||
    account?.mt5Connected ||
    account?.connectionStatus === "connected";

  const brokerName =
    account?.broker || "MT5";

  const connectionStatus = isConnected
    ? "Connected"
    : "Not Connected";

  return (
    <div className="space-y-8">
      {/* ======================================================
          EDGEFLO ACCOUNT
      ====================================================== */}

      <div>
        <div className="mb-5">
          <h3 className="text-lg font-bold text-gray-900">
            EdgeFlo Account
          </h3>

        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Account Name */}
          <div className="flex items-start gap-4">
            <div
              className="
                w-14
                h-14
                rounded-2xl
                bg-violet-100
                flex
                items-center
                justify-center
                shrink-0
              "
            >
              <Wallet
                size={26}
                className="text-violet-600"
              />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Name
              </p>

              <h2 className="text-xl font-bold mt-1 text-gray-900">
                {account?.accountName || "Trading Account"}
              </h2>
            </div>
          </div>

          {/* Account Type */}
          <div className="flex items-start gap-4">
            <div
              className="
                w-14
                h-14
                rounded-2xl
                bg-blue-100
                flex
                items-center
                justify-center
                shrink-0
              "
            >
              <BadgeCheck
                size={26}
                className="text-blue-600"
              />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Type
              </p>

              <h2 className="text-xl font-bold mt-1 text-gray-900">
                {account?.accountType || "Manual"}
              </h2>
            </div>
          </div>

          {/* Currency */}
          <div className="flex items-start gap-4">
            <div
              className="
                w-14
                h-14
                rounded-2xl
                bg-green-100
                flex
                items-center
                justify-center
                shrink-0
              "
            >
              <CircleDollarSign
                size={26}
                className="text-green-600"
              />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Currency
              </p>

              <h2 className="text-xl font-bold mt-1 text-gray-900">
                {account?.currency || "USD"}
              </h2>
            </div>
          </div>

          {/* Current Balance */}
<div className="flex items-start gap-4">
  <div
    className="
      w-14
      h-14
      rounded-2xl
      bg-orange-100
      flex
      items-center
      justify-center
      shrink-0
    "
  >
    <Landmark
      size={26}
      className="text-orange-600"
    />
  </div>

  <div>
    <p className="text-sm text-gray-500">
      Current Balance
    </p>

    <h2 className="text-xl font-bold mt-1 text-gray-900">
      {account?.currency || "USD"}{" "}
      {Number(
        account?.balance ?? 0
      ).toLocaleString()}
    </h2>
  </div>
</div>
        </div>
      </div>

      {/* ======================================================
          BROKER CONNECTION
      ====================================================== */}

      <div>
        <div className="mb-5">
          <h3 className="text-lg font-bold text-gray-900">
            Broker Connection
          </h3>

       
        </div>

        <div
          className="
            rounded-2xl
            border
            border-gray-200
            bg-gray-50
            p-6
          "
        >
          <div className="grid grid-cols-2 gap-6">
            {/* Broker */}
            <div className="flex items-start gap-4">
              <div
                className="
                  w-12
                  h-12
                  rounded-xl
                  bg-white
                  border
                  border-gray-200
                  flex
                  items-center
                  justify-center
                  shrink-0
                "
              >
                <Link2
                  size={22}
                  className="text-violet-600"
                />
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Broker
                </p>

                <h3 className="text-lg font-semibold mt-1 text-gray-900">
                  {isConnected
                    ? brokerName
                    : "Not Connected"}
                </h3>
              </div>
            </div>

            {/* Login */}
            <div className="flex items-start gap-4">
              <div
                className="
                  w-12
                  h-12
                  rounded-xl
                  bg-white
                  border
                  border-gray-200
                  flex
                  items-center
                  justify-center
                  shrink-0
                "
              >
                <UserRound
                  size={22}
                  className="text-blue-600"
                />
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Login
                </p>

                <h3 className="text-lg font-semibold mt-1 text-gray-900">
                  {account?.mt5Login ||
                    account?.brokerAccountId ||
                    "—"}
                </h3>
              </div>
            </div>

            {/* Server */}
            <div className="flex items-start gap-4">
              <div
                className="
                  w-12
                  h-12
                  rounded-xl
                  bg-white
                  border
                  border-gray-200
                  flex
                  items-center
                  justify-center
                  shrink-0
                "
              >
                <Server
                  size={22}
                  className="text-orange-600"
                />
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Server
                </p>

                <h3 className="text-lg font-semibold mt-1 text-gray-900">
                  {account?.mt5Server || "—"}
                </h3>
              </div>
            </div>

            {/* Connection Status */}
            <div className="flex items-start gap-4">
              <div
                className={`
                  w-12
                  h-12
                  rounded-xl
                  bg-white
                  border
                  border-gray-200
                  flex
                  items-center
                  justify-center
                  shrink-0
                `}
              >
                {isConnected ? (
                  <CheckCircle2
                    size={22}
                    className="text-emerald-600"
                  />
                ) : (
                  <Unplug
                    size={22}
                    className="text-gray-400"
                  />
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Connection Status
                </p>

                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`
                      w-2.5
                      h-2.5
                      rounded-full
                      ${
                        isConnected
                          ? "bg-emerald-500"
                          : "bg-gray-400"
                      }
                    `}
                  />

                  <h3
                    className={`
                      text-lg
                      font-semibold
                      ${
                        isConnected
                          ? "text-emerald-700"
                          : "text-gray-600"
                      }
                    `}
                  >
                    {connectionStatus}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Connection Explanation */}
          <div
            className="
              mt-6
              pt-5
              border-t
              border-gray-200
              flex
              items-start
              gap-3
            "
          >
           

          
          </div>
        </div>
      </div>
    </div>
  );
}