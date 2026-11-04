import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRUST_PROXY,
  parseTrustProxy,
} from "../../src/config/trustProxy.js";

describe("parseTrustProxy", () => {
  it.each([undefined, "", "  "])(
    "should trust one proxy by default (%o)",
    (value) => {
      expect(parseTrustProxy(value)).toBe(DEFAULT_TRUST_PROXY);
    },
  );

  it("should read a number of hops", () => {
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy("0")).toBe(0);
  });

  it("should keep a list of trusted addresses", () => {
    expect(parseTrustProxy("10.0.0.0/8, loopback")).toBe(
      "10.0.0.0/8, loopback",
    );
  });

  it.each(["true", "false"])(
    "should reject the boolean %s, which would allow spoofing the client IP",
    (value) => {
      expect(() => parseTrustProxy(value)).toThrow();
    },
  );
});
