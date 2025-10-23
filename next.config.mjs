import createMDX from '@next/mdx';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/(.*)/',
        destination: '/$1',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://www.google-analytics.com https://ssl.google-analytics.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data:",
              "connect-src 'self' https://www.google-analytics.com https://*.supabase.co https://kieaifiles.erweima.ai https://cdn.makernb.com https://makernb-assets.nasirann.com https://tempfile.aiquickdraw.com",
              "media-src 'self' blob: https: http:",
              "frame-src 'self' https://www.google.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh4.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh5.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh6.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "kieaifiles.erweima.ai",
      },
      {
        protocol: "https",
        hostname: "cdn.makernb.com",
      },
      {
        protocol: "https",
        hostname: "api.producthunt.com",
      },
      {
        protocol: "https",
        hostname: "makernb-assets.nasirann.com",
      },
      {
        protocol: "https",
        hostname: "tempfile.aiquickdraw.com",
      },
    ],
    // R2 处理图片优化，Next 不需要再优化
    unoptimized: true,
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
  },
});

export default withMDX({
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  ...nextConfig,
});
