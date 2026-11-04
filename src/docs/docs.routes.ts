import { Router } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiDocument } from "./openapi.js";

const routes = Router();

const document = buildOpenApiDocument();

routes.use(
  helmet.contentSecurityPolicy({
    directives: { upgradeInsecureRequests: null },
  }),
);

routes.get("/openapi.json", (_req, res) => {
  res.json(document);
});

routes.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(document, {
    customSiteTitle: "Care Track API",
    swaggerOptions: { withCredentials: true },
  }),
);

export default routes;
