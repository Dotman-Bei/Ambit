"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * Loads a component in the browser only.
 *
 * The Dynamic hooks need a provider that builds a react-query `QueryClient`, which cannot exist
 * during server rendering. Gating the *provider* on hydration was not enough — the components that
 * call hooks still rendered on the server pass and threw `MissingProviderError`. The gate has to be
 * on the consumers, so anything touching wallet state is loaded through this.
 *
 * `loading` renders a static pending bar rather than a spinner: a skeleton that animates implies
 * progress it cannot measure.
 */
export function clientOnly(
  load: () => Promise<{ default: ComponentType }>,
  height = "1.5rem",
): ComponentType {
  return dynamic(load, {
    ssr: false,
    loading: () => (
      <div aria-busy="true" style={{ padding: ".4rem 0" }}>
        <span className="sr-only">Loading wallet state.</span>
        <div className="pending-bar" style={{ width: "40%", height }} />
      </div>
    ),
  });
}
