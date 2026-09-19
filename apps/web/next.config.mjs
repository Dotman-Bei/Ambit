/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // The packages are TypeScript source in the workspace rather than built dist, so Next compiles
  // them alongside the app. Keeps the type boundary real instead of shipping a stale build.
  transpilePackages: ["@ambit/sdk", "@ambit/shared", "@ambit/canon"],
  /**
   * Development only: proxy /api to the local authority service so the browser sees one origin.
   *
   * It exists because the demo capture needed same-origin requests. It is guarded because the
   * destination is 127.0.0.1:4020, which does not exist on a deployment host. Shipped unguarded it
   * would be a rewrite pointing at a loopback address on a machine that has nothing listening there.
   * In production the console reads NEXT_PUBLIC_AMBIT_API, an absolute URL, and never touches /api.
   */
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:4020/:path*",
      },
    ];
  },
};
