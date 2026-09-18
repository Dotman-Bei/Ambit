"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import { getClient, isConfigured } from "./dynamic-client";

/**
 * Dynamic's React provider — `@dynamic-labs-sdk/react-hooks`, the React bindings for the **same SDK
 * generation** as `@dynamic-labs-sdk/client`.
 *
 * Two things here are not optional, and both cost a debugging round to find:
 *
 * 1. **`DynamicProvider` takes our client.** This build briefly used
 *    `@dynamic-labs/sdk-react-core@5.x`, a different SDK generation that shares no client state with
 *    the `@dynamic-labs-sdk/*` line. Sign-in worked and delegation did not — the widget's wallet was
 *    invisible to the delegation calls (`No wallet provider found with key:
 *    dynamicwaasevm:embeddedWallet`, then an empty `getWalletAccounts()`). Two packages that both
 *    say "Dynamic" are not necessarily the same SDK.
 *
 * 2. **`@tanstack/react-query` is a peer dependency, and the QueryClientProvider is ours to mount.**
 *    Every hook in the package is a react-query hook, but `DynamicProvider` does not provide a
 *    client. Without the wrapper below the console renders and then throws
 *    `No QueryClient set, use QueryClientProvider to set one` on hydration — a blank page with a
 *    client-side exception rather than a useful error.
 */

/**
 * One QueryClient for the session. Retries are off: these hooks wrap wallet operations, and a
 * silently retried delegation or revocation is a second attempt at something the user asked for
 * once. Failures surface to the components, which report them by name.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function DynamicProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(makeQueryClient);
  useEffect(() => setMounted(true), []);

  if (!mounted || !isConfigured()) return <>{children}</>;

  return (
    <QueryClientProvider client={queryClient}>
      <DynamicProvider client={getClient()}>{children}</DynamicProvider>
    </QueryClientProvider>
  );
}
