// ============================================================
// BROKER IDENTITY WIRING (Phase 2)
// ============================================================
//
// What this file is: text assertions against the two large React modules that
// the pure identity model in brokerAccountIdentity.js has to be threaded
// through. TradeContext.jsx is ~6,500 lines and mounts a live provider that
// polls brokers on timers, so it cannot be imported by node:test without
// starting that behaviour; the precedent in this repo (journalUiContracts.test.js)
// is to assert the wiring was authored, and this file follows it.
//
// WHAT THIS CANNOT PROVE, stated up front: a region of source text containing
// a guard is not evidence the guard ran. Nothing here mounts React, runs an
// effect, fires a timer or reads browser storage. The guard DECISIONS are
// proven by brokerAccountIdentity.test.js; what is proven here is only that
// TradeContext and the settings pages call them at the places they must be
// called. Running them still needs a browser.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

function source(relativePath) {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

// Bounded slice so an assertion cannot be satisfied by an unrelated line.
function region(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);

  assert.notEqual(start, -1, `${label}: start marker "${startMarker}" is missing`);
  assert.notEqual(end, -1, `${label}: end marker "${endMarker}" is missing`);

  return text.slice(start, end);
}

const tradeContext = source("context/TradeContext.jsx");
const marketContext = source("context/MarketContext.jsx");
const tradingAccountsPage = source("components/settings/TradingAccountsPage.jsx");
const tradingAccountsView = source("components/settings/TradingAccountsView.jsx");
const ctraderService = source("../server/services/ctraderService.js");
const ctraderRoute = source("../server/routes/ctrader.js");

// ============================================================
// THE MODEL IS ACTUALLY IMPORTED
// ============================================================

test("TradeContext reads the shared identity model instead of inferring locally", () => {
  assert.match(
    tradeContext,
    /from\s+["']\.\.\/lib\/brokerAccountIdentity\.js["']/,
    "TradeContext must import the identity module"
  );
});

test("TradingAccountsPage reads the shared identity model", () => {
  assert.match(
    tradingAccountsPage,
    /from\s+["']\.\.\/\.\.\/lib\/brokerAccountIdentity\.js["']/
  );
});

// ============================================================
// MT5 POSITIONS: THE LEAK GUARD
// ============================================================

test("the MT5 positions path validates broker and account identity before accepting live data", () => {
  const positions = region(
    tradeContext,
    "// MT5 SYNC",
    "// MT5 POLLING",
    "syncMT5Positions"
  );

  assert.match(
    positions,
    /resolveActiveAccountData\(\{/,
    "positions must go through the tested verdict"
  );
  assert.match(positions, /broker:\s*["']mt5["']/);
  assert.match(positions, /IGNORING LIVE POSITIONS/);
});

test("the MT5 positions guard is not the old login-only comparison", () => {
  const positions = region(
    tradeContext,
    "// MT5 SYNC",
    "// MT5 POLLING",
    "syncMT5Positions"
  );

  assert.ok(
    !/selectedMT5Login\s*!==\s*liveMT5Login/.test(positions),
    "a login-only guard accepts MT5 data under any account that omitted mt5Login"
  );
});

// ============================================================
// MT5 BALANCE / ACCOUNT SYNC
// ============================================================

test("the MT5 account sync refuses a selection that belongs to another broker", () => {
  const accountSync = region(
    tradeContext,
    "const syncMT5Account =",
    "// MT5 ACCOUNT POLLING",
    "syncMT5Account"
  );

  assert.match(accountSync, /makeAccountIdentity\(/);
  assert.match(accountSync, /!==\s*"mt5"/);
});

test("a live MT5 login only ever binds an MT5 account", () => {
  const matcher = region(
    tradeContext,
    "const matchingAccount =",
    "// AUTOMATIC EDGEFLO ACCOUNT SWITCH",
    "MT5 account matcher"
  );

  assert.ok(
    /makeAccountIdentity\(/.test(matcher),
    "matcher must resolve each candidate's identity, not just its login"
  );
  assert.ok(
    /brokerKey\s*!==\s*"mt5"/.test(matcher),
    "matcher must reject candidates that are not MT5 accounts"
  );
});

// ============================================================
// LATE-RESPONSE GUARD WIRING (Phase 3)
// ============================================================
//
// tradeBrokerSafety.runtime.test.js mounts the real provider and proves the
// stale-response BEHAVIOUR for the account and positions paths and for the
// open-trades/account pollution. Two boundaries stay invisible to that harness:
// the pending-orders persistence effect is never seeded with the previous
// account's data there, and generation independence between the two endpoints
// is not a scenario it runs. These are the text assertions for exactly those
// two boundaries, nothing more.

test("each MT5 trade-state persistence effect is gated by the account that owns the loaded state", () => {
  const effects = [
    region(
      tradeContext,
      "// SAVE ACCOUNT OPEN TRADES",
      "// SAVE ACCOUNT PENDING ORDERS",
      "open trades persistence"
    ),
    region(
      tradeContext,
      "// SAVE ACCOUNT PENDING ORDERS",
      "// SAVE ACCOUNT CLOSED TRADES + ACCOUNT DATA",
      "pending orders persistence"
    ),
    region(
      tradeContext,
      "// SAVE ACCOUNT CLOSED TRADES + ACCOUNT DATA",
      "const balance =",
      "closed trades and account persistence"
    ),
  ];

  for (const effect of effects) {
    assert.match(
      effect,
      /if \(!accountId \|\| accountStateOwnerId !== accountId\) \{/,
      "a persistence effect must bail out until the newly selected account has loaded"
    );
    assert.ok(
      effect.indexOf("accountStateOwnerId !== accountId") <
        effect.indexOf("localStorage.setItem"),
      "the ownership gate must run before any storage write"
    );
    assert.ok(
      /\[\s*[^\]]*accountStateOwnerId,\s*\]/.test(
        effect.slice(effect.lastIndexOf("localStorage.setItem"))
      ),
      "the owner must be in the dependency array, or a load-complete render would skip the write"
    );
  }
});

test("the two MT5 sync paths track their own request generation, not a shared one", () => {
  const accountSync = region(
    tradeContext,
    "const syncMT5Account =",
    "// MT5 ACCOUNT POLLING",
    "syncMT5Account"
  );
  const positionsSync = region(
    tradeContext,
    "// MT5 SYNC",
    "// MT5 POLLING",
    "syncMT5Positions"
  );

  assert.match(
    accountSync,
    /mt5AccountGenerationRef\.current === requestGeneration/,
    "account sync must compare against its own counter"
  );
  assert.match(
    positionsSync,
    /mt5PositionsGenerationRef\.current === requestGeneration/,
    "positions sync must compare against its own counter"
  );

  // One shared counter would let a late response on one endpoint cancel the
  // other endpoint's fresh response.
  assert.ok(
    !accountSync.includes("mt5PositionsGenerationRef"),
    "account sync must not read the positions counter"
  );
  assert.ok(
    !positionsSync.includes("mt5AccountGenerationRef"),
    "positions sync must not read the account counter"
  );

  for (const sync of [accountSync, positionsSync]) {
    assert.ok(
      sync.indexOf("await fetch(") < sync.indexOf("requestIsCurrent()"),
      "staleness must be re-checked after the response, not only before the request"
    );
  }
});

// ============================================================
// cTRADER PUSHED POSITIONS
// ============================================================

test("the cTrader account id is written by one transition every event path goes through", () => {
  assert.equal(
    (marketContext.match(/setCTraderAccountId\(/g) ?? []).length,
    1,
    "only acceptPositionEventAccount may stamp the authenticated cTrader account"
  );

  // 1 definition + 1 call per event family: execution, snapshot, position, close
  assert.equal(
    (marketContext.match(/acceptPositionEventAccount/g) ?? []).length,
    5,
    "every cTrader position event path must take ownership through the transition"
  );

  const execution = region(
    marketContext,
    "function handleExecution(",
    "// HANDLE PRICE",
    "handleExecution"
  );

  assert.ok(
    execution.indexOf("acceptPositionEventAccount(") <
      execution.indexOf("setLastExecution("),
    "ownership must be settled before the last execution is recorded"
  );

  const events = region(
    marketContext,
    "// POSITION SNAPSHOT",
    "} catch (error)",
    "cTrader position events"
  );

  assert.ok(
    events.indexOf("acceptPositionEventAccount(data.accountId)") <
      events.indexOf("replacePositions(snapshot)"),
    "the snapshot must be applied after the cache changes hands"
  );
  assert.ok(
    events.indexOf("acceptPositionEventAccount(data.accountId)") <
      events.indexOf("upsertPosition("),
    "a pushed position must be applied after the cache changes hands"
  );
});
test("pushed cTrader positions cannot land on a non-cTrader selection", () => {
  const sync = region(
    tradeContext,
    "// SYNC cTRADER POSITIONS",
    "// ADD PENDING ORDER",
    "syncBrokerPositions"
  );

  assert.match(
    sync,
    /resolveActiveAccountData\(\{/,
    "the push must use the same tested verdict as the MT5 path"
  );
  assert.match(sync, /broker:\s*["']ctrader["']/);
  assert.match(sync, /IGNORING cTRADER POSITIONS/);
});

test("single pushed cTrader positions also require authenticated account identity", () => {
  const add = region(
    tradeContext,
    "// ADD BROKER POSITION",
    "// UPDATE BROKER POSITION",
    "addBrokerPosition"
  );

  assert.match(add, /authenticatedAccountId = null/);
  assert.match(add, /resolveActiveAccountData\(\{/);
  assert.match(add, /externalId:\s*authenticatedAccountId/);
  assert.ok(
    add.indexOf("if (!verdict.ok)") < add.indexOf("normalizeBrokerPosition("),
    "identity rejection must happen before normalization or state changes"
  );
});

test("normalizeBrokerPosition takes the selected account explicitly", () => {
  assert.match(
    tradeContext,
    /function normalizeBrokerPosition\(\s*position,\s*selectedAccountId = null\s*\)/,
    "the previous single-parameter signature read an out-of-scope identifier"
  );

  assert.ok(
    !/\.map\(\s*normalizeBrokerPosition\s*\)/.test(tradeContext),
    "passing the function straight to .map() would feed it the array index"
  );
});

// ============================================================
// AUTHENTICATED cTRADER EVENT PATH
// ============================================================

test("the service stamps authenticated event identity instead of cached selection", () => {
  const matches = ctraderService.match(
    /accountId:\s*authenticatedAccountIdForEvent\(\{/g
  ) || [];

  assert.equal(matches.length, 2, "position and execution events must both be stamped");
  assert.match(ctraderService, /connected,\s*authenticated,\s*ready:\s*serviceReady/);
});

test("the broadcast route never falls back to the cached active account", () => {
  const broadcast = region(
    ctraderRoute,
    "function broadcastExecution(execution)",
    "// START cTRADER SERVICE",
    "broadcastExecution"
  );

  assert.match(broadcast, /buildExecutionBroadcastMessage\(execution\)/);
  assert.ok(!/getActiveAccount\(/.test(broadcast));
  assert.ok(!/activeAccount\?\.accountId/.test(broadcast));
});

test("MarketContext retains event identity and handles reconciliation snapshots", () => {
  assert.match(marketContext, /cTraderAccountId/);
  assert.match(marketContext, /webSocketMessage\?\.accountId/);
  assert.match(marketContext, /data\.type === "positions_update"/);
  assert.match(marketContext, /data\.data\?\.positions/);
});

test("TradeContext consumes pushed positions with their authenticated account id", () => {
  assert.match(tradeContext, /positions:\s*cTraderPositions/);
  assert.match(tradeContext, /cTraderAccountId/);
  assert.match(
    tradeContext,
    /syncBrokerPositions\(\s*cTraderPositions,\s*cTraderAccountId\s*\)/
  );

  const sync = region(
    tradeContext,
    "// SYNC cTRADER POSITIONS",
    "// ADD PENDING ORDER",
    "syncBrokerPositions"
  );

  assert.match(sync, /authenticatedAccountId = null/);
  assert.match(sync, /externalId:\s*authenticatedAccountId/);
  assert.ok(
    sync.indexOf("if (!verdict.ok)") < sync.indexOf("setOpenTrades("),
    "identity rejection must happen before any position state changes"
  );
});

// ============================================================
// ACCOUNT LIST MIGRATION + DEDUPE
// ============================================================

test("the stored account list is migrated once, on read", () => {
  const load = region(
    tradingAccountsPage,
    "const [accounts, setAccounts] = useState",
    "// SELECTED ACCOUNT",
    "account list load"
  );

  assert.match(load, /migrateTradingAccounts\(/);
});

test("migration is written back only when it changed something", () => {
  const page = tradingAccountsPage;

  assert.match(page, /migration\.changed|result\.changed|\.changed\s*&&/);
  assert.match(page, /migrateTradingAccounts\(/);
});

test("account dedupe requires the broker on both event paths", () => {
  const matches = tradingAccountsPage.match(/findAccountIndex\(/g) || [];

  assert.equal(
    matches.length,
    2,
    "MT5 and cTrader update handlers must both dedupe through the tested matcher"
  );

  assert.ok(
    !/String\(\s*account\.brokerAccountId\s*\)\s*===\s*String\(\s*brokerAccountId\s*\)/.test(
      tradingAccountsPage
    ),
    "the old cTrader dedupe matched on the external id alone"
  );
});

test("account normalization preserves fields owned by other features", () => {
  const normalize = region(
    tradingAccountsPage,
    "function normalizeTradingAccount",
    "// DEFAULT ACCOUNT",
    "normalizeTradingAccount"
  );

  assert.match(normalize, /return\s*\{\s*\.\.\.account/);
});

test("Connect and Sync require an explicit broker instead of assuming MT5 or cTrader", () => {
  const connect = region(
    tradingAccountsPage,
    "const handleConnectBroker =",
    "const handleMT5Connected =",
    "handleConnectBroker"
  );
  const sync = region(
    tradingAccountsPage,
    "const handleSyncAccount =",
    "// CONNECT cTRADER",
    "handleSyncAccount"
  );

  assert.match(connect, /makeAccountIdentity\(/);
  assert.match(connect, /brokerKey === "ctrader"/);
  assert.match(connect, /brokerKey === "mt5"/);
  assert.match(sync, /makeAccountIdentity\(/);
  assert.match(sync, /requestMT5AccountSync/);
  assert.match(sync, /requestCTraderAccountSync/);
});

// ============================================================
// DEFAULT PREFERENCE IS NOT A SELECTION
// ============================================================

// Which account EdgeFlo works on is the global pointer ("selectedAccountId",
// mirrored into localStorage by JournalContext's setter), and Task 10 established
// that an explicit click on a row is the only thing that moves it. Setting the
// default is a different statement - "start here when nothing has been chosen" -
// so the handler that writes it must not touch the pointer, and the pointer's
// writers elsewhere in the page (the delete path, the MT5 connect path) must stay
// outside the slice these tests read.

test("setting the default account does not select an account", () => {
  const setDefault = region(
    tradingAccountsPage,
    "const handleSetDefault =",
    "// SYNC ACCOUNT",
    "handleSetDefault"
  );

  // Already true and stays true: passing it also proves the slice is bounded to
  // this handler, because the page's direct pointer writers sit elsewhere.
  assert.ok(
    !/setSelectedAccountId\s*\(/.test(setDefault),
    "the default handler must not write the global pointer itself"
  );

  // The regression: selecting is how a row click works, and calling it from here
  // would move the working account just because a preference label changed.
  assert.ok(
    !/handleSelectAccount\s*\(/.test(setDefault),
    "setting the default may not route through the row-click selection handler"
  );
});

test("setting the default account still marks exactly one account as the default", () => {
  const setDefault = region(
    tradingAccountsPage,
    "const handleSetDefault =",
    "// SYNC ACCOUNT",
    "handleSetDefault"
  );

  // The half a fix may not lose. Mapping over the whole list with an equality
  // test is the only code in the app that guarantees one starred account and no
  // more, so removing the selection call has to leave it alone.
  assert.match(
    setDefault,
    /accounts\.map\(\s*\(account\)\s*=>\s*\(\{\s*\.\.\.account,\s*isDefault:\s*String\(\s*account\.id\s*\)\s*===\s*String\(\s*id\s*\)/,
    "the default must be set by comparison over the whole list, so every other account is cleared"
  );

  assert.match(
    setDefault,
    /setAccounts\(\s*updated\s*\)/,
    "and the mapped list is what gets stored"
  );
});

test("TradeContext reads legacy data through the shared broker-scoped storage model", () => {
  assert.match(tradeContext, /accountStorageKey,\s*loadAccountScopedData,/);
  assert.match(tradeContext, /return accountStorageKey\(baseKey, identity\)/);
  assert.match(tradeContext, /loadAccountScopedData\(\s*localStorage,/);
  assert.match(tradeContext, /loadAccountStorage\(/);
});

// ============================================================
// NO INVENTED BROKER
// ============================================================

test("the account view stops defaulting an unknown broker to MT5", () => {
  assert.ok(
    !/account\?\.broker\s*\|\|\s*"MT5"/.test(tradingAccountsView),
    "defaulting an unlinked account to MT5 is the identity loss this phase removes"
  );

  assert.match(tradingAccountsView, /brokerKey|makeAccountIdentity/);
});

test("no source file defaults a missing broker to MT5 any more", () => {
  const offenders = [
    "components/settings/TradingAccountsView.jsx",
  ]
    .map((path) => ({ path, text: source(path) }))
    .filter(({ text }) => /\|\|\s*"MT5"/.test(text))
    .map(({ path }) => path);

  assert.deepEqual(offenders, []);
});
