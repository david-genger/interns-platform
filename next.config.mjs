/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Profile images / resumes are served from Supabase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
