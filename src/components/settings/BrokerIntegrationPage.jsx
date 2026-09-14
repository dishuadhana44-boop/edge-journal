import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Plus,
  ShieldCheck,
} from "lucide-react";

import BrokerCard from "../../brokers/BrokerCard";
import AddBrokerModal from "../../brokers/AddBrokerModal";
import BrokerDetailsModal from "../../brokers/BrokerDetailsModal";

import {
  getBrokerById,
} from "../../brokers/brokerRegistry";

/* ==========================================================
   API URL
========================================================== */

const API_URL = "http://127.0.0.1:4000";

/* ==========================================================
   COMPONENT
========================================================== */

export default function BrokerIntegrationPage() {
  /* ==========================================================
     STATE
  ========================================================== */

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState(null);

  const [showAddBroker, setShowAddBroker] =
    useState(false);

  const [showBrokerDetails, setShowBrokerDetails] =
    useState(false);

  const [selectedBroker, setSelectedBroker] =
    useState(null);

  const [connectedBrokers, setConnectedBrokers] =
    useState([]);

  /* ==========================================================
     BROKER DATA
  ========================================================== */

  const ctraderBroker = getBrokerById("ctrader");

  const mt5Broker = getBrokerById("mt5");

  /* ==========================================================
     SHOW MESSAGE
  ========================================================== */

  const showMessage = (type, text) => {
    setMessage({
      type,
      text,
    });

    setTimeout(() => {
      setMessage(null);
    }, 4000);
  };

  /* ==========================================================
     CHECK CTRADER CONNECTION
  ========================================================== */

  const checkCTraderConnection = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/ctrader/status`
      );

      if (!res.ok) {
        return {
          connected: false,
        };
      }

      const data = await res.json();

      if (data.connected) {
        return {
          connected: true,

          accountId:
            data.accountId ||
            data.account?.accountId ||
            null,

          lastSync:
            data.lastSync ||
            null,

          account:
            data.account ||
            null,
        };
      }

      return {
        connected: false,
      };
    } catch (error) {
      console.error(
        "cTrader connection status error:",
        error
      );

      return {
        connected: false,
      };
    }
  };

  /* ==========================================================
     CHECK MT5 CONNECTION
  ========================================================== */

  const checkMT5Connection = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/mt5/status`
      );

      if (!res.ok) {
        return {
          connected: false,
        };
      }

      const data = await res.json();

      console.log(
        "MT5 status:",
        data
      );

      if (data.connected === true) {
        const account = data.account || {};

        return {
          connected: true,

          accountId:
            data.accountId ||
            account.login ||
            null,

          lastSync:
            data.lastSync ||
            new Date().toISOString(),

          account,
        };
      }

      return {
        connected: false,
      };
    } catch (error) {
      console.log(
        "MT5 is not connected yet.",
        error
      );

      return {
        connected: false,
      };
    }
  };

  /* ==========================================================
     LOAD CONNECTED BROKERS
  ========================================================== */

  const loadConnectedBrokers = async () => {
    try {
      setLoading(true);

      const brokers = [];

      /* ======================================================
         CTRADER
      ====================================================== */

      const ctraderStatus =
        await checkCTraderConnection();

      if (
        ctraderStatus.connected &&
        ctraderBroker
      ) {
        brokers.push({
          ...ctraderBroker,

          accountId:
            ctraderStatus.accountId,

          lastSync:
            ctraderStatus.lastSync,

          account:
            ctraderStatus.account,

          connected: true,
        });
      }

      /* ======================================================
         METATRADER 5
      ====================================================== */

      const mt5Status =
        await checkMT5Connection();

      if (
        mt5Status.connected &&
        mt5Broker
      ) {
        brokers.push({
          ...mt5Broker,

          accountId:
            mt5Status.accountId,

          lastSync:
            mt5Status.lastSync,

          account:
            mt5Status.account,

          connected: true,
        });
      }

      setConnectedBrokers(brokers);

      return brokers;
    } catch (error) {
      console.error(
        "Failed to load brokers:",
        error
      );

      return [];
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     PAGE LOAD
  ========================================================== */

  useEffect(() => {
    loadConnectedBrokers();

    const params = new URLSearchParams(
      window.location.search
    );

    const ctraderStatus =
      params.get("ctrader");

    const mt5Status =
      params.get("mt5");

    const messageParam =
      params.get("message");

    /* ========================================================
       CTRADER RESULT
    ======================================================== */

    if (ctraderStatus === "connected") {
      showMessage(
        "success",
        "cTrader account connected successfully!"
      );

      window.history.replaceState(
        {},
        document.title,
        "/settings"
      );

      setTimeout(() => {
        loadConnectedBrokers();
      }, 500);
    }

    if (ctraderStatus === "error") {
      showMessage(
        "error",
        messageParam ||
          "cTrader connection failed."
      );

      window.history.replaceState(
        {},
        document.title,
        "/settings"
      );
    }

    /* ========================================================
       MT5 RESULT
    ======================================================== */

    if (mt5Status === "connected") {
      showMessage(
        "success",
        "MetaTrader 5 connected successfully!"
      );

      window.history.replaceState(
        {},
        document.title,
        "/settings"
      );

      setTimeout(() => {
        loadConnectedBrokers();
      }, 500);
    }

    if (mt5Status === "error") {
      showMessage(
        "error",
        messageParam ||
          "MetaTrader 5 connection failed."
      );

      window.history.replaceState(
        {},
        document.title,
        "/settings"
      );
    }
  }, []);

  /* ==========================================================
     OPEN BROKER DETAILS
  ========================================================== */

  const handleSelectBroker = (broker) => {
    setSelectedBroker(broker);

    setShowAddBroker(false);

    setShowBrokerDetails(true);
  };

  /* ==========================================================
     CONNECT BROKER
  ========================================================== */

  const handleConnectBroker = async (broker) => {
    if (!broker) return;

    /* ========================================================
       CTRADER
    ======================================================== */

    if (broker.id === "ctrader") {
      window.location.href =
        `${API_URL}/api/ctrader/connect`;

      return;
    }

    /* ========================================================
       METATRADER 5
    ======================================================== */

    if (broker.id === "mt5") {
      try {
        setLoading(true);

        showMessage(
          "info",
          "Connecting to MetaTrader 5..."
        );

        const res = await fetch(
          `${API_URL}/api/mt5/connect`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

        const data = await res.json();

        console.log(
          "MT5 connection response:",
          data
        );

        if (
          data.success === true &&
          data.connected === true
        ) {
          showMessage(
            "success",
            "MetaTrader 5 connected successfully!"
          );

          setShowBrokerDetails(false);

          setSelectedBroker(null);

          await loadConnectedBrokers();

          return;
        }

        showMessage(
          "error",
          data.message ||
            data.error ||
            "Unable to connect to MetaTrader 5."
        );
      } catch (error) {
        console.error(
          "MT5 connection error:",
          error
        );

        showMessage(
          "error",
          "Unable to connect to MetaTrader 5 Bridge. Make sure the MT5 Bridge is running on port 5001."
        );
      } finally {
        setLoading(false);
      }

      return;
    }

    /* ========================================================
       OTHER BROKERS
    ======================================================== */

    showMessage(
      "info",
      `${broker.name} integration is coming soon.`
    );

    setShowBrokerDetails(false);

    setSelectedBroker(null);
  };

  /* ==========================================================
     CLOSE DETAILS
  ========================================================== */

  const handleCloseDetails = () => {
    setShowBrokerDetails(false);

    setSelectedBroker(null);
  };

  /* ==========================================================
     MESSAGE ICON
  ========================================================== */

  const renderMessageIcon = () => {
    if (message?.type === "success") {
      return <CheckCircle2 size={19} />;
    }

    return <CircleAlert size={19} />;
  };

  /* ==========================================================
     EMPTY STATE
  ========================================================== */

  const renderEmptyState = () => {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Plus
            size={24}
            className="text-violet-600"
          />
        </div>

        <h3 className="mt-5 text-base font-semibold text-slate-900">
          Connect your first broker
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Connect your trading broker to automatically
          synchronize your trades and account activity
          with EdgeFlo.
        </p>

        <button
          onClick={() =>
            setShowAddBroker(true)
          }
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
        >
          <Plus size={17} />

          Add Broker
        </button>
      </div>
    );
  };

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <div className="w-full space-y-6">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Broker Integrations
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Connect and manage your trading broker accounts.
          </p>
        </div>

        {/* ADD BROKER */}

        <button
          onClick={() =>
            setShowAddBroker(true)
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
        >
          <Plus size={17} />

          Add Broker
        </button>

      </div>

      {/* ======================================================
          SECURITY INFO
      ====================================================== */}

      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">

        <ShieldCheck
          size={21}
          className="mt-0.5 shrink-0 text-emerald-600"
        />

        <div>
          <h3 className="text-sm font-semibold text-emerald-900">
            Secure Broker Connection
          </h3>

          <p className="mt-1 text-sm text-emerald-700">
            Broker integrations use secure connection methods
            whenever supported.
          </p>
        </div>

      </div>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : message.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-blue-200 bg-blue-50 text-blue-700"
          }`}
        >
          {renderMessageIcon()}

          <span>
            {message.text}
          </span>
        </div>
      )}

      {/* ======================================================
          CONNECTED BROKERS
      ====================================================== */}

      <div>

        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">
            Connected Brokers
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Select a broker to view and manage its
            connection.
          </p>
        </div>

        {/* LOADING */}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading broker connections...
          </div>
        )}

        {/* NO BROKERS */}

        {!loading &&
          connectedBrokers.length === 0 &&
          renderEmptyState()}

        {/* CONNECTED BROKER CARDS */}

        {!loading &&
          connectedBrokers.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

              {connectedBrokers.map(
                (broker) => (
                  <BrokerCard
                    key={broker.id}
                    broker={broker}
                    connected={true}
                    onClick={
                      handleSelectBroker
                    }
                  />
                )
              )}

            </div>
          )}

      </div>

      {/* ======================================================
          ADD BROKER MODAL
      ====================================================== */}

      <AddBrokerModal
        isOpen={showAddBroker}
        onClose={() =>
          setShowAddBroker(false)
        }
        onSelectBroker={
          handleSelectBroker
        }
      />

      {/* ======================================================
          BROKER DETAILS MODAL
      ====================================================== */}

      <BrokerDetailsModal
        broker={selectedBroker}
        isOpen={showBrokerDetails}
        onClose={handleCloseDetails}
        onConnect={handleConnectBroker}
      />

    </div>
  );
}