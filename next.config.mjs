import createMDX from '@next/mdx';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 确保所有 URL 都带有尾部斜杠
  // Next.js 会自动处理重定向，无需额外的 redirect 规则
  trailingSlash: true,
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
