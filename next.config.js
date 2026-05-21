/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    // Keep console.error and console.warn in production for server-side debugging
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  // Prevent Turbopack from bundling native/network packages
  serverExternalPackages: ['ldapts', 'ldapjs'],
}

module.exports = nextConfig
