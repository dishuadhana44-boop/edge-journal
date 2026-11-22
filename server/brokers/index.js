import {
  getCTraderServiceStatus,
  getAvailableAccounts,
} from "../services/ctraderService.js";
import { getBrokerAuthSummary } from "../routes/ctrader.js";

import { createMt5Adapter } from "./mt5Adapter.js";
import { createCtraderAdapter } from "./ctraderAdapter.js";

export {
  BROKER_STATUS_CONTRACT_VERSION,
  buildStatusResponse,
} from "./registry.js";

/**
 * The only place where the broker adapters are wired to the live in-process
 * broker state. Adapters themselves stay dependency-injected, which is what
 * lets one of them be re-pointed at a remote or browser-based execution
 * provider without touching the HTTP layer or the frontend.
 */
export function getDefaultAdapters() {
  return [
    createMt5Adapter(),
    createCtraderAdapter({
      getServiceStatus: getCTraderServiceStatus,
      getLiveAccounts: getAvailableAccounts,
      getAuthSummary: getBrokerAuthSummary,
    }),
  ];
}
