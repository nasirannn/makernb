import createMDX from '@next/mdx';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 默认不使用尾部斜杠，但主页需要保留尾部斜杠
  // middleware 会处理主页的尾部斜杠重定向
  trailingSlash: false,
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
        hostname: "startupfa.st",
      },
      {
        protocol: "https",
        hostname: "startupfa.me",
      },
      {
        protocol: "https",
        hostname: "fazier.com",
      },
      {
        protocol: "https",
        hostname: "open-launch.com",
      },
      {
        protocol: "https",
        hostname: "twelve.tools",
      },
      {
        protocol: "https",
        hostname: "wired.business",
      },
      {
        protocol: "https",
        hostname: "frogdr.com",
      },
      {
        protocol: "https",
        hostname: "toolsaiapp.com",
      },
      {
        protocol: "https",
        hostname: "makernb-assets.nasirann.com",
      },
      {
        protocol: "https",
        hostname: "tempfile.aiquickdraw.com",
      },
      {
        protocol: "https",
        hostname: "84826d28beedc6132a2353da3796e843.cdn.bubble.io",
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
