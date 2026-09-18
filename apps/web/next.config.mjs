/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // The packages are TypeScript source in the workspace rather than built dist, so Next compiles
  // them alongside the app. Keeps the type boundary real instead of shipping a stale build.
  transpilePackages: ["@ambit/sdk", "@ambit/shared", "@ambit/canon"],
};
