/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig = {
  output: 'export',
  // Intentionally empty — server features will be added in the future
}

module.exports = withPWA(nextConfig)
