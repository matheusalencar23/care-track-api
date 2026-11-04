export type TrustProxy = number | string;

export const DEFAULT_TRUST_PROXY = 1;

export const parseTrustProxy = (value: string | undefined): TrustProxy => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_TRUST_PROXY;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (trimmed === "true" || trimmed === "false") {
    throw new Error(
      "TRUST_PROXY must be a number of hops or a list of trusted proxy addresses, not a boolean",
    );
  }

  return trimmed;
};
