import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // 'output: export' is required for the Tauri production build (frontendDist: ../out),
  // but next dev enforces generateStaticParams() for every dynamic route under this mode,
  // which breaks client-side navigation to real ids (e.g. /clientes/[id]) in dev.
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' as const } : {}),

  images: {
    unoptimized: true,
  },

  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
};

export default nextConfig;
