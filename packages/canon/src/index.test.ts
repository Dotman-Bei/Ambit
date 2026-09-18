import { describe, expect, it } from "vitest";
import { canonicalHash, canonicalise, CanonicalisationError } from "./index.js";

/**
 * RFC 8785 conformance, and the specific failure modes that would quietly break §11's digest
 * binding. Each test here corresponds to a way two "equal" objects could serialise differently.
 */

describe("RFC 8785 canonical JSON", () => {
  it("orders object keys by UTF-16 code unit, not by insertion", () => {
    expect(canonicalise({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalise({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it("orders nested keys too", () => {
    expect(canonicalise({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}');
  });

  it("sorts uppercase before lowercase, per code-unit order rather than locale order", () => {
    // A locale-aware comparator would put "a" before "B". RFC 8785 does not.
    expect(canonicalise({ a: 1, B: 2 })).toBe('{"B":2,"a":1}');
  });

  it("preserves array order, because an array is a sequence and not a set", () => {
    expect(canonicalise([3, 1, 2])).toBe("[3,1,2]");
  });

  it("serialises -0 as 0", () => {
    expect(canonicalise({ v: -0 })).toBe('{"v":0}');
  });

  it("uses the mandated short escapes", () => {
    expect(canonicalise("a\nb\tc\"d\\e")).toBe('"a\\nb\\tc\\"d\\\\e"');
  });

  it("escapes other control characters as \\u", () => {
    expect(canonicalise("")).toBe('"\\u0001"');
  });

  it("does not escape non-ASCII, which RFC 8785 keeps literal in UTF-8", () => {
    expect(canonicalise("café")).toBe('"café"');
  });

  it("emits null for null and keeps it distinct from an absent key", () => {
    expect(canonicalise({ a: null })).toBe('{"a":null}');
    expect(canonicalise({})).toBe("{}");
  });
});

describe("refusals that protect the digest binding", () => {
  it("refuses undefined rather than dropping the key, which would collide two different objects", () => {
    // JSON.stringify({a:1,b:undefined}) === JSON.stringify({a:1}). If canonicalise did the same,
    // two bindings differing in one field would mint the same digest. §11 depends on it not doing that.
    expect(() => canonicalise({ a: 1, b: undefined })).toThrow(CanonicalisationError);
  });

  it("refuses NaN and Infinity rather than writing null", () => {
    expect(() => canonicalise({ v: Number.NaN })).toThrow(CanonicalisationError);
    expect(() => canonicalise({ v: Number.POSITIVE_INFINITY })).toThrow(CanonicalisationError);
  });

  it("refuses a Date rather than guessing a serialisation", () => {
    expect(() => canonicalise({ at: new Date(0) })).toThrow(CanonicalisationError);
  });

  it("refuses a bigint, because atomic amounts travel as decimal strings", () => {
    expect(() => canonicalise({ v: 1n })).toThrow(CanonicalisationError);
  });

  it("names the path of the offending member so a failure is actionable", () => {
    expect(() => canonicalise({ outer: { inner: undefined } })).toThrow(/outer\.inner/);
  });
});

describe("canonicalHash", () => {
  it("is stable across key ordering", () => {
    expect(canonicalHash({ a: 1, b: 2 })).toBe(canonicalHash({ b: 2, a: 1 }));
  });

  it("differs when any value differs", () => {
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 2 }));
  });

  it("distinguishes the string \"1\" from the number 1", () => {
    // A rail that reads an amount as a number in one place and a string in another would otherwise
    // produce matching digests for two different payments.
    expect(canonicalHash({ v: "1" })).not.toBe(canonicalHash({ v: 1 }));
  });

  it("returns lowercase 64-char hex", () => {
    expect(canonicalHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the RFC 8785 worked example's ordering for a mixed object", () => {
    const value = { "€": "Euro Sign", "\r": "Carriage Return", "1": "One", "": "Control" };
    // Sorted by UTF-16 code unit: "\r" (000D) < "1" (0031) < "" < "€"
    expect(canonicalise(value)).toBe(
      '{"\\r":"Carriage Return","1":"One","":"Control","€":"Euro Sign"}',
    );
  });
});
