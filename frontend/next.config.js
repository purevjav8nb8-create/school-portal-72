const nextConfig = {
  devIndicators: false,
  experimental: {
    agentUpgrade: 'security',
  },
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;