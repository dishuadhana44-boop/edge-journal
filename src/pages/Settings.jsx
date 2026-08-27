import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

import SettingsTabs from "../components/settings/SettingsTabs";

import AccountPage from "../components/settings/AccountPage";
import TradingAccountsPage from "../components/settings/TradingAccountsPage";
import TradingPreferencesPage from "../components/settings/TradingPreferencesPage";
import BrokerIntegrationPage from "../components/settings/BrokerIntegrationPage";
import LanguageRegionPage from "../components/settings/LanguageRegionPage";
import NotificationsPage from "../components/settings/NotificationsPage";
import AppearancePage from "../components/settings/AppearancePage";
import SecurityPage from "../components/settings/SecurityPage";
import AboutPage from "../components/settings/AboutPage";

import PageHeader from "../components/common/PageHeader";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("Account");
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hasStatus = searchParams.get("status");
    const hasCode = localStorage.getItem("ctrader_code");

    if (hasStatus || hasCode) {
      setActiveTab("Broker Integration");
    }
  }, [location]);

  return (
    <div className="max-w-[1450px] mx-auto px-2 py-2">
      {/* Header */}
      <div>
        <PageHeader
          title="Settings"
          subtitle="Manage your trading journal preferences and configuration."
          icon="settings"
        />
      </div>

      {/* Tabs */}
      <SettingsTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Current Page */}
      <div className="mt-6">
        {activeTab === "Account" && <AccountPage />}

        {activeTab === "Trading Accounts" && <TradingAccountsPage />}

        {activeTab === "Trading Preferences" && <TradingPreferencesPage />}

        {activeTab === "Broker Integration" && <BrokerIntegrationPage />}

        {activeTab === "Language" && <LanguageRegionPage />}

        {activeTab === "Notifications" && <NotificationsPage />}

        {activeTab === "Appearance" && <AppearancePage />}

        {activeTab === "Security" && <SecurityPage />}

        {activeTab === "Backup & Data" && <div>Coming Soon</div>}

        {activeTab === "About" && <AboutPage />}
      </div>
    </div>
  );
}