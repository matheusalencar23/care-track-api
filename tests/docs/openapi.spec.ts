import type { Router } from "express";
import { describe, expect, it } from "vitest";
import { apiOperations, buildOpenApiDocument } from "../../src/docs/openapi.js";
import authRoutes from "../../src/modules/auth/auth.routes.js";
import consentRoutes from "../../src/modules/consent/consent.routes.js";
import patientRoutes from "../../src/modules/patient/patient.routes.js";
import recordRoutes from "../../src/modules/record/record.routes.js";
import userRoutes from "../../src/modules/user/user.routes.js";

const mounts: [string, Router][] = [
  ["/users", userRoutes],
  ["/auth", authRoutes],
  ["/patients", patientRoutes],
  ["/patients/:id/consents", consentRoutes],
  ["/patients/:id/records", recordRoutes],
];

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

const joinPath = (prefix: string, path: string) =>
  path === "/" ? prefix : `${prefix}${path}`;

const registeredRoutes = () =>
  [
    "get /health",
    ...mounts.flatMap(([prefix, router]) =>
      (router.stack as RouteLayer[]).flatMap((layer) =>
        layer.route
          ? Object.keys(layer.route.methods).map(
              (method) => `${method} ${joinPath(prefix, layer.route!.path)}`,
            )
          : [],
      ),
    ),
  ].sort();

const documentedRoutes = () =>
  apiOperations.map(({ method, path }) => `${method} ${path}`).sort();

describe("OpenAPI document", () => {
  it("should document every registered route and nothing else", () => {
    expect(documentedRoutes()).toEqual(registeredRoutes());
  });

  it("should not document the same route twice", () => {
    const routes = documentedRoutes();

    expect(new Set(routes).size).toBe(routes.length);
  });

  it("should declare every path parameter in the request schema", () => {
    const document = buildOpenApiDocument();

    for (const [path, operations] of Object.entries(document.paths)) {
      const expected = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => name);

      for (const operation of Object.values(operations)) {
        const declared = (
          (operation as { parameters?: { name: string; in: string }[] })
            .parameters ?? []
        )
          .filter((parameter) => parameter.in === "path")
          .map((parameter) => parameter.name);

        expect(declared, path).toEqual(expected);
      }
    }
  });

  it("should only reference registered components", () => {
    const document = buildOpenApiDocument();
    const references = [
      ...JSON.stringify(document).matchAll(/"#\/components\/schemas\/(\w+)"/g),
    ].map(([, id]) => id);

    expect(references.length).toBeGreaterThan(0);

    for (const id of references) {
      expect(document.components.schemas, id).toHaveProperty(id as string);
    }
  });

  it("should document the cookie authentication on protected routes", () => {
    const document = buildOpenApiDocument();
    const me = document.paths["/auth/me"]?.["get"] as {
      security?: unknown;
      responses: Record<string, unknown>;
    };

    expect(me.security).toEqual([{ cookieAuth: [] }]);
    expect(me.responses).toHaveProperty("401");
  });
});
