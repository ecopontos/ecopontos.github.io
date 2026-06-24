import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },

  turbopack: {
    root: path.resolve(__dirname, '..'),
  },

  async redirects() {
    return [
      {
        source: '/tarefas/:id',
        destination: '/tasks/:id',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
