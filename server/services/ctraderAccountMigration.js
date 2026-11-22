import fs from "node:fs";
import path from "node:path";
import { AUTH_FILE, ACCOUNTS_FILE } from "../runtimePaths.js";
import { createCtraderStore } from "./ctraderStore.js";
import { createCtraderAccountsStore } from "./ctraderDomainStores.js";
import { projectLegacyState } from "./ctraderMigrationProjection.js";

const quietLogger = { log() {}, error() {} };
const metadataKeys = ["id", "accountId", "name", "createdAt"];

function migrationError(stage) {
  const error = new Error(`cTrader account migration failed (${stage})`);
  error.code = "CTRADER_MIGRATION_FAILED";
  error.stage = stage;
  return error;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value) {
  return (typeof value === "string" && value.trim() !== "") ||
    (typeof value === "number" && Number.isFinite(value));
}

function isSelection(value) {
  return value === null || typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value));
}

function isAccount(row) {
  return isObject(row) && isIdentifier(row.accountId) &&
    ["id", "name", "createdAt"].every((key) =>
      row[key] === undefined || row[key] === null || typeof row[key] === "string"
    );
}

function validDestination(state) {
  return isObject(state) &&
    Object.keys(state).length === 2 &&
    Array.isArray(state.accounts) &&
    Object.hasOwn(state, "activeAccountId") &&
    isSelection(state.activeAccountId) &&
    state.accounts.every((row) => isAccount(row) &&
      Object.keys(row).every((key) => metadataKeys.includes(key))
    );
}

function validLegacy(state) {
  if (!isObject(state) ||
      (state.activeAccountId !== undefined && !isSelection(state.activeAccountId))) {
    return false;
  }
  if (Object.hasOwn(state, "accounts")) {
    if (!Array.isArray(state.accounts) || !state.accounts.every(isAccount)) return false;
    if (state.accounts.length > 0 || state.accountId === undefined || state.accountId === null) {
      return true;
    }
    return isIdentifier(state.accountId) ||
      (typeof state.accountId === "string" && state.accountId.trim() === "");
  }
  return isIdentifier(state.accountId);
}

function readSnapshot(fileSystem, filePath, stage) {
  let info;
  try {
    info = fileSystem.lstatSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return { kind: "missing" };
    throw migrationError(`${stage}-read`);
  }
  if (!info.isFile()) return { kind: "invalid" };

  let text;
  try {
    text = fileSystem.readFileSync(filePath, "utf8");
  } catch {
    throw migrationError(`${stage}-read`);
  }
  try {
    return { kind: "present", text, state: JSON.parse(text) };
  } catch {
    return { kind: "invalid" };
  }
}

export function migrateLegacyAccounts(options = {}) {
  const {
    legacyFilePath = AUTH_FILE,
    accountsFilePath = ACCOUNTS_FILE,
    fileSystem = fs,
    logger = console,
  } = options;

  if (path.resolve(legacyFilePath) === path.resolve(accountsFilePath)) {
    throw migrationError("paths");
  }
  function outcome(value) {
    logger.info(`cTrader account migration: ${value}`);
    return value;
  }

  const destination = readSnapshot(fileSystem, accountsFilePath, "destination");
  if (destination.kind !== "missing") {
    if (destination.kind !== "present" || !validDestination(destination.state)) {
      throw migrationError("destination-invalid");
    }
    return outcome("destination-present");
  }

  const source = readSnapshot(fileSystem, legacyFilePath, "legacy");
  if (source.kind === "missing") return outcome("legacy-missing");
  if (source.kind !== "present" || !validLegacy(source.state)) {
    return outcome("legacy-invalid");
  }

  // Normalize the validated snapshot, not a second potentially different read.
  const legacyStore = createCtraderStore({
    filePath: legacyFilePath,
    selectionPolicy: "preserve-explicit",
    fileSystem: {
      existsSync: () => true,
      readFileSync: () => source.text,
    },
    logger: quietLogger,
  });
  const legacyState = legacyStore.load();
  if (legacyState === null) return outcome("legacy-invalid");
  const projected = projectLegacyState(legacyState);

  const accountsStore = createCtraderAccountsStore({
    filePath: accountsFilePath,
    logger: quietLogger,
    fileSystem: {
      ...fileSystem,
      renameSync(temporary, destinationPath) {
        // A hard link publishes atomically without replacing a concurrent winner.
        fileSystem.linkSync(temporary, destinationPath);
        fileSystem.unlinkSync(temporary);
      },
    },
  });
  try {
    accountsStore.save(projected.accounts);
  } catch {
    throw migrationError("write");
  }
  return outcome("migrated");
}
