import { Router } from "express";
import {
  handlePublications,
  type PublicationsServices,
} from "../../../functions/api/_publications";
import type { AuthEnv } from "../../../functions/api/_auth";
export function createPublicationsRouter(
  envProvider: () => AuthEnv,
  services?: PublicationsServices,
) {
  const router = Router();
  router.all(
    [
      "/publication-channels",
      "/publication-channels/:id",
      "/publication-summaries",
      "/listings/:listingId/publications",
      "/listings/:listingId/publications/:id",
    ],
    async (req, res) => {
      const response = await handlePublications(
        {
          env: envProvider(),
          request: new Request(`http://localhost${req.originalUrl}`, {
            method: req.method,
            headers: {
              Cookie: req.headers.cookie || "",
              "Content-Type": "application/json",
            },
            body: ["GET", "HEAD"].includes(req.method)
              ? undefined
              : JSON.stringify(req.body),
          }),
          resource: req.path.startsWith("/publication-channels")
            ? "channels"
            : req.path.startsWith("/publication-summaries")
              ? "summaries"
              : "publications",
          id: req.params.id,
          listingId: req.params.listingId,
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
