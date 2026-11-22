import { calculateRiskAmount } from "../calculator/riskCalculator.js";

// ============================================================
// ACCOUNT BALANCE FOR RISK MATHS
//
// The live order panel used to size every trade against a hardcoded
// 100158.75, so the risk percentage silently meant something the account never
// held. The loaded broker account is the only acceptable input: when it is
// missing, unreadable or not a positive number, the risk amount stays zero and
// the caller reports why instead of inventing a balance.
// ============================================================

// A broker balance is only useful for risk maths while it is known to be
// recent. MT5 account data is polled every 3 seconds, so 30 seconds means the
// app missed roughly ten successful syncs: the number on screen is then the
// last one remembered rather than the one the account holds. Automatic sizing
// stops there instead of risking a percentage of a figure nobody confirmed.
export const BALANCE_MAX_AGE_MS = 30_000;

export const ACCOUNT_BALANCE_CODES = {
  OK: "OK",
  NOT_LOADED: "NOT_LOADED",
  INVALID: "INVALID",
  NON_POSITIVE: "NON_POSITIVE",
  STALE: "STALE",
  FRESHNESS_UNKNOWN: "FRESHNESS_UNKNOWN",
  ACCOUNT_MISMATCH: "ACCOUNT_MISMATCH",
};

export const BALANCE_FRESHNESS_CODES = {
  FRESH: "FRESH",
  STALE: ACCOUNT_BALANCE_CODES.STALE,
  UNKNOWN: ACCOUNT_BALANCE_CODES.FRESHNESS_UNKNOWN,
  MISMATCH: ACCOUNT_BALANCE_CODES.ACCOUNT_MISMATCH,
};

function unavailable(code, message, rawBalance) {
  return {
    code,
    available: false,
    balance: 0,
    rawBalance: rawBalance ?? null,
    message,
  };
}

export function resolveAccountBalance(rawBalance) {
  if (
    rawBalance === undefined ||
    rawBalance === null ||
    rawBalance === ""
  ) {
    return unavailable(
      ACCOUNT_BALANCE_CODES.NOT_LOADED,
      "No account balance is loaded yet, so risk per trade cannot be turned into a position size. Refresh or reconnect the broker account, or enter the volume manually.",
      rawBalance
    );
  }

  const balance = Number(rawBalance);

  if (!Number.isFinite(balance)) {
    return unavailable(
      ACCOUNT_BALANCE_CODES.INVALID,
      `The loaded account balance "${rawBalance}" is not a number, so risk per trade cannot be applied. Reconnect or refresh the broker account, or enter the volume manually.`,
      rawBalance
    );
  }

  if (balance <= 0) {
    return unavailable(
      ACCOUNT_BALANCE_CODES.NON_POSITIVE,
      `The loaded account balance is ${balance}, which cannot be used to risk a percentage of. Fund or reconnect the account, or enter the volume manually.`,
      rawBalance
    );
  }

  return {
    code: ACCOUNT_BALANCE_CODES.OK,
    available: true,
    balance,
    rawBalance: balance,
    message: "",
  };
}

function toStampMs(refreshedAt) {
  if (refreshedAt instanceof Date) {
    return refreshedAt.getTime();
  }

  if (typeof refreshedAt === "number") {
    return refreshedAt;
  }

  if (typeof refreshedAt === "string" && refreshedAt.trim() !== "") {
    return Date.parse(refreshedAt);
  }

  return Number.NaN;
}

function identityKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

// ============================================================
// BALANCE FRESHNESS
//
// The stamp records when this app last received a usable balance; it is not a
// guarantee about the broker's own record. Anything that makes even that
// claim uncertain - no stamp, an unreadable stamp, a stamp belonging to a
// different account, or a stamp from a clock we cannot trust - is reported as
// not fresh, so the caller blocks rather than guesses.
// ============================================================

export function assessBalanceFreshness({
  refreshedAt,
  ownerAccountId,
  expectedAccountId,
  maxAgeMs = BALANCE_MAX_AGE_MS,
  now,
} = {}) {
  const windowMs =
    Number.isFinite(maxAgeMs) && maxAgeMs > 0
      ? maxAgeMs
      : BALANCE_MAX_AGE_MS;

  const referenceMs =
    now instanceof Date
      ? now.getTime()
      : Number.isFinite(Number(now))
        ? Number(now)
        : Date.now();

  const unknown = (message) => ({
    fresh: false,
    code: ACCOUNT_BALANCE_CODES.FRESHNESS_UNKNOWN,
    ageMs: null,
    maxAgeMs: windowMs,
    message,
  });

  const stampMs = toStampMs(refreshedAt);

  if (!Number.isFinite(stampMs)) {
    return unknown(
      "There is no record of when this account balance was last refreshed, so risk per trade cannot be applied to it yet. Reconnect or refresh the broker account, or enter the volume manually."
    );
  }

  const owner = identityKey(ownerAccountId);
  const expected = identityKey(expectedAccountId);

  if (!owner || !expected) {
    return unknown(
      "The last balance refresh is not tied to a selected account, so it cannot be confirmed as this account's balance. Select the broker account again, or enter the volume manually."
    );
  }

  if (owner !== expected) {
    return {
      fresh: false,
      code: ACCOUNT_BALANCE_CODES.ACCOUNT_MISMATCH,
      ageMs: null,
      maxAgeMs: windowMs,
      message:
        "The loaded balance belongs to a different account than the one selected, so risk per trade cannot be applied to it. Wait for the selected account to sync, or enter the volume manually.",
    };
  }

  const ageMs = referenceMs - stampMs;

  if (ageMs < 0) {
    return unknown(
      "The recorded balance refresh time is in the future, so the age of this balance cannot be trusted. Reconnect or refresh the broker account, or enter the volume manually."
    );
  }

  if (ageMs > windowMs) {
    return {
      fresh: false,
      code: ACCOUNT_BALANCE_CODES.STALE,
      ageMs,
      maxAgeMs: windowMs,
      message:
        `The account balance has not been refreshed for ${Math.floor(ageMs / 1000)} seconds, so its risk per trade may be based on an out-of-date balance. Check the broker connection, or enter the volume manually.`,
    };
  }

  return {
    fresh: true,
    code: BALANCE_FRESHNESS_CODES.FRESH,
    ageMs,
    maxAgeMs: windowMs,
    message: "",
  };
}

export function riskAmountForAccount({
  balance,
  riskPercent,
  freshness,
} = {}) {
  const resolved = resolveAccountBalance(balance);
  const percent = Number(riskPercent);

  // Zero is also what an unusable balance produces, so automatic sizing stops
  // with its own INVALID_INPUT reason rather than sizing off a made-up number.
  if (!resolved.available || !Number.isFinite(percent) || percent <= 0) {
    return { ...resolved, riskAmount: 0 };
  }

  // Callers that care about how recent the balance is pass a freshness input;
  // omitting it keeps the older behaviour of trusting the loaded balance.
  if (freshness !== undefined) {
    const status = assessBalanceFreshness(freshness);

    if (!status.fresh) {
      return {
        ...resolved,
        code: status.code,
        available: false,
        riskAmount: 0,
        ageMs: status.ageMs,
        maxAgeMs: status.maxAgeMs,
        message: status.message,
      };
    }

    return {
      ...resolved,
      riskAmount: calculateRiskAmount(resolved.balance, percent),
      ageMs: status.ageMs,
      maxAgeMs: status.maxAgeMs,
    };
  }

  return {
    ...resolved,
    riskAmount: calculateRiskAmount(resolved.balance, percent),
  };
}
