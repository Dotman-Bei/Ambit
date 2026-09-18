import { createHash } from "node:crypto";

/**
 * RFC 8785 JSON Canonicalization Scheme, plus sha256 over the result.
 *
 * §11 binds an approval to one hash. That binding is only as good as the canonicalisation: if two
 * serialisations of the same object can differ, the digest is not a function of the object and
 * `DIGEST_MISMATCH` starts firing on identical intents. Everything here exists to make the byte
 * sequence a function of the value alone — not of key insertion order, not of the platform's
 * float formatter, not of how the JSON arrived.
 */

export class CanonicalisationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalisationError";
  }
}

/**
 * RFC 8785 §3.2.3 orders object keys by their UTF-16 code units, which is exactly what
 * `Array.prototype.sort()` does by default in JavaScript, and exactly what `Intl.Collator` and
 * locale-aware comparison do not. The default sort is correct here and a "nicer" comparator is not.
 */
function sortKeys(keys: string[]): string[] {
  return keys.sort();
}

/**
 * RFC 8785 §3.2.2.2 serialises numbers as ECMAScript `Number::toString`, with the exception that
 * `-0` serialises as `0`. Non-finite values have no JSON representation and are refused rather than
 * silently becoming `null`, which is what `JSON.stringify` does.
 */
function serialiseNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CanonicalisationError(
      `${value} has no JSON representation. JSON.stringify would write null here, turning a broken value into a valid-looking document.`,
    );
  }
  if (Object.is(value, -0)) return "0";
  return String(value);
}

/** RFC 8785 §3.2.2.1 — the JSON string production, with the mandated short escapes. */
function serialiseString(value: string): string {
  let out = '"';
  for (const char of value) {
    const code = char.codePointAt(0)!;
    switch (char) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      default:
        if (code < 0x20) {
          out += `\\u${code.toString(16).padStart(4, "0")}`;
        } else {
          out += char;
        }
    }
  }
  return out + '"';
}

function serialise(value: unknown, path: string): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return serialiseNumber(value);
    case "string":
      return serialiseString(value);
    case "bigint":
      // A bigint is not JSON. Ambit carries atomic amounts as decimal *strings* precisely so that
      // this case never has to guess whether the reader wants a number or a string.
      throw new CanonicalisationError(
        `bigint at ${path} has no JSON representation. Carry atomic amounts as decimal strings.`,
      );
    case "undefined":
      throw new CanonicalisationError(
        `undefined at ${path}. JSON.stringify drops undefined members silently, so two objects that ` +
          `differ only in an undefined field would hash identically. Omit the key or use null.`,
      );
    case "function":
    case "symbol":
      throw new CanonicalisationError(`${typeof value} at ${path} cannot be canonicalised`);
  }

  if (Array.isArray(value)) {
    const items = value.map((item, index) => serialise(item, `${path}[${index}]`));
    return `[${items.join(",")}]`;
  }

  if (value instanceof Date) {
    // Dates are refused rather than coerced: `toISOString` is one of several defensible choices,
    // and a hash must not depend on which one a future reader assumes. Pass the string yourself.
    throw new CanonicalisationError(
      `Date at ${path}. Pass an explicit ISO 8601 string so the serialisation is visible at the call site.`,
    );
  }

  const record = value as Record<string, unknown>;
  const keys = sortKeys(Object.keys(record));
  const members = keys.map((key) => {
    const member = record[key];
    if (member === undefined) {
      throw new CanonicalisationError(
        `undefined at ${path}.${key}. Omit the key rather than setting it to undefined — ` +
          `otherwise this object and one without the key produce the same digest.`,
      );
    }
    return `${serialiseString(key)}:${serialise(member, `${path}.${key}`)}`;
  });
  return `{${members.join(",")}}`;
}

/** Returns the RFC 8785 canonical JSON form of a value, as a string. */
export function canonicalise(value: unknown): string {
  return serialise(value, "$");
}

/** sha256 of the canonical form, lowercase hex. This is the hash every digest in Ambit is built from. */
export function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalise(value), "utf8").digest("hex");
}

/** sha256 of an already-serialised string. Used where the exact bytes are the thing being hashed. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
