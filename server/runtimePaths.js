import path from "path";
import { fileURLToPath } from "url";

export const SERVER_DIR = path.dirname(
  fileURLToPath(import.meta.url)
);

export const AUTH_FILE = path.join(SERVER_DIR, "ctrader-auth.json");

// The account metadata store lives beside this module in its own file, so a
// page that only lists accounts never reads the file that holds the tokens.
export const ACCOUNTS_FILE = path.join(SERVER_DIR, "ctrader-accounts.json");

export const PROTO_DIR = path.join(SERVER_DIR, "openapi-proto-messages");

// The backend configuration file lives beside this module. The frontend
// reads the file with the same name one directory above, so the API keeps
// pointing at its own copy no matter which directory it is started from.
export const ENV_FILE = path.join(SERVER_DIR, ".env");
