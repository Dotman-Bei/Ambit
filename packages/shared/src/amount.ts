/**
 * Amount handling. §12.3 requires exact amounts, so no float ever touches a value here.
 *
 * Two representations exist and they are never mixed:
 *   - the *human* decimal string a person types into a policy or an SDK call, e.g. "0.05"
 *   - the *atomic* integer the chain and the x402 challenge speak in, e.g. 50000n for 6-decimal USDC
 *
 * Conversion happens once, at the boundary, and the policy engine compares atomic to atomic.
 * `0.1 + 0.2` is a class of bug this module exists to make unrepresentable.
 */

export type AtomicAmount = bigint;

/** Decimals for the assets Ambit understands. §27: one rail, one asset, in phase 1. */
export const ASSET_DECIMALS: Readonly<Record<string, number>> = {
  USDC: 6,
};

export class AmountFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmountFormatError";
  }
}

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/**
 * Parses a non-negative human decimal string into atomic units, exactly.
 *
 * Rejects rather than rounds when the input carries more precision than the asset can hold:
 * silently truncating "0.0500001" to "0.050000" would mean the amount the policy judged and the
 * amount that settles are different numbers, which is the whole failure §11 exists to prevent.
 */
export function toAtomic(human: string, decimals: number): AtomicAmount {
  if (typeof human !== "string") {
    throw new AmountFormatError(`amount must be a string, got ${typeof human}`);
  }
  const trimmed = human.trim();
  const match = DECIMAL_PATTERN.exec(trimmed);
  if (!match) {
    throw new AmountFormatError(
      `amount "${human}" is not a non-negative decimal. Scientific notation, signs and separators are all rejected.`,
    );
  }
  const whole = match[1]!;
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) {
    throw new AmountFormatError(
      `amount "${human}" carries ${fraction.length} decimal places but the asset holds ${decimals}. ` +
        `Rounding here would mean judging one number and settling another.`,
    );
  }
  const padded = fraction.padEnd(decimals, "0");
  return BigInt(whole + padded);
}

/** Renders atomic units back to a human decimal string. Exact; trailing zeros are kept. */
export function fromAtomic(atomic: AtomicAmount, decimals: number): string {
  if (atomic < 0n) {
    throw new AmountFormatError(`atomic amount must not be negative, got ${atomic}`);
  }
  if (decimals === 0) return atomic.toString();
  const digits = atomic.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);
  return `${whole}.${fraction}`;
}

export function decimalsForAsset(asset: string): number {
  const decimals = ASSET_DECIMALS[asset];
  if (decimals === undefined) {
    throw new AmountFormatError(
      `asset "${asset}" has no declared decimals. Guessing 18 or 6 here would mean paying the wrong amount.`,
    );
  }
  return decimals;
}

export function toAtomicForAsset(human: string, asset: string): AtomicAmount {
  return toAtomic(human, decimalsForAsset(asset));
}

export function fromAtomicForAsset(atomic: AtomicAmount, asset: string): string {
  return fromAtomic(atomic, decimalsForAsset(asset));
}

/**
 * Parses an atomic amount that arrived as a decimal string — for instance the x402 challenge's
 * `maxAmountRequired`, which is already in atomic units. Rejects anything that is not a
 * non-negative integer literal, so a challenge carrying "0.05" cannot be read as 5 atomic units.
 */
export function parseAtomic(value: string): AtomicAmount {
  if (!/^\d+$/.test(value.trim())) {
    throw new AmountFormatError(
      `"${value}" is not an atomic integer. An x402 challenge states atomic units; a decimal point here means the field was misread.`,
    );
  }
  return BigInt(value.trim());
}
