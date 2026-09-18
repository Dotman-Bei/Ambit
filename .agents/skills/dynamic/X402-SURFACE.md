# x402 surface — pinned, verified against the shipping library

Verified 2026-09-17 against `x402@1.2.0` by reading its published types, compiled source and README.
PRD §0.11: *"If a Dynamic assumption in this PRD conflicts with current upstream docs or SDK behaviour,
upstream wins."* Two PRD assumptions conflict. Both are recorded in `DECISIONS.md` as D-002.

## Two corrections to PRD §12.2

### 1. The challenge is in the response BODY, not a `payment-required` header

PRD §12.2 states the challenge is carried in a `payment-required` response header as base64 JSON with an
empty body, and warns that a client reading only the body sees an empty 402. **That is not what
`x402@1.2.0` does.** Its README, "Manual Client Integration", step 1:

> Make a request to a x402-protected endpoint. The server will respond with a 402 status code and a
> JSON object containing: `x402Version` … `accepts`: An array of payment requirements you can fulfill

The only headers the library defines are `X-PAYMENT` (request, the signed payload the client sends) and
`X-PAYMENT-RESPONSE` (response, the settlement receipt). There is no `payment-required` header anywhere
in the package. Grep of the whole `dist/`:

```
4 X-PAYMENT-RESPONSE
4 "X-PAYMENT"
0 payment-required
```

**Ambit implements body-first parsing**, and *additionally* tolerates a header-carried challenge if one
is ever present, because the PRD anticipated one and a provider may yet ship it. Neither shape is
allowed to produce a wrong "the service is broken" conclusion. `parseChallenge` reports which source it
read from, and that source is recorded on the receipt. The body is authoritative when both exist.

### 2. The protocol version is 1, not 2

`x402@1.2.0` declares `x402Versions: readonly [1]`. The PRD calls the rail "x402 v2" throughout. There is
no version 2 in the shipping library, and `PaymentPayloadSchema.x402Version` validates against that list.
Ambit sends whatever version the challenge declares and refuses a version it cannot construct a payload
for, with `RAIL_UNAVAILABLE`. It does not hard-code `2`. The product still calls the rail "x402"; the
"v2" in the PRD is treated as prose, not as a wire value.

## PaymentRequirements (the challenge entry)

```ts
{
  scheme: "exact";                 // only scheme in the enum
  network: string;                 // e.g. "base", "base-sepolia"
  maxAmountRequired: string;       // atomic units, as a decimal string
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;                   // token contract address
  extra?: Record<string, any>;     // carries EIP-712 domain `name` and `version`
}
```

`maxAmountRequired` is in **atomic units** (6 decimals for USDC), not a human decimal. Ambit converts
once, at the boundary, and the policy engine compares atomic to atomic. A float never touches an amount.

## The payment payload — EIP-3009, signed as EIP-712

Read out of the compiled `signAuthorization` in `x402@1.2.0`:

```ts
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from",        type: "address" },
    { name: "to",          type: "address" },
    { name: "value",       type: "uint256" },
    { name: "validAfter",  type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce",       type: "bytes32" },
  ],
};

const data = {
  types: authorizationTypes,
  primaryType: "TransferWithAuthorization",
  domain: {
    name:             extra?.name,          // from PaymentRequirements.extra
    version:          extra?.version,       // from PaymentRequirements.extra
    chainId:          getNetworkId(network),
    verifyingContract: getAddress(asset),
  },
  message: { from, to, value, validAfter, validBefore, nonce },
};
```

**This is why the payment leg calls `delegatedSignTypedData` and not `delegatedSignTransaction`.**
Ambit never broadcasts a transaction; the facilitator submits the authorization. Ambit builds exactly
this typed-data object, hands it to Dynamic's delegated signer, and attaches the returned signature.

The signed payload is then base64-encoded into the `X-PAYMENT` request header:

```ts
{ x402Version, scheme: "exact", network, payload: { signature, authorization: { from, to, value, validAfter, validBefore, nonce } } }
```

### Why `approve` is never called — and why that is structurally true here

PRD §12.3 forbids ERC-20 `approve`. EIP-3009 `transferWithAuthorization` makes that a property of the
rail rather than a rule Ambit has to remember: the signature authorises **one transfer of one value to
one recipient inside one time window with one nonce**. There is no allowance to set and none to drain.
`validBefore` expires it. The `nonce` makes it single-use at the token contract. This is the strongest
alignment between the PRD's thesis and the chosen rail, and it should be said out loud in the demo.

## Settlement evidence

The provider returns `X-PAYMENT-RESPONSE`, base64 JSON, decoded by `decodeXPaymentResponse(header)`.
It carries the settlement transaction hash. That hash is the R3 / G4 evidence artefact. If the header is
absent on a 200, Ambit records `SETTLEMENT_EVIDENCE_MISSING` and does **not** invent a hash — the
resource may still have been delivered, so the intent goes to `MANUAL_REVIEW` per PRD §12.3 rather than
being retried.

## Error reasons the facilitator can return

`insufficient_funds`, `invalid_exact_evm_payload_authorization_value`,
`invalid_exact_evm_payload_authorization_valid_before`, `invalid_exact_evm_payload_signature`,
`invalid_exact_evm_payload_recipient_mismatch`, `payment_expired`, `invalid_scheme`, `invalid_network`,
`duplicate_settlement`, and others. Ambit maps these to its own named reason codes rather than surfacing
a raw string, and keeps the upstream reason alongside for the receipt.

`invalid_exact_evm_payload_recipient_mismatch` and `invalid_exact_evm_payload_authorization_value` are
what spike `01-x402-settlement-spike` LOCK condition 4 expects to see when an underpaid or misdirected
payment is submitted. They are the provider's proof that it is not silently accepting bad payments.
