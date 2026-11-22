import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Landmark,
  RefreshCw,
  UserPlus,
} from "lucide-react";

import BrokerCard from "../../brokers/BrokerCard";

import { getBrokerById } from "../../brokers/brokerRegistry";

import AccountWorkspace from "./broker-integration/AccountWorkspace";
import LiveSessionPanel from "./broker-integration/LiveSessionPanel";
import MT5ConnectionModal from "./MT5ConnectionModal";
import BrokerWizardOverlay from "./broker-wizard/BrokerWizardOverlay";

import {
  addCtraderAccount,
  BACKEND_URL_NOT_CONFIGURED_MESSAGE,
  ctraderConnectUrl,
  disconnectCtrader,
  disconnectMt5,
  getBrokerStatus,
  getCtraderStatus,
  getMt5Orders,
  getMt5Positions,
  selectCtraderAccount,
  startCtraderService,
} from "../../services/brokerApi";

import { useJournal } from "../../context/JournalContext";

import {
  canonicalBrokerLabel,
  makeAccountIdentity,
  migrateTradingAccounts,
} from "../../lib/brokerAccountIdentity";

import {
  accountChoices,
  advanceBlock as blockWizardStep,
  authorizeEnvelope,
  brokerSuggestions,
  canMarkConnected,
  createInitialState as createWizardState,
  currentStep as wizardStepOf,
  deserialize as deserializeWizardEnvelope,
  reduce as reduceWizardState,
  searchSavedAccounts,
  serialize as serializeWizardEnvelope,
  STORAGE_KEY as WIZARD_STORAGE_KEY,
  verificationState,
} from "../../lib/brokerWizardModel";

import {
  brokerSnapshot,
  buildAccountRows,
  createEmptySession,
  createRequestGuard,
  CTRADER_BROKER_LABEL_KEY,
  mapBrokerUiStatus,
  mergeBrokerAccount,
  UI_STATUS,
  UI_STATUS_LABEL,
  UNAVAILABLE,
  validateCtraderSession,
  validateMt5Session,
} from "../../lib/brokerIntegrationModel";

// ============================================================
// BROKER INTEGRATION WORKSPACE (Phase 3, Tasks 8 and 9)
// ============================================================
//
// This page owns three things and nothing else: the aggregate status read, the
// broker/account selection, and one validated live session at a time. Every
// number it shows comes from a response the model attributed to the account the
// user selected; anything it cannot attribute renders as Unavailable with the
// model's reason, never as a stored or invented value.
//
// The connection controls are here too: the MT5 modal this app already had, the
// cTrader account switch, the service start, the two disconnects and the tab
// that comes back from an authorization. What is still not here is any way to
// act on a position - the page reads and connects, it never trades.
//
// The cTrader connection wizard is a fourth thing, and it is only a road: the
// dialog under ./broker-wizard renders steps, and every decision about those
// steps comes from the pure model in lib/brokerWizardModel.js. The workflows it
// runs are the ones already in this file, so a wizard cannot reach a broker the
// page could not already reach, and cannot confirm a session the page's own
// validator would refuse.
//
// This page offers one broker. The MT5 modal, workflows and transport below are
// the ones this app already had and are kept whole, but nothing on the screen
// reaches them: no card, no row, no session read and no returning tab selects
// MT5 here. Until a session the validator accepted exists, the page is an entry
// point and an honest status line - a card for a broker nobody connected would
// be an offer this page cannot keep.

const ACCOUNTS_STORAGE_KEY = "tradingAccounts";

// The broker this page offers. Named once so the selection, the return notice
// and the card cannot each decide it differently.
const PAGE_BROKER = "ctrader";

const BROKER_NAME_SOURCE_COPY = "Name you chose in the connection wizard.";

const EMPTY_STATE_COPY =
  "No broker account is connected on this device. Connect an existing cTrader account to read its live session here.";

const STATUS_TONE = Object.freeze({
  [UI_STATUS.loading]: "bg-slate-100 text-slate-600",
  [UI_STATUS.connected]: "bg-emerald-100 text-emerald-700",
  [UI_STATUS.connecting]: "bg-blue-100 text-blue-700",
  [UI_STATUS.disconnected]: "bg-slate-100 text-slate-600",
  [UI_STATUS.unreachable]: "bg-amber-100 text-amber-700",
  [UI_STATUS.error]: "bg-red-100 text-red-700",
});

// ============================================================
// RETURN NOTICES
// ============================================================
//
// A tab arriving back from cTrader or from the MT5 terminal is evidence the user
// finished a round trip, never evidence of a connection. Each sentence says what
// returned; the cards keep saying whatever the aggregate says.

const RETURN_COPY = Object.freeze({
  ctrader: {
    connected:
      "cTrader authorization returned. Select an account and start the service to establish a live connection.",
    error:
      "cTrader authorization did not complete. No account was connected and nothing about your data changed.",
  },
  mt5: {
    connected:
      "The MT5 terminal reported a login. Select an account to read its live session.",
    error:
      "The MT5 terminal could not be reached. Your stored accounts are unchanged.",
  },
});

const CT_DISCONNECT_WARNING =
  "Disconnecting clears the saved cTrader authorization on this device. It does not delete your EdgeFlo accounts or your trade history.";

// ============================================================
// READS
// ============================================================

function readStoredAccounts() {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// The name the user chose in the wizard. It is read as a string and nothing
// else: a record that is not one, or that holds only whitespace, is no choice
// anybody made, so the page falls back to the platform's own name.
function readBrokerLabel() {
  try {
    const raw = window.localStorage.getItem(CTRADER_BROKER_LABEL_KEY);
    const name = typeof raw === "string" ? raw.trim() : "";

    return name === "" ? null : name;
  } catch {
    return null;
  }
}

// The global selection alone never names a broker: a "manual-1" journal account
// must not open a workspace, and neither must an account of a broker this page
// does not offer. Only a cTrader record opens one, and it opens cTrader's.
function deriveInitialSelection(accounts, selectedAccountId) {
  if (!selectedAccountId) {
    return null;
  }

  const record =
    accounts.find(
      (account) =>
        account !== null &&
        typeof account === "object" &&
        account.id === selectedAccountId,
    ) ?? { id: selectedAccountId };

  const identity = makeAccountIdentity(record);

  if (identity.brokerKey !== PAGE_BROKER || !identity.accountId) {
    return null;
  }

  return {
    brokerKey: identity.brokerKey,
    accountId: identity.accountId,
  };
}

// ============================================================
// WORKFLOW CANDIDATES
// ============================================================

// A candidate is a field allowlist, not a response copy. Both answers carry
// things this page has no business storing - an MT5 password and a cTrader
// access token - and the only reliable way to keep them out of storage, out of
// the update event and out of the screen is to never read them off the payload.
function mt5Candidate(payload) {
  const login = payload?.mt5Login;

  if (login === null || login === undefined || login === "") {
    return null;
  }

  return {
    id: `mt5-${login}`,
    accountName: `MT5 Account ${login}`,
    broker: "MT5",
    brokerAccountId: String(login),
    mt5Login: payload.mt5Login,
    mt5Server: payload.mt5Server,
    mt5Connected: true,
    connectionStatus: "connected",
    balance: payload.balance,
    startingBalance: payload.startingBalance,
    equity: payload.equity,
    marginUsed: payload.marginUsed,
    freeMargin: payload.freeMargin,
    currency: payload.currency,
    leverage: payload.leverage,
    floatingPnL: payload.floatingPnL,
    lastSynced: payload.lastSynced,
  };
}

// Whichever shape the route reported the account in, the login is what names it
// locally; the service's own id is not a storage key.
function ctraderCandidate(account) {
  const externalId =
    account?.accountId ?? account?.id ?? account?.ctidTraderAccountId;

  if (externalId === null || externalId === undefined || externalId === "") {
    return null;
  }

  return {
    id: `ctrader-${externalId}`,
    accountName: account.name,
    broker: "cTrader",
    brokerAccountId: String(externalId),
  };
}

// ============================================================
// SAVE, SELECT, REFUSE: WHAT THE BACKEND'S ANSWERS ARE ALLOWED TO SAY HERE
// ============================================================

// A save names the account the backend is on. Whether that is the record it just
// stored is all the confirmation may claim, and it is answered by comparing the
// two ids - never by the `activated` field the route also sends, which agrees
// with the stored id often enough to be believed and is not the selection.
const SAVE_NOTICE_NO_ACTIVE =
  "Account saved. No cTrader account is selected on the backend.";
const SAVE_NOTICE_IS_ACTIVE =
  "Account saved. It is the account the backend already had selected.";
const SAVE_NOTICE_OTHER_ACTIVE =
  "Account saved. The backend still has another account selected.";

// An HTTP 200 with an account in it is not, by itself, a switched service. The
// page says which of the two it has, because the user's next session read
// depends on it.
const CTRADER_SWITCH_UNCONFIRMED_MESSAGE =
  "The cTrader account switch was not confirmed, so nothing was selected.";

// POST /api/ctrader/accounts/select refuses with one of these codes, and each
// asks the user for a different thing. The transport hands on the code and none
// of the upstream prose, so these sentences are the page's own.
const SELECTION_REFUSAL_COPY = {
  explicit_selection_required:
    "No cTrader account is selected. Select one from the list to start a session on it.",
  requested_account_not_available:
    "That cTrader account is not available to this authorization.",
  no_accounts_available:
    "This cTrader authorization has no accounts to select.",
  ambiguous_account_ids:
    "Two saved cTrader accounts share an id, so neither one could be selected.",
  session_not_started:
    "The account was selected, but its live session could not be started.",
  session_identity_unverifiable:
    "The session that came back could not be confirmed as the account that was selected.",
  session_identity_mismatch:
    "The session that came back belongs to a different account than the one that was selected.",
};

// A code this page has not translated leaves the transport's own sentence and
// carries no code: inventing a reason the route did not give would be a claim
// this app cannot stand behind.
function describeRefusal(error) {
  const code = typeof error?.code === "string" ? error.code : null;
  const copy =
    code !== null && Object.hasOwn(SELECTION_REFUSAL_COPY, code)
      ? SELECTION_REFUSAL_COPY[code]
      : undefined;

  return copy === undefined ? { copy: error.message, code: null } : { copy, code };
}

// The account the backend reports itself on, as a string it can be compared to.
function reportedActiveAccountId(payload) {
  const activeAccountId = payload?.activeAccountId;

  return activeAccountId === null ||
    activeAccountId === undefined ||
    activeAccountId === ""
    ? null
    : String(activeAccountId);
}

// The switch is the only request that moves the backend's selection, and it says
// where it landed. An answer that does not name the account asked for cannot be
// told apart from one that merely persisted something, so it confirms nothing.
function switchWasConfirmed(payload, requestedExternalId) {
  const activeAccountId = reportedActiveAccountId(payload);

  if (requestedExternalId === null || requestedExternalId === undefined) {
    return false;
  }

  return activeAccountId !== null && activeAccountId === String(requestedExternalId);
}

// ============================================================
// PAGE
// ============================================================

export default function BrokerIntegrationPage() {
  const { selectedAccountId, setSelectedAccountId } = useJournal();

  /* ==========================================================
     STATE AND GUARDS
  ========================================================== */

  // Two guards on purpose. One shared guard would let a status refresh cancel an
  // in-flight validation cycle, and the cards would then claim a session that was
  // never attributed.
  const statusGuard = useMemo(() => createRequestGuard(), []);
  const sessionGuard = useMemo(() => createRequestGuard(), []);

  const [statusPayload, setStatusPayload] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);

  const [storedAccounts, setStoredAccounts] = useState(readStoredAccounts);

  // The migration is derived, never stored: the array in localStorage may predate
  // the identity fields, and migrateTradingAccounts is idempotent, so the same
  // result is reached on every render without a second state update.
  const migration = useMemo(
    () => migrateTradingAccounts(storedAccounts),
    [storedAccounts],
  );

  const accounts = migration.accounts;

  // The journal selection is read, never written. An account that names a broker
  // this app can trade is the page's starting point; anything else leaves it
  // asking. Seeding state from it means no first render has to be corrected by an
  // effect, and no local choice is ever pushed back into the journal.
  const initialSelection = useMemo(
    () => deriveInitialSelection(accounts, selectedAccountId),
    [accounts, selectedAccountId],
  );

  const [selectedBroker, setSelectedBroker] = useState(
    initialSelection?.brokerKey ?? null,
  );
  const [workspaceAccountId, setWorkspaceAccountId] = useState(
    initialSelection?.accountId ?? null,
  );

  const [session, setSession] = useState(createEmptySession);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState(null);

  // One workflow at a time. While a request is in flight the account rows and
  // every connection control are disabled, because a second click would point
  // the session somewhere else while the first change is still being answered.
  const [busyAction, setBusyAction] = useState(null);

  // The sentence and the diagnostic code travel together as one value: a code
  // left behind from an older refusal would otherwise sit on the element under
  // a message that has nothing to do with it.
  const [actionFailure, setActionFailure] = useState(null);
  const actionError = actionFailure?.copy ?? null;
  const actionCode = actionFailure?.code ?? null;

  // What the last save reported, and nothing more than that. It is its own line
  // because a saved record and the account in use are two facts a user needs to
  // see apart.
  const [saveNotice, setSaveNotice] = useState(null);

  function reportAction(copy, code = null) {
    setActionFailure(copy === null ? null : { copy, code });
  }

  // Whichever account the MT5 modal was opened on - or the draft it is opened
  // with while nothing is selected.
  const [modalAccount, setModalAccount] = useState(null);

  // cTrader disconnect clears a server-side authorization, so it asks first.
  const [pendingDisconnect, setPendingDisconnect] = useState(false);

  // A tab arriving back from an authorization, described but never believed.
  const [notice, setNotice] = useState(null);

  // The wizard is open when this is a state object and closed when it is null,
  // which is the whole difference between the dialog being on the screen and not
  // being able to be. Nothing about the wizard is remembered between the two:
  // closing it discards the step, because a step nobody finished is not progress
  // worth reopening for.
  const [wizard, setWizard] = useState(null);

  // Whether this wizard has run its own verification. Before it has, the page may
  // not hand the dialog a session at all - an older one, or an empty one, would
  // read as a verdict on an account the user has not tried to connect yet.
  const [wizardVerified, setWizardVerified] = useState(false);

  // The broker name the user chose, recorded only once the switch it belongs to
  // succeeded. It is shown beside a validated session and nowhere else, because
  // a name without a connection is a claim about a broker this page has not
  // reached.
  const [brokerLabel, setBrokerLabel] = useState(readBrokerLabel);

  const mountedRef = useRef(false);

  /* ==========================================================
     SESSION LIFECYCLE
  ========================================================== */

  function clearSession() {
    sessionGuard.invalidate();
    setSession(createEmptySession()); // clear on switch
    setSessionError(null);
    setSessionLoading(false);
  }

  async function runMt5Cycle(accountId) {
    const token = sessionGuard.begin({ brokerKey: "mt5", accountId });

    setSessionLoading(true);
    setSessionError(null);

    try {
      const aggregate = await getBrokerStatus();

      if (!sessionGuard.isCurrent(token)) return;

      const positionsResponse = await getMt5Positions(accountId);

      if (!sessionGuard.isCurrent(token)) return;

      const ordersResponse = await getMt5Orders();

      if (!sessionGuard.isCurrent(token)) return;

      // The terminal can log into another account between the positions read and
      // the pending-order read, so the round is only attributable if the identity
      // still matches the one the round started on.
      const postOrdersAggregate = await getBrokerStatus();

      if (!sessionGuard.isCurrent(token)) return; // commit

      setSession(
        validateMt5Session({
          accounts,
          selectedAccountId: accountId,
          aggregate,
          positionsResponse,
          ordersResponse,
          postOrdersAggregate,
          synchronizedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      if (!sessionGuard.isCurrent(token)) return;

      setSession(createEmptySession());
      setSessionError(error.message);
    } finally {
      if (sessionGuard.isCurrent(token)) {
        setSessionLoading(false);
      }
    }
  }

  async function runCtraderCycle(accountId) {
    const ctraderToken = sessionGuard.begin({
      brokerKey: "ctrader",
      accountId,
    });

    setSessionLoading(true);
    setSessionError(null);

    try {
      const aggregate = await getBrokerStatus();

      if (!sessionGuard.isCurrent(ctraderToken)) return;

      const serviceResponse = await getCtraderStatus();

      if (!sessionGuard.isCurrent(ctraderToken)) return; // commit service round

      setSession(
        validateCtraderSession({
          accounts,
          selectedAccountId: accountId,
          aggregate,
          serviceResponse,
          synchronizedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      if (!sessionGuard.isCurrent(ctraderToken)) return;

      setSession(createEmptySession());
      setSessionError(error.message);
    } finally {
      if (sessionGuard.isCurrent(ctraderToken)) {
        setSessionLoading(false);
      }
    }
  }

  function startSession(brokerKey, accountId) {
    clearSession();

    if (brokerKey === "mt5") {
      void runMt5Cycle(accountId);

      return;
    }

    if (brokerKey === "ctrader") {
      void runCtraderCycle(accountId);
    }
  }

  /* ==========================================================
     AGGREGATE STATUS
  ========================================================== */

  async function refreshStatus() {
    const token = statusGuard.begin({ scope: "status" });

    setStatusPayload(null);
    setStatusLoading(true);
    setStatusError(null);

    try {
      const payload = await getBrokerStatus();

      if (!statusGuard.isCurrent(token)) return; // commit status

      setStatusPayload(payload); // commit payload
    } catch (error) {
      if (!statusGuard.isCurrent(token)) return;

      setStatusError(error.message);
    } finally {
      if (statusGuard.isCurrent(token)) {
        setStatusLoading(false);
      }
    }
  }

  /* ==========================================================
     MOUNT
  ========================================================== */

  useEffect(() => {
    if (mountedRef.current) return;

    mountedRef.current = true;

    // Opening this page never rewrites stored data. A legacy array gains the
    // derived identity fields and is persisted once - the only side effect this
    // page performs on an external system at mount.
    if (migration.changed) {
      window.localStorage.setItem(
        ACCOUNTS_STORAGE_KEY,
        JSON.stringify(migration.accounts),
      );
    }

    void refreshStatus();

    // The selection itself is already the seeded state, so the only thing left to
    // do at mount is read the session it points at.
    if (initialSelection) {
      startSession(initialSelection.brokerKey, initialSelection.accountId);
    }
  }, []);

  /* ==========================================================
     BROKER TAB RETURNS
  ========================================================== */

  // The address is read once, on the way in: a return selects the broker whose
  // authorization came back, and nothing more. No account is chosen, no session
  // is opened and no status is overwritten, because a tab that came back is not
  // a connection. Only the broker this page offers is heard: a parameter naming
  // another one describes a round trip this screen has no way to describe.
  useEffect(() => {
    const { search } = window.location;

    if (!search) {
      return;
    }

    const params = new URLSearchParams(search);

    const brokerKey = params.has(PAGE_BROKER) ? PAGE_BROKER : null;

    if (brokerKey) {
      const copy = RETURN_COPY[brokerKey];

      setSelectedBroker(brokerKey);
      setNotice({
        brokerKey,
        // Only a stated success earns the encouraging sentence; anything else
        // this app did not complete is reported as not completed.
        copy: params.get(brokerKey) === "connected" ? copy.connected : copy.error,
      });
    }

    // The parameters have done their one job. Leaving them in the address would
    // make a later refresh repeat an announcement about a round trip that
    // finished a while ago.
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  /* ==========================================================
     WIZARD RESUME
  ========================================================== */

  // A wizard that handed the browser to cTrader had its React state destroyed by
  // the trip, so the only thing left of it is the record it wrote on the way out.
  // Finding a fresh one reopens the dialog at the step the record describes;
  // finding nothing, or something unreadable, leaves the page exactly as it would
  // have been had the wizard never existed.
  //
  // The record is consumed as it is read. A round trip that already finished must
  // not reopen its wizard on every later load.
  useEffect(() => {
    let raw;

    try {
      raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
    } catch {
      return;
    }

    const result = deserializeWizardEnvelope(raw, { now: Date.now() });

    if (!result.ok) {
      return;
    }

    window.localStorage.removeItem(WIZARD_STORAGE_KEY);

    setWizard(
      reduceWizardState(createWizardState(), {
        type: "RESUME",
        envelope: result.state,
      }),
    );
  }, []);

  /* ==========================================================
     SELECTION
  ========================================================== */

  function handleSelectCard(broker) {
    const brokerKey = broker?.id === PAGE_BROKER ? PAGE_BROKER : null;

    clearSession();

    setSelectedBroker(brokerKey);
    setWorkspaceAccountId(null);
  }

  // An explicit row click is the only thing that moves the global account
  // selection, and re-clicking the account already open changes nothing.
  function handleSelectRow(row) {
    const accountId = row?.identity?.accountId;

    if (!accountId || accountId === workspaceAccountId || busyAction) {
      return;
    }

    // A cTrader account is not chosen by this app writing down a preference: the
    // local service has to switch to it first, and only what it answers can be
    // read back as the account in use.
    if (selectedBroker === "ctrader") {
      void selectCtraderRow(row, accountId);

      return;
    }

    setSelectedAccountId(accountId);

    setWorkspaceAccountId(accountId);

    startSession(selectedBroker, accountId);
  }

  function handleRefresh() {
    void refreshStatus();

    if (selectedBroker && workspaceAccountId) {
      startSession(selectedBroker, workspaceAccountId);
    }
  }

  /* ==========================================================
     CONNECTION WORKFLOWS
  ========================================================== */

  // One operation, one answer, and only then a change to this device. A workflow
  // that was refused - or that never reached the server - stores nothing,
  // announces nothing and selects nothing, because a request that did not
  // succeed describes an account that did not change.
  async function runWorkflow(name, operation) {
    setBusyAction(name);
    reportAction(null);
    setSaveNotice(null);

    try {
      const data = await operation();

      return { ok: true, data };
    } catch (error) {
      const refusal = describeRefusal(error);

      reportAction(refusal.copy, refusal.code);

      return { ok: false, data: null };
    } finally {
      setBusyAction(null);
    }
  }

  // The whole list is written back, not a patch. That is what leaves an account
  // belonging to the other broker, a manual account and every field this page
  // has never heard of exactly as the user had them.
  function persistAccounts(nextAccounts) {
    setStoredAccounts(nextAccounts);

    window.localStorage.setItem(
      ACCOUNTS_STORAGE_KEY,
      JSON.stringify(nextAccounts),
    );
  }

  // The contexts that own the journal data listen for the record as it now
  // stands; the broker decides which of the two events fires.
  function announceAccount(brokerKey, account) {
    window.dispatchEvent(
      brokerKey === "mt5"
        ? new CustomEvent("mt5AccountUpdated", { detail: account })
        : new CustomEvent("ctraderAccountUpdated", { detail: account }),
    );
  }

  // Write the record and tell the contexts that own the journal data. This is
  // the whole of what a response that only stored something may change here.
  function commitStoredAccount({ brokerKey, candidate }) {
    const { accounts: next, account, changed } = mergeBrokerAccount(
      accounts,
      candidate,
    );

    if (!account) {
      return null;
    }

    if (changed) {
      persistAccounts(next);
    }

    announceAccount(brokerKey, account);

    return account;
  }

  function commitAccountChange({ brokerKey, candidate, accountId }) {
    const account = commitStoredAccount({ brokerKey, candidate });

    if (!account) {
      return null;
    }

    const selected = accountId ?? account.id;

    setSelectedAccountId(selected);
    setWorkspaceAccountId(selected);

    // The instruction this clears said "select an account", and that step has
    // now been taken and confirmed by the service. Only the cTrader round trip
    // ever writes the notice, so only its confirmed switch ends it.
    if (brokerKey === "ctrader") {
      setNotice(null);
    }

    return account;
  }

  // ----------------------------------------------------------
  // MT5
  // ----------------------------------------------------------

  function handleConnect() {
    if (busyAction) {
      return;
    }

    if (selectedBroker === "ctrader") {
      // OAuth happens in the browser, not in this page: sending the user off is
      // the whole operation, and any request fired alongside it would be a
      // claim about a connection this app has not been given.
      startCtraderAuthorization();

      return;
    }

    setModalAccount(mt5ModalTarget());
  }

  // The single road out of this tab to the cTrader authorization page. The card's
  // Connect and the wizard's Continue both reach the browser through here, so a
  // build with no backend URL cannot produce a second, unguarded way of leaving.
  //
  // onBeforeNavigate runs only once the URL is in hand and immediately before the
  // tab goes, which is what lets a caller record a resume step without ever
  // recording one for a hand-off that never started.
  function startCtraderAuthorization(onBeforeNavigate = null) {
    const connectUrl = ctraderConnectUrl();

    if (!connectUrl) {
      reportAction(BACKEND_URL_NOT_CONFIGURED_MESSAGE);

      return false;
    }

    onBeforeNavigate?.();

    window.location.href = connectUrl; // authorize

    return true;
  }

  // The modal names the account it is connecting, so it needs one. With nothing
  // selected the user is attaching a login this app has not recorded yet, and a
  // draft keeps the request contract whole without letting an unconfirmed
  // account reach storage.
  function mt5ModalTarget() {
    const selected = accounts.find(
      (account) => account.id === workspaceAccountId,
    );

    if (selected) {
      return selected;
    }

    return {
      id: `draft-mt5-${Date.now().toString(36)}`,
      accountName: "MT5 Account",
      broker: "MT5",
    };
  }

  function handleMt5Connected(payload) {
    const candidate = mt5Candidate(payload);

    if (!candidate) {
      return;
    }

    const account = commitAccountChange({
      brokerKey: "mt5",
      candidate,
    });

    if (!account) {
      return;
    }

    startSession("mt5", account.id);
  }

  function handleMt5ModalClose() {
    setModalAccount(null);

    // Whatever the modal just confirmed, the cards have to say it too.
    void refreshStatus();
  }

  async function runMt5Disconnect() {
    const result = await runWorkflow("mt5-disconnect", () => disconnectMt5());

    if (!result.ok) {
      return;
    }

    markDisconnected("mt5");
  }

  async function runCtraderDisconnect() {
    // The confirmation closes as the request leaves: what the user agreed to is
    // now in flight, and a refusal does not put the question back up.
    setPendingDisconnect(false);

    const result = await runWorkflow("ctrader-disconnect", () =>
      disconnectCtrader(),
    );

    if (!result.ok) {
      return;
    }

    markDisconnected("ctrader");
  }

  // ----------------------------------------------------------
  // SHARED AFTER A CONFIRMED CHANGE
  // ----------------------------------------------------------

  function handleDisconnect() {
    if (busyAction) {
      return;
    }

    if (selectedBroker === "ctrader") {
      setPendingDisconnect(true); // confirm first

      return;
    }

    void runMt5Disconnect();
  }

  // A disconnect ends a session. It deletes no account, which is why this walks
  // the list instead of filtering it: a record of another broker keeps its very
  // own object, so a stray field cannot be dropped on its way past.
  function markDisconnected(brokerKey) {
    // The chosen name belonged to the connection that just ended. Nothing is
    // written when there was no name, so a disconnect of an unlabelled session
    // leaves storage exactly as it found it.
    if (brokerKey === PAGE_BROKER && brokerLabel !== null) {
      setBrokerLabel(null);
      window.localStorage.removeItem(CTRADER_BROKER_LABEL_KEY);
    }

    const changed = [];

    const next = accounts.map((account) => {
      if (makeAccountIdentity(account).brokerKey !== brokerKey) {
        return account;
      }

      const record = {
        ...account,
        ...(brokerKey === "mt5" ? { mt5Connected: false } : {}),
        connectionStatus: "disconnected",
      };

      changed.push(record);

      return record;
    });

    if (changed.length === 0) {
      return;
    }

    persistAccounts(next);

    for (const record of changed) {
      announceAccount(brokerKey, record);
    }

    clearSession();

    void refreshStatus();
  }

  // ----------------------------------------------------------
  // cTRADER
  // ----------------------------------------------------------

  async function selectCtraderRow(row, accountId) {
    const externalId = row?.identity?.externalId;

    const result = await runWorkflow("ctrader-select", () =>
      selectCtraderAccount(externalId),
    );

    if (!result.ok) {
      return;
    }

    applyCtraderAccount(result.data, accountId, externalId);
  }

  async function handleAddCtraderAccount({ accountId, accountName }) {
    const result = await runWorkflow("ctrader-setup", () =>
      addCtraderAccount({ accountId, accountName }),
    );

    if (!result.ok) {
      return;
    }

    applySavedCtraderAccount(result.data);
  }

  // A save stores a record. It selects nothing, starts no session and reads no
  // data, because an account the user has not chosen cannot become the one the
  // journal reads - and the numbers on the screen would then belong to an
  // account nobody asked for. What is true afterwards is what the response
  // reported, which is the backend's own active account and may well be another
  // one.
  function applySavedCtraderAccount(payload) {
    const candidate = ctraderCandidate(payload?.account);

    if (!candidate) {
      return;
    }

    const account = commitStoredAccount({
      brokerKey: "ctrader",
      candidate,
    });

    if (!account) {
      return;
    }

    const activeAccountId = reportedActiveAccountId(payload);

    setSaveNotice(
      activeAccountId === null
        ? SAVE_NOTICE_NO_ACTIVE
        : activeAccountId === candidate.brokerAccountId
          ? SAVE_NOTICE_IS_ACTIVE
          : SAVE_NOTICE_OTHER_ACTIVE,
    );
  }

  // The switch is what makes an account the one in use, and the session read
  // that follows reports the account the user asked for - but only when the
  // answer says it is on that account. A success that does not name it is a
  // record that was persisted, not a connection that moved, so nothing here
  // changes.
  function applyCtraderAccount(payload, accountId, requestedExternalId) {
    if (!switchWasConfirmed(payload, requestedExternalId)) {
      reportAction(CTRADER_SWITCH_UNCONFIRMED_MESSAGE);

      return;
    }

    const candidate = ctraderCandidate(
      payload?.activeAccount ?? payload?.account,
    );

    if (!candidate) {
      return;
    }

    const account = commitAccountChange({
      brokerKey: "ctrader",
      candidate,
      accountId,
    });

    if (!account) {
      return;
    }

    startSession("ctrader", account.id);
  }

  async function handleStartService() {
    const result = await runWorkflow("ctrader-service", () =>
      startCtraderService(),
    );

    if (!result.ok) {
      return;
    }

    // "cTrader service is ready" is what the route says about the process it
    // started. Nothing here repeats it: the only honest answer to a start is a
    // fresh aggregate read, which may or may not say authenticated.
    void refreshStatus();
  }

  /* ==========================================================
     cTRADER CONNECTION WIZARD
  ========================================================== */

  // The dialog holds no decisions. Every step it shows, every reason it gives for
  // staying put and every word it uses about a session comes from the shared
  // model, so this page - and not the wizard - remains the only place a broker
  // request is made or a record is written.

  function openWizard() {
    if (busyAction) {
      return;
    }

    setWizardVerified(false);
    reportAction(null);

    setWizard(createWizardState());
  }

  // Closing discards the step. A wizard the user left halfway is not a round trip
  // in progress, and only the hand-off to cTrader is allowed to write a resume
  // record.
  function closeWizard() {
    setWizard(null);
    setWizardVerified(false);
  }

  function wizardDispatch(action) {
    setWizard((state) => (state ? reduceWizardState(state, action) : state));
  }

  // The introduction is the edge of the tab. Continuing from it is the card's own
  // hand-off, with one addition: the step the user was standing on is written
  // immediately before the browser leaves, and only if the backend actually gave
  // a URL to leave for.
  function handleWizardAuthorize() {
    if (busyAction) {
      return;
    }

    const block = blockWizardStep(wizard);

    if (block !== null) {
      reportAction(block);

      return;
    }

    const envelope = authorizeEnvelope(wizard, { now: Date.now() });

    startCtraderAuthorization(() => {
      window.localStorage.setItem(
        WIZARD_STORAGE_KEY,
        serializeWizardEnvelope(envelope),
      );
    });
  }

  // The last step is not a new workflow. This is the same switch the account rows
  // make - the same request, the same merge, the same announcement - so a wizard
  // that finished cannot describe an account the page behind it would disagree
  // about.
  async function handleWizardConnectAccount(externalId) {
    if (busyAction) {
      return;
    }

    const block = blockWizardStep(wizard);

    if (block !== null) {
      reportAction(block);

      return;
    }

    // From here the dialog is entitled to read the session, because the session
    // is now about to be read for the account the user just chose.
    setWizardVerified(true);

    const result = await runWorkflow("ctrader-select", () =>
      selectCtraderAccount(externalId),
    );

    if (!result.ok) {
      return;
    }

    // The name is recorded only now, because only now did the switch it belongs
    // to succeed. It is the user's own choice of words, stored as that and
    // nothing more - no account id, no status, no token.
    const chosenName =
      typeof wizard?.brokerName === "string" ? wizard.brokerName.trim() : "";

    if (chosenName !== "") {
      setBrokerLabel(chosenName);
      window.localStorage.setItem(CTRADER_BROKER_LABEL_KEY, chosenName);
    }

    applyCtraderAccount(result.data, null, externalId);
  }

  /* ==========================================================
     DERIVED
  ========================================================== */

  const rows = buildAccountRows({
    storedAccounts: accounts,
    brokerKey: selectedBroker,
    snapshot: statusPayload,
  });

  const hasWorkspace = selectedBroker !== null;
  const hasSession = selectedBroker !== null && workspaceAccountId !== null;

  // The status line is the aggregate's own word for the cTrader service, and it
  // is on screen whether or not anything is connected: "still reading" and
  // "nothing here" are different states and the page may not collapse them.
  const ctraderStatus = mapBrokerUiStatus({
    snapshot: statusPayload,
    brokerKey: PAGE_BROKER,
    loading: statusLoading,
    error: statusError,
  });

  // The connected summary is a stronger claim than the status line, so it needs
  // the stronger evidence: a session this page's own validator accepted for the
  // account now selected. An aggregate that says connected is not that evidence.
  const ctraderConnected =
    selectedBroker === PAGE_BROKER && canMarkConnected(session);

  const connectedRow = ctraderConnected
    ? rows.find(
        (row) =>
          row.isLiveSession && row.identity.accountId === workspaceAccountId,
      ) ?? null
    : null;

  const connectedBrokerName =
    brokerLabel ?? canonicalBrokerLabel(PAGE_BROKER) ?? "cTrader";

  // Once a workspace is open the card is its header, and it stays there even when
  // the account inside it is unselected. A card that removes itself the moment it
  // is pressed takes the rows, the service line and the connection controls away
  // with it, which leaves the user unable to reach the account they were sent
  // here to choose.
  const showBrokerCard = ctraderConnected || hasWorkspace;

  // What the dialog may show, all of it read off state this page already holds:
  // the accounts on this device, the aggregate already fetched, and the session
  // only once the wizard itself has had one verified.
  const wizardMatches = wizard
    ? searchSavedAccounts({ accounts, query: wizard.query })
    : [];

  const wizardSuggestions = wizard ? brokerSuggestions({ query: wizard.query }) : [];

  const wizardChoices = wizard
    ? accountChoices({ snapshot: statusPayload })
    : { source: "none", isLive: false, choices: [] };

  const wizardSession = wizardVerified ? session : null;

  const wizardVerification = verificationState({
    session: wizardSession,
    loading: sessionLoading || statusLoading,
    statusError,
    actionError,
  });

  const wizardBlock = wizard ? blockWizardStep(wizard) : null;

  const wizardStepIndex = wizardStepOf({
    screen: wizard?.screen ?? "search",
    verification: wizardVerification,
  });

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="space-y-6">
      {/* =========================================
          PAGE HEADER
      ========================================= */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Broker Integrations
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Connect and manage your trading accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-action="refresh"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
          >
            <RefreshCw size={16} />

            Refresh
          </button>

          {/* The wizard is a road to the workflows this page already has, so it
              opens from the page and never from a broker card. Where the road
              sits follows the card: before a workspace is open it is the empty
              state's own button, once one is open it is in the header. The page
              carries exactly one of the two at every moment. */}
          {showBrokerCard ? (
            <button
              type="button"
              data-action="connect-existing"
              onClick={openWizard}
              disabled={busyAction !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus size={16} />

              Connect existing account
            </button>
          ) : null}
        </div>
      </div>

      {/* =========================================
          CONNECTION STATE
      ========================================= */}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {`${canonicalBrokerLabel(PAGE_BROKER) ?? "cTrader"} service`}
        </span>

        <span
          data-connection-state={ctraderStatus}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            STATUS_TONE[ctraderStatus] ?? STATUS_TONE[UI_STATUS.loading]
          }`}
        >
          {UI_STATUS_LABEL[ctraderStatus] ?? UI_STATUS_LABEL[UI_STATUS.loading]}
        </span>
      </div>

      {statusError ? (
        <p
          role="alert"
          data-status-alert
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {statusError}
        </p>
      ) : null}

      {/* =========================================
          RETURN FROM AN AUTHORIZATION
      ========================================= */}

      {notice ? (
        <p
          data-oauth-notice={notice.brokerKey}
          className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800"
        >
          {notice.copy}
        </p>
      ) : null}

      {/* =========================================
          WORKFLOW RESULT
      ========================================= */}

      {actionError ? (
        <p
          role="alert"
          data-action-error
          data-action-code={actionCode}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </p>
      ) : null}

      {/* A save is its own line because it is its own fact: a record this device
          now has, next to whichever account the service is actually on. */}
      {saveNotice ? (
        <p
          data-save-notice
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {saveNotice}
        </p>
      ) : null}

      {/* =========================================
          THE CONNECTED BROKER
      ========================================= */}

      {ctraderConnected ? (
        <div
          data-connected-broker
          className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-violet-50 shadow-sm"
        >
          <div className="flex items-center gap-3 border-b border-emerald-100 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <CheckCircle2 size={20} />
            </span>

            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">
                Connected broker
              </h3>

              <p className="mt-0.5 text-xs text-slate-500">
                {"This account's live session is validated."}
              </p>
            </div>
          </div>

          <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Broker
              </dt>

              <dd
                data-connected-broker-name
                className="mt-1 truncate text-sm font-semibold text-slate-900"
              >
                {connectedBrokerName}
              </dd>

              {brokerLabel !== null ? (
                <dd
                  data-broker-name-source
                  className="mt-0.5 text-xs text-slate-500"
                >
                  {BROKER_NAME_SOURCE_COPY}
                </dd>
              ) : null}
            </div>

            <div className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Platform
              </dt>

              <dd
                data-connected-platform
                className="mt-1 truncate text-sm font-semibold text-slate-900"
              >
                {canonicalBrokerLabel(PAGE_BROKER) ?? "cTrader"}
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </dt>

              <dd
                data-connected-status
                className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
              >
                {UI_STATUS_LABEL[UI_STATUS.connected]}
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Account
              </dt>

              <dd
                data-connected-account
                className="mt-1 truncate text-sm font-semibold tabular-nums text-slate-900"
              >
                {connectedRow?.identity?.externalId ?? UNAVAILABLE}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {/* =========================================
          BROKER CARD
      ========================================= */}

      {showBrokerCard ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div data-broker-card={PAGE_BROKER}>
            <BrokerCard
              broker={getBrokerById(PAGE_BROKER)}
              snapshot={brokerSnapshot(statusPayload, PAGE_BROKER)}
              uiStatus={ctraderStatus}
              selected={selectedBroker === PAGE_BROKER}
              onSelect={handleSelectCard}
            />
          </div>
        </div>
      ) : (
        <div
          data-broker-empty
          className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <Landmark size={26} />
          </span>

          <h3 className="mt-4 text-base font-semibold text-slate-900">
            Add a broker account
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            {EMPTY_STATE_COPY}
          </p>

          <button
            type="button"
            data-action="connect-existing"
            onClick={openWizard}
            disabled={busyAction !== null}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus size={16} />

            Connect existing account
          </button>
        </div>
      )}

      {/* =========================================
          WORKSPACE
      ========================================= */}

      {hasWorkspace ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <AccountWorkspace
              brokerKey={selectedBroker}
              rows={rows}
              selectedAccountId={workspaceAccountId}
              onSelectAccount={handleSelectRow}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onStartService={handleStartService}
              onAddCtraderAccount={handleAddCtraderAccount}
              busy={busyAction !== null}
              error={sessionError}
            />

            {/* =========================================
                cTRADER DISCONNECT CONFIRMATION
            ========================================= */}

            {pendingDisconnect ? (
              <div
                data-disconnect-confirmation
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />

                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-amber-900">
                      {`Disconnect ${canonicalBrokerLabel("ctrader") ?? "cTrader"}?`}
                    </h4>

                    <p
                      data-disconnect-warning
                      className="mt-1 text-sm text-amber-800"
                    >
                      {CT_DISCONNECT_WARNING}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-action="confirm-disconnect"
                        onClick={() => void runCtraderDisconnect()}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
                      >
                        Confirm disconnect
                      </button>

                      <button
                        type="button"
                        data-action="cancel-disconnect"
                        onClick={() => setPendingDisconnect(false)}
                        className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:border-amber-300"
                      >
                        Keep connected
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {hasSession ? (
            <div className="space-y-3">
              {sessionError ? (
                <p
                  role="alert"
                  data-session-error
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {sessionError}
                </p>
              ) : null}

              <LiveSessionPanel
                brokerKey={selectedBroker}
                session={session}
                loading={sessionLoading}
              />
            </div>
          ) : (
            <p
              data-prompt="account"
              className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500"
            >
              Select one of the accounts above to read its live session.
            </p>
          )}
        </div>
      ) : null}

      {/* =========================================
          MT5 CONNECTION MODAL
      ========================================= */}

      {modalAccount ? (
        <MT5ConnectionModal
          isOpen
          account={modalAccount}
          onClose={handleMt5ModalClose}
          onConnected={handleMt5Connected}
        />
      ) : null}

      {/* =========================================
          cTRADER CONNECTION WIZARD
      ========================================= */}

      {wizard ? (
        <BrokerWizardOverlay
          screen={wizard.screen}
          brokerName={wizard.brokerName}
          query={wizard.query}
          stepIndex={wizardStepIndex}
          matches={wizardMatches}
          suggestions={wizardSuggestions}
          choices={wizardChoices.choices}
          accountSource={wizardChoices.source}
          accountId={wizard.accountId}
          verification={wizardVerification}
          session={wizardSession}
          busy={busyAction !== null}
          error={actionError}
          canAdvance={wizardBlock === null}
          blockReason={wizardBlock}
          onQuery={(query) => wizardDispatch({ type: "QUERY", query })}
          onPickSaved={(match) =>
            wizardDispatch({
              type: "PICK_SAVED",
              brokerName: match?.brokerName ?? match?.externalId,
            })
          }
          onContinue={() => wizardDispatch({ type: "CONTINUE" })}
          onBack={() => wizardDispatch({ type: "BACK" })}
          onClose={closeWizard}
          onAuthorize={handleWizardAuthorize}
          onSelectAccount={(accountId) =>
            wizardDispatch({ type: "SELECT_ACCOUNT", accountId })
          }
          onConnectAccount={handleWizardConnectAccount}
          onRetry={handleRefresh}
        />
      ) : null}
    </div>
  );
}
