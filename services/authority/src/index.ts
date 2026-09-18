import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { AmbitStore } from "@ambit/policy-store";
import { ProofEngine } from "@ambit/proof-engine";
import { createApp } from "./app.js";
import { CredentialStore } from "./dynamic/credentials.js";
import { createSellerApp } from "./seller.js";

/**
 * Process entry point. Two servers, deliberately on two ports: the authority service and the
 * PROJECT_OPERATED seller are different parties in the flow, and running them in one process on one
 * port would blur exactly the boundary §12.4 asks to be kept visible.
 */

/**
 * Load `.env` from the repository root if it is there.
 *
 * `process.loadEnvFile` is Node's own reader (22+), so this needs no dependency. It is deliberately
 * NOT required: §6 is fail-closed, and a service started without a `.env` must come up and refuse
 * to move money rather than fail to boot. A missing config file is a state the product has an
 * answer for — every capability reports NOT_CONFIGURED in `/health` and every spend route refuses
 * with a named reason.
 *
 * Values already in the environment win, because that is how a deploy overrides a checked-out file.
 */
const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
    console.log(`loaded ${envFile}`);
  } catch (error) {
    console.warn(`could not read ${envFile}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const env = process.env;

const store = new AmbitStore();
const credentials = new CredentialStore();
const proof = new ProofEngine();

const authorityPort = Number(env["PORT"] ?? 4020);
const sellerPort = Number(env["SELLER_PORT"] ?? 4021);

serve({ fetch: createApp({ store, credentials, proof, env }).fetch, port: authorityPort });
serve({ fetch: createSellerApp(env).fetch, port: sellerPort });

console.log(`ambit authority  http://127.0.0.1:${authorityPort}`);
console.log(`ambit seller     http://127.0.0.1:${sellerPort}   [PROJECT_OPERATED]`);
