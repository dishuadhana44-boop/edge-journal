// ==========================================================
// Exact broker money arithmetic
//
// validate_history_deal hands over profit, commission, swap and fee as
// exact fixed-point decimal strings (mt5-bridge/app.py:5957-5993,
// :6189-6195, :6260-6263). Money is therefore summed at the reported
// precision and never through Number, because a recovered amount has to
// match the terminal digit for digit.
//
// Nothing here guesses: an absent, non-text or malformed amount is a
// named refusal, so no caller can mistake a missing field for zero.
// ==========================================================

const DECIMAL_TEXT = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;

export const DEAL_MONEY_FIELDS = Object.freeze([
  "profit",
  "commission",
  "swap",
  "fee",
]);

export const DEAL_AMOUNT_REASONS = Object.freeze({
  NO_DECIMAL_VALUES: "NO_DECIMAL_VALUES",
  NO_DEAL_ROWS: "NO_DEAL_ROWS",
  DEAL_ROW_INVALID: "DEAL_ROW_INVALID",
  AMOUNT_FIELD_MISSING: "AMOUNT_FIELD_MISSING",
  AMOUNT_NOT_A_DECIMAL_STRING: "AMOUNT_NOT_A_DECIMAL_STRING",
  AMOUNT_MALFORMED_DECIMAL: "AMOUNT_MALFORMED_DECIMAL",
});

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function refused(reason, details = {}) {
  return Object.freeze({ ok: false, reason, ...details });
}

function decimalPlaces(text) {
  const dot = text.indexOf(".");

  return dot === -1 ? 0 : text.length - dot - 1;
}

function decimalToScaled(text, places) {
  const dot = text.indexOf(".");
  const whole = dot === -1 ? text : text.slice(0, dot);
  const fraction = dot === -1 ? "" : text.slice(dot + 1);

  return BigInt(whole + fraction.padEnd(places, "0").slice(0, places));
}

function formatScaled(value, places) {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;

  let text = magnitude.toString().padStart(places + 1, "0");

  if (places > 0) {
    text = `${text.slice(0, -places)}.${text.slice(-places)}`.replace(
      /\.?0+$/,
      ""
    );
  }

  if (text === "") text = "0";

  return negative && text !== "0" ? `-${text}` : text;
}

// ==========================================================
// One exact sum over a list of reported decimals
// ==========================================================

export function sumDecimalTexts(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return refused(DEAL_AMOUNT_REASONS.NO_DECIMAL_VALUES);
  }

  let places = 0;

  for (let index = 0; index < values.length; index += 1) {
    const text = values[index];

    if (typeof text !== "string") {
      return refused(DEAL_AMOUNT_REASONS.AMOUNT_NOT_A_DECIMAL_STRING, { index });
    }

    if (!DECIMAL_TEXT.test(text)) {
      return refused(DEAL_AMOUNT_REASONS.AMOUNT_MALFORMED_DECIMAL, {
        index,
        value: text,
      });
    }

    places = Math.max(places, decimalPlaces(text));
  }

  let total = 0n;

  for (const text of values) {
    total += decimalToScaled(text, places);
  }

  return Object.freeze({
    ok: true,
    total: formatScaled(total, places),
  });
}

// ==========================================================
// Broker money, component by component
// ==========================================================

export function sumDealMoney(rows, fields = DEAL_MONEY_FIELDS) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return refused(DEAL_AMOUNT_REASONS.NO_DEAL_ROWS);
  }

  const reported = new Map();

  for (const field of fields) {
    reported.set(field, []);
  }

  for (const row of rows) {
    if (!isPlainObject(row)) {
      return refused(DEAL_AMOUNT_REASONS.DEAL_ROW_INVALID);
    }

    const ticket = typeof row.ticket === "string" ? row.ticket : null;

    for (const field of fields) {
      const value = Object.hasOwn(row, field) ? row[field] : undefined;

      if (value === undefined || value === null) {
        return refused(DEAL_AMOUNT_REASONS.AMOUNT_FIELD_MISSING, {
          ticket,
          field,
        });
      }

      if (typeof value !== "string") {
        return refused(DEAL_AMOUNT_REASONS.AMOUNT_NOT_A_DECIMAL_STRING, {
          ticket,
          field,
        });
      }

      if (!DECIMAL_TEXT.test(value)) {
        return refused(DEAL_AMOUNT_REASONS.AMOUNT_MALFORMED_DECIMAL, {
          ticket,
          field,
          value,
        });
      }

      reported.get(field).push(value);
    }
  }

  const components = {};

  for (const field of fields) {
    const outcome = sumDecimalTexts(reported.get(field));

    if (!outcome.ok) {
      return refused(outcome.reason, { field });
    }

    components[field] = outcome.total;
  }

  const combined = sumDecimalTexts(
    fields.map((field) => components[field])
  );

  if (!combined.ok) {
    return refused(combined.reason, {});
  }

  return Object.freeze({
    ok: true,
    dealCount: rows.length,
    components: Object.freeze(components),
    total: combined.total,
  });
}
