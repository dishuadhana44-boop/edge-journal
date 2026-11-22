import { Router } from "express";

import { buildStatusResponse } from "../brokers/registry.js";

// The router is created from an injected adapter list so that tests can build
// it with fakes without loading the broker services, and so that the HTTP layer
// never has to know which broker talks to what.
export function createBrokersRouter({ adapters } = {}) {
  const router = Router();

  const brokerAdapters = Array.isArray(adapters) ? adapters : [];

  function findAdapter(brokerId) {
    const wanted = String(brokerId || "")
      .trim()
      .toLowerCase();

    return brokerAdapters.find((adapter) => adapter.id === wanted) || null;
  }

  router.get("/status", async (req, res) => {
    try {
      const payload = await buildStatusResponse(brokerAdapters);

      return res.json(payload);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to read broker status.",
        error: error.message,
      });
    }
  });

  router.get("/:brokerId/accounts", async (req, res) => {
    const adapter = findAdapter(req.params.brokerId);

    if (!adapter) {
      return res.status(404).json({
        success: false,
        message: "Unknown broker.",
      });
    }

    try {
      const accounts = await adapter.listAccounts();

      return res.json({
        success: true,
        broker: adapter.id,
        observedAt: new Date().toISOString(),
        accounts,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        broker: adapter.id,
        message: "Unable to read broker accounts.",
        error: error.message,
      });
    }
  });

  return router;
}

export default createBrokersRouter;
