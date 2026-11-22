# Phase 3 Broker Integration UI Design — Inline Broker Workspace

**Status:** Approved, including revised Section 9  
**Scope:** Phase 3 only  
**Implementation authorization:** Separate implementation-plan approval required

## 1. Architecture and file scope

The page will use page-local orchestration state for broker status and validated session data. Existing large contexts will receive only the approved safety corrections.

### UI files

- `src/components/settings/BrokerIntegrationPage.jsx` — rebuilt as the orchestration layer for broker selection, refresh lifecycle, account selection, connection actions, errors, and OAuth result handling.
- `src/brokers/BrokerCard.jsx` — reworked to display genuine backend status and broker-specific compatibility rather than `connected={true}`.
- Create `src/components/settings/broker-integration/AccountWorkspace.jsx` — broker-filtered account list, active-account selection, connection actions, account provenance, and empty states.
- Create `src/components/settings/broker-integration/LiveSessionPanel.jsx` — metrics, synchronization time, open positions, pending orders, and unavailable states.
- `src/pages/Settings.jsx` — recognize `ctrader` and `mt5` query parameters so OAuth returns open the Broker Integration tab.

### Data and identity files

- Create `src/services/brokerApi.js` — centralize the existing API base URL, response validation, endpoint paths, and exact request bodies.
- Create `src/lib/brokerIntegrationModel.js` — pure status mapping, broker/account filtering, account merging, metric formatting, request-generation guards, and validated-session selection.
- `src/lib/brokerAccountIdentity.js` — targeted corrections for unsupported explicit brokers and missing live identities.

### Shared safety corrections

- `src/context/TradeContext.jsx`
- `src/context/MarketContext.jsx`

The existing MT5 connection modal will be reused unchanged unless testing exposes a concrete integration defect. `AddBrokerModal` and `BrokerDetailsModal` will not be deleted.

No new backend endpoint or production backend change is planned.

## 2. Broker overview

Two cards will always be present: MetaTrader 5 and cTrader. Disconnected brokers will no longer disappear into an empty state.

Each card displays:

- Broker name and connection method.
- Genuine connection status.
- Verified active external account ID, when available.
- Account-list provenance: live, cached, unavailable, or not enumerable.
- Execution compatibility and material limitations.
- A selected-card indicator for the active workspace.

### Status mapping

| Backend evidence | UI status |
| --- | --- |
| Initial request pending | Loading |
| `connection.state === "connected"` with authenticated identity requirements satisfied | Connected |
| `connection.state === "authenticating"` | Connecting |
| `connection.state === "error"` or adapter failure | Error |
| `serviceReachable === false` or unreachable/unknown transport state | Unreachable |
| Remaining explicit disconnected states | Disconnected |

Saved `mt5Connected`, cached account records, OAuth tokens, and cached cTrader account selections will never determine these statuses.

MT5 will visibly state that it requires the desktop terminal and local bridge and is not browser-compatible. cTrader will show that execution depends on the authenticated backend service. No execution controls will be added.

## 3. Inline account management

Selecting a broker card opens its inline workspace. There will be no implicit MT5 default:

- Initial broker selection comes from the current global account only when its broker is identifiable.
- OAuth return selects cTrader explicitly.
- Otherwise, the page asks the user to select a broker.
- Changing broker clears the previous broker's displayed session data.
- Changing accounts clears the previous account's metrics and positions immediately.

### Account lists

Accounts will be filtered using `(broker, externalAccountId)`:

- MT5 shows stored MT5 records and the current verified terminal session. MT5 account enumeration remains unavailable.
- cTrader shows live authenticated accounts when `accounts.source === "live"`.
- Cached cTrader accounts are visibly labelled Cached and never represented as authenticated.
- Incomplete identities remain labelled Identity incomplete.
- Unsupported or unidentified records are not reassigned to either broker.
- Manual accounts and unrelated records remain untouched.

Accounts with identical external IDs under MT5 and cTrader remain separate rows and separate selections.

### Non-destructive storage behavior

Account merging will use the Phase 2 identity helpers:

1. Match by broker and external account identity.
2. Preserve the existing local `id` when a match exists.
3. Preserve unknown fields through object spreading.
4. Append a new record only when no broker-identity match exists.
5. Never renumber, replace, or delete existing local IDs.
6. Preserve malformed or unrecognized stored entries verbatim, while excluding them from the rendered broker list.
7. Never create a default account merely because this page was opened.
8. Never delete legacy trade or account-scoped storage.

Writes to `tradingAccounts` occur only for explicit account changes or a migration that actually changed data.

## 4. Live session data

The session panel will show:

- Balance
- Equity
- Used margin
- Free margin
- Currency
- Leverage
- Open positions
- Pending orders
- Last successful synchronization

Every field has three distinct states:

1. Validated value — displayed as received.
2. Validated empty collection — displays No open positions or equivalent.
3. Unavailable or unvalidated — displays Unavailable, never zero.

Stored account metrics will not be substituted for unavailable live values.

### MT5 validation sequence

For the selected local account:

1. Read aggregate broker status.
2. Require genuine connected terminal status.
3. Validate live login against the selected external account ID.
4. Validate server whenever both stored and live identities provide it.
5. Require positions to return the same login/server identity.
6. Because pending-order responses lack an identity envelope, re-read MT5 status after retrieval and require the same validated terminal identity before displaying orders.
7. Drop the entire result if the selected account or request generation changed during retrieval.

The last-successful-sync timestamp is recorded only after these checks succeed.

### cTrader validation sequence

For the selected cTrader account:

1. Require aggregate status to identify a connected, authenticated, ready service.
2. Require `accounts.activeAccount?.activeAccountSource === "live"` for live account claims.
3. Read the existing cTrader service status for account metrics and open positions.
4. Require service `tradingAccountId`, authenticated aggregate identity, and selected external account ID to match.
5. Reject metrics and positions if any identity is absent or mismatched.
6. Drop late responses after broker/account changes.

cTrader pending orders will display Unavailable with the existing backend limitation. No pending-order count or empty collection will be invented.

## 5. Connection workflows

### MT5

- Connect uses the existing `MT5ConnectionModal`.
- The modal receives a real local account object and sends its existing complete body: `{ accountId, login, server, password? }`.
- With no existing account, a temporary local draft supplies the modal's required local ID; it is persisted only after successful connection.
- A successful result merges by `(mt5, login)`, preserving an existing local ID where applicable.
- Disconnect calls `POST /api/mt5/disconnect` with no body.
- Local account records are marked disconnected only after backend confirmation; they are not deleted.
- Reconnect uses the same modal and never assumes saved credentials prove connectivity.

### cTrader

- Authorization starts through the existing `GET /api/ctrader/connect` redirect.
- OAuth return means authorization returned, not Connected.
- Existing saved accounts can be selected through `POST /api/ctrader/accounts/select` with `{ accountId }`.
- First-time setup uses `POST /api/ctrader/account` with `{ accountId, accountName? }`.
- Service reconnect uses `POST /api/ctrader/start-service` with no body.
- The UI explains when an account ID is required before live account enumeration becomes possible.
- Disconnect requires confirmation because the existing endpoint clears server-side OAuth and saved cTrader connection records.
- Disconnect does not delete EdgeFinder manual accounts, local broker records, or legacy trade data.

No account-deletion or order-execution endpoints will be called.

## 6. Shared safety corrections

### MT5 late-response protection

Both MT5 account synchronization and position synchronization will:

- Capture the selected local account ID before requesting data.
- Recheck the current selection after every asynchronous response and before any state, storage, selection, or event update.
- Ignore responses belonging to an earlier selection or earlier request generation.
- Prevent account A's response from updating account B after an A to B switch.

Account-switch persistence will also skip writes until the newly selected account's stored state has been loaded. This prevents old open trades, pending orders, closed trades, or metrics from being written under the new account's scoped keys during the switch render.

### MT5 fallback validation

The `mt5-<login>` local-ID fallback will no longer bypass identity checks:

- Same login with a different known server is rejected.
- Unsupported or incomplete stored identities are rejected.
- An existing local ID cannot be selected merely because its string matches.
- Rejected sessions cannot update balances, positions, account selection, or scoped storage.

### cTrader account-scoped cache

`MarketContext` will maintain the authenticated cTrader account identity synchronously through a ref as well as rendered state:

- Every execution, snapshot, position update, and position-close event must carry an authenticated account ID.
- Account-less position events clear exposed cTrader positions and are rejected.
- Switching from account A to account B clears A's cached positions before B's event is applied.
- Generic position events can no longer reuse the previous event's account identity.
- A close/update for B cannot mutate A's cache.
- `TradeContext` continues to validate the envelope identity against the selected account before normalizing or saving positions.

## 7. Shared identity-helper corrections

Two targeted identity corrections will support the new UI safely:

- An explicitly unsupported broker such as OANDA remains unsupported even if its local ID starts with `mt5-` or `ctrader-`. ID-prefix inference applies only when no broker was recorded.
- A selected broker account with no live identity fails closed. The existing null-live-identity exception remains only for manual account selection, not for displaying broker data.

These changes strengthen validation without altering existing local IDs or stored records.

## 8. Visual and interaction design

The layout will use the existing violet/slate Tailwind design language:

- Page header with a global Refresh action.
- Responsive two-card broker overview.
- Inline workspace below the cards.
- Desktop: account list on the left, live session on the right.
- Mobile: stacked account and session sections.
- Compact status pills with distinct loading, connected, connecting, disconnected, unreachable, and error treatments.
- Metrics in a responsive grid.
- Positions and pending orders in separate tabs or sections with responsive tables.
- Inline errors using accessible alert regions.
- Loading indicators that do not misrepresent previous data as current.
- Empty states that explain the next valid action.
- Confirmation only for destructive cTrader authorization disconnect.

No global Tailwind tokens, application shell, or unrelated pages will be restyled.

## 9. Canonical cTrader status contract

`connection.state` describes the current live service connection. Cached OAuth remains separate reconnect context and never establishes live identity.

| Live service evidence | Canonical state |
| --- | --- |
| Socket connected, authenticated, and ready | `connected` |
| Socket connected but awaiting authentication or readiness | `authenticating` |
| Socket down, with or without cached OAuth | `disconnected` |

Cached OAuth is exposed only through the existing authorization metadata. Cached accounts retain cached provenance, and authenticated identity remains null unless the service is connected, authenticated, and ready.

The production adapter, registry, route, and Phase 2 assertion remain unchanged. The stale Phase 1 assertion in `server/brokers/brokerStatus.test.js` will change from `authorized_socket_down` to `disconnected`. This reconciles the test contract without changing production behavior or weakening identity validation.

## 10. Regression and verification plan

### New focused frontend runtime tests

Using the established in-memory esbuild and jsdom pattern, with no server or real transport:

- Initial loading state.
- Connected MT5 and cTrader states.
- Disconnected, connecting, unreachable, and error states.
- Broker-specific account filtering.
- Identical external IDs under both brokers.
- Account switching clearing prior metrics and positions.
- Missing account identity producing unavailable data.
- Genuine zero values remaining zero while missing values show Unavailable.
- MT5 data never rendering under cTrader and vice versa.
- Cached cTrader accounts not appearing authenticated.
- Exact MT5/cTrader request methods and bodies.
- cTrader pending orders remaining unavailable.
- OAuth return selecting the Broker Integration tab.
- No token or secret rendering.

### New safety regressions

- Late MT5 account response after A to B is ignored.
- Late MT5 position response after A to B is ignored.
- Account-switch persistence cannot write A's state under B's keys.
- Same-login/wrong-server MT5 fallback is rejected.
- cTrader A positions cannot survive the switch to authenticated account B.
- Account-less cTrader position/update/close events are rejected.
- B position events cannot mutate A's cache.
- Unsupported explicit brokers cannot be reassigned through ID prefixes.
- Broker accounts without live identity fail closed.

### Existing suites and checks

- Run all 82 relevant Phase 2 tests.
- Run the reconciled 15-test broker-status suite.
- Run new focused model and jsdom runtime suites.
- Run syntax checks for changed JavaScript/JSX through the established esbuild tooling.
- Run `git diff --check`.
- Capture exact changed files and final Git status counts.

## Global constraints

- Preserve all existing work and uncommitted changes.
- Do not access the original Cursor repository.
- Do not reset, stash, clean, checkout, revert, commit, or perform other destructive Git operations.
- Do not delete dead files or modify the MT5 bridge.
- Do not start servers or broker connections, execute trades, make real network requests, or access port 5001.
- Do not expose tokens or secrets.
- Do not start Phase 4.
- Implementation begins only after explicit approval of the implementation plan.
