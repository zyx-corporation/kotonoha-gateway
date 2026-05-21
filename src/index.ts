#!/usr/bin/env node
/**
 * kotonoha-gateway entrypoint (M5-P2).
 */

import { loadConfig } from "./config.js";
import { startServer } from "./server.js";

startServer(loadConfig());
