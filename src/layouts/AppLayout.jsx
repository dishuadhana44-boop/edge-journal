import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useJournal } from "../context/JournalContext";
import {
  JOURNAL_PERSISTENCE_SEVERITY,
  describeJournalPersistence,
} from "../lib/journalPersistenceStatus.js";

// ============================================================
// JOURNAL PERSISTENCE BANNER
// ============================================================
//
// JournalContext already publishes what storage did
// (src/context/JournalContext.jsx:171-182, :241, :251, :280), and
// describeJournalPersistence decides which claims that state can support. This
// component only renders that verdict: the wording is not invented here, and
// dismissing hides the message without touching persistence or stored data.

const BANNER_TONE = {
  [JOURNAL_PERSISTENCE_SEVERITY.ERROR]:
    "bg-red-50 border-red-300 text-red-900",
  [JOURNAL_PERSISTENCE_SEVERITY.WARNING]:
    "bg-amber-50 border-amber-300 text-amber-900",
};

function JournalPersistenceBanner({ persistence }) {

  const view = describeJournalPersistence(persistence);

  // Content, not object identity: a new or different failure must reappear
  // even after an earlier one was dismissed.
  const conditionKey = [
    view.status,
    persistence?.readStatus ?? null,
    persistence?.canPersist ?? null,
    persistence?.writeStatus ?? null,
    persistence?.persisted ?? null,
    view.technicalDetail,
  ].join("|");

  const [dismissedKey, setDismissedKey] = useState(null);

  if (view.showBanner === false) {
    return null;
  }

  if (dismissedKey === conditionKey) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        flex items-start gap-3
        mx-4 mt-4 px-4 py-3
        rounded-xl border
        ${BANNER_TONE[view.severity] ?? BANNER_TONE[JOURNAL_PERSISTENCE_SEVERITY.WARNING]}
      `}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-sm font-bold"
      >
        !
      </span>

      <div className="flex-1">
        <p className="text-sm font-semibold">
          {view.title}
        </p>

        <p className="text-sm">
          {view.detail}
        </p>

        {view.technicalDetail && (
          <p className="mt-1 text-xs opacity-80">
            {view.technicalDetail}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setDismissedKey(conditionKey)}
        className="shrink-0 rounded-lg border border-current px-3 py-1 text-xs font-medium hover:bg-white/60"
      >
        Dismiss
      </button>
    </div>
  );
}

function AppLayout() {

  const [collapsed, setCollapsed] = useState(false);

  const { journalPersistence } = useJournal();

  return (

    <div className="flex min-h-screen bg-gray-50">

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

<main
  className={`
    flex-1
    transition-all
    duration-300
    ${collapsed ? "ml-14" : "ml-34"}
    p-0
    overflow-x-hidden
  `}
>
        <JournalPersistenceBanner
          persistence={journalPersistence}
        />

        <Outlet />
      </main>

    </div>

  );

}

export default AppLayout;