import { Router } from "express";
import {
  handleOwnerListings,
  type OwnerServices,
} from "../../functions/api/_owner-listings";
import type { AuthEnv } from "../../functions/api/_auth";
export function createOwnerListingsRouter(
  env: () => AuthEnv,
  services?: OwnerServices,
) {
  const router = Router();
  router.all(
    [
      "/owner-assignment-settings",
      "/listings/report",
      "/owner-listings/import",
      "/owner-listings/summary-report",
      "/owner-listings",
      "/owner-listings/:id",
      "/owner-listings/:id/:action",
    ],
    async (req, res) => {
      const action =
        req.path === '/listings/report' ? 'listing-report' : req.path === '/owner-listings/summary-report' ? 'summary-report' : req.path === "/owner-listings/import"
          ? "import"
          : req.path === "/owner-assignment-settings"
            ? "settings"
            : req.params.action;
      const response = await handleOwnerListings(
        {
          env: env(),
          params: req.params.id ? { id: req.params.id } : undefined,
          action,
          request: new Request("http://localhost" + req.originalUrl, {
            method: req.method,
            headers: {
              Cookie: req.headers.cookie || "",
              "Content-Type": "application/json",
            },
            body: ["GET", "HEAD"].includes(req.method)
              ? undefined
              : JSON.stringify(req.body || {}),
          }),
        },
        services,
      );
      res
        .status(response.status)
        .type("application/json")
        .send(await response.text());
    },
  );
  return router;
}
