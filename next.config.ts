import type { NextConfig } from "next";

const opencutProxy = process.env.OPENCUT_PROXY_TARGET?.replace(/\/$/, "");
const opencutLocale = process.env.NEXT_PUBLIC_OPENCUT_LOCALE?.trim() || "zh";

const nextConfig: NextConfig = {
  env: {
    ...(opencutProxy && !process.env.NEXT_PUBLIC_OPENCUT_EDITOR_URL
      ? { NEXT_PUBLIC_OPENCUT_EDITOR_URL: "/opencut-proxy/projects" }
      : {}),
    NEXT_PUBLIC_OPENCUT_LOCALE: opencutLocale,
  },
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
    "@ffprobe-installer/darwin-x64",
    "@ffmpeg-installer/darwin-x64",
  ],
  async rewrites() {
    if (!opencutProxy) return [];
    return [
      {
        source: "/opencut-proxy/:path*",
        destination: `${opencutProxy}/:path*`,
      },
    ];
  },
};

export default nextConfig;
