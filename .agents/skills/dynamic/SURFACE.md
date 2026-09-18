# Dynamic SDK surface — pinned, verified, not inferred

PRD §0.3: *"Never invent a Dynamic SDK surface. Read the pinned docs in `.agents/skills/dynamic/` before
calling anything."* This file is that pin. Every signature below was read out of the published
`.d.ts` files of the exact versions named here, not from memory and not from prose documentation.

Verified on 2026-09-17 by installing the packages and reading their type declarations.

## Pinned versions

| Package | Version | `dist.shasum` |
|---|---|---|
| `@dynamic-labs-sdk/client` | `1.33.4` | `6c001533d2732cd827abab983da852a1748281ca` |
| `@dynamic-labs-wallet/node-evm` | `1.1.12` | `ab081b361aaded89da2cc2cf9429700d47c89e8d` |

Integrity (subresource form):
```
@dynamic-labs-sdk/client@1.33.4      sha512-tlQsZDuPAHgomQmHiH/9JMKyE0ednn0nURZ+CAwYwXo+l9kwPWhwHBqJbee7Xbv9Is70+qcVsdWa6gq1mcjAKQ==
@dynamic-labs-wallet/node-evm@1.1.12 sha512-lM5x9zLPvzpskDQ1bczoEt2hdDyQS+2eRs0gVohy/fDWWZHn/M8DAk4onV6bV1VC0KjBHQ2LkI2AspEWqDgZzg==
```

If either version changes, re-read the `.d.ts` files and update this file in the same change.

---

## Client surface — `@dynamic-labs-sdk/client`

The package publishes four export subpaths: `.`, `./core`, `./waas`, `./waas/core`.
The delegation calls live under **`./waas`**. Importing them from the root subpath will not resolve.

```ts
// from '@dynamic-labs-sdk/client'
declare const getWalletAccounts: (client?: DynamicClient) => WalletAccount[];

// from '@dynamic-labs-sdk/client/waas'
declare const hasDelegatedAccess: (
  params: { walletAccount: WalletAccount },
  client?: DynamicClient,
) => boolean;                                   // NOTE: synchronous. Not a Promise.

declare const delegateWaasKeyShares: (
  params: {
    walletAccount: WalletAccount;
    password?: string;
    initialSignerRules?: WaasPolicyRule[];      // seeds Dynamic's own signer policy layer
  },
  client?: DynamicClient,
) => Promise<void>;                             // NOTE: resolves void. Credentials arrive by webhook.

declare const revokeWaasDelegation: (
  params: { walletAccount: WalletAccount; password?: string },
  client?: DynamicClient,
) => Promise<void>;
```

Three facts that shape the Ambit design, each read off the declaration rather than assumed:

1. **`hasDelegatedAccess` is synchronous.** It reads client state. It is a render-time check, not an
   effect. It is *not* proof the Ambit server holds usable credentials — it reports the client's view.
   The authority service's own `GET /delegation/status` is the authoritative answer, because only the
   server knows whether the webhook arrived and decrypted. PRD §9 requires both to be shown.
2. **`delegateWaasKeyShares` resolves `void`.** It does not hand the credentials back to the browser.
   They reach Ambit only through the `wallet.delegation.created` webhook. There is no client-side path
   that shortcuts the webhook, so PRD §28 kill-criterion 5 (webhook not publicly reachable) is real and
   its Direct-pathway fallback is the only alternative.
3. **`initialSignerRules` exists on the delegation call.** Dynamic has its own signer-side policy layer.
   Ambit does not use it in phase 1 — PRD §28 kill-criterion 2 says policy enforcement lives in the Ambit
   authority service and that Dynamic-side enforcement must not be implied. The parameter is documented
   here so nobody later mistakes Ambit's enforcement for signer-side enforcement.

`WaasPolicyRule` is re-exported from `@dynamic-labs-wallet/browser-wallet-client`.

---

## Server surface — `@dynamic-labs-wallet/node-evm`

```ts
export type DelegatedEvmClientConfig = {
  environmentId: string;
  apiKey: string;
  baseApiUrl?: string;
  baseMPCRelayApiUrl?: string;
  debug?: boolean;
};

export type DelegatedEvmWalletClient = DelegatedWalletClient & { readonly chainName: 'EVM' };

export declare const createDelegatedEvmWalletClient:
  (config: DelegatedEvmClientConfig) => DelegatedEvmWalletClient;   // synchronous factory

export declare const delegatedSignMessage: (
  client: DelegatedEvmWalletClient,
  args: {
    walletId: string;
    walletApiKey: string;
    keyShare: ServerKeyShare;
    message: string;
    shareSetId?: string;
    derivationPath?: Uint32Array;
    context?: SignMessageContext;
    onError?: (error: Error) => void;
  },
) => Promise<string>;

export declare const delegatedSignTypedData: (
  client: DelegatedEvmWalletClient,
  args: {
    walletId: string;
    walletApiKey: string;
    keyShare: ServerKeyShare;
    typedData: TypedData;          // viem TypedData
    shareSetId?: string;
    derivationPath?: Uint32Array;
  },
) => Promise<string>;

export declare const delegatedSignTransaction: (
  client: DelegatedEvmWalletClient,
  args: {
    walletId: string;
    walletApiKey: string;
    keyShare: ServerKeyShare;
    transaction: TransactionSerializable;   // viem
    shareSetId?: string;
    derivationPath?: Uint32Array;
    context?: SignMessageContext;
  },
) => Promise<string>;

export declare const revokeDelegation: (
  client: DelegatedEvmWalletClient,
  args: { walletId: string },
) => Promise<void>;
```

`ServerKeyShare` is `EcdsaKeygenResult | Ed25519KeygenResult | BIP340KeygenResult`
(`@dynamic-labs-wallet/node/src/mpc/types`). For EVM it is the ECDSA variant. Ambit treats it as an
opaque credential: it is decrypted, re-encrypted at rest, passed straight back to the SDK, and never
logged, never serialised into a response, never written to `evidence/`.

### Which signing call the x402 payment leg uses

**`delegatedSignTypedData`.** x402 v2 `exact` settlement on an EVM chain is an EIP-3009
`TransferWithAuthorization`, which is EIP-712 typed data. It is not a raw transaction that Ambit
broadcasts — the facilitator submits it. So the payment leg signs typed data and never calls
`delegatedSignTransaction`. This is the single most load-bearing SDK fact in the build and it is
why `packages/payments-x402` builds an EIP-712 payload rather than a transaction.

`delegatedSignMessage` is used for the delegation liveness probe only
(`engineering/00-dynamic-delegation-spike`), because it proves the credentials produce a real
signature without needing a funded wallet.

### `shareSetId` — a footgun the declaration documents in place

The doc comment on every signing call says: `shareSetId` is the `shareSetId` from the
`wallet.delegation.created` webhook payload, a `WaasWallets.id` — **not** `keyShares[].id` from
`byWalletAddress`, which is a `WalletKeyShares.id` and a different primary key. Omitting it makes the
server resolve the share set from `walletId` + share-set type. Ambit stores whatever the webhook sends
and passes it through when present. It never substitutes a key-share row id.

---

## Webhook events (PRD §7.3)

| Event | Ambit handler behaviour |
|---|---|
| `wallet.delegation.created` | RSA-decrypt the credential envelope, re-encrypt at rest, store per user |
| `wallet.delegation.revoked` | delete the stored credentials; every later spend request is `403 DELEGATION_REVOKED` |
| `ping` | `200`, no side effects |

The credential envelope carries `walletId`, `walletApiKey`, `keyShare`, and (per the SDK doc comment
above) `shareSetId`. Exact envelope field casing must be confirmed against a live sandbox delivery
before `LIVE` is claimed for G2 — the spike in `engineering/00-dynamic-delegation-spike` is what
confirms it. Until a real payload is captured, `evidence/claims.json` holds G2 at `NOT_YET_PROVEN`.

## What delegated access does not permit (PRD §7.4)

No private key export, no resharing, no modification of Dynamic policies. Ambit's policy layer
therefore sits **above** the signing surface, in the authority service, not inside Dynamic's key
material. Nothing in the surface above contradicts this.
