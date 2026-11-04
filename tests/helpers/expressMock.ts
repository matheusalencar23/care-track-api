import type { NextFunction, Request, Response } from "express";
import { vi } from "vitest";

export const createMockRequest = <T extends Partial<Request>>(
  overrides: T,
): Request & T => {
  return {
    body: {},
    ...overrides,
  } as Request & T;
};

export const createMockResponse = (json = vi.fn()): Response => {
  const headers = new Map<string, unknown>();
  const res = {
    status: vi.fn(),
    json: json,
    send: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    setHeader: vi.fn((name: string, value: unknown) => {
      headers.set(name.toLowerCase(), value);
    }),
    getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
    removeHeader: vi.fn((name: string) => {
      headers.delete(name.toLowerCase());
    }),
  };

  res.status.mockReturnValue(res as never);

  return res as unknown as Response;
};

export const createMockNext = (): NextFunction => {
  return vi.fn();
};
