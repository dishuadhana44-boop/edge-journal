import { useState } from "react";

import SettingsTabs from "../components/settings/SettingsTabs";

import AccountPage from "../components/settings/AccountPage";
import TradingAccountsPage from "../components/settings/TradingAccountsPage";
import LanguageRegionPage from "../components/settings/LanguageRegionPage";
import NotificationsPage from "../components/settings/NotificationsPage";
import AppearancePage from "../components/settings/AppearancePage";
import SecurityPage from "../components/settings/SecurityPage";
import AboutPage from "../components/settings/AboutPage";

export default function Settings() {

  const [activeTab, setActiveTab] =
    useState("Account");

  return (

    <div className="max-w-[1450px] mx-auto px-2 py-2">

      {/* Header */}
      <div className="mb-4">
      <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
          Settings
          </h1>
  
          <p className="text-gray-500">
          Manage your trading journal and application preferences.
          </p>
        </div>
        </div>
      {/* Tabs */}

      <SettingsTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Current Page */}

      <div className="mt-6">

        {activeTab === "Account" && (
          <AccountPage />
        )}

        {activeTab === "Trading Accounts" && (
         <TradingAccountsPage />
       )}

        {activeTab === "Language" && (
          <LanguageRegionPage />
        )}

        {activeTab === "Notifications" && (
          <NotificationsPage />
        )}

        {activeTab === "Appearance" && (
          <AppearancePage />
        )}

        {activeTab === "Security" && (
          <SecurityPage />
        )}

{activeTab === "Backup & Data" && (
  <div>Coming Soon</div>
)}

        {activeTab === "About" && (
          <AboutPage />
        )}

      </div>

    </div>

  );

}