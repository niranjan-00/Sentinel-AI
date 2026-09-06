/** @type {import('next').NextConfig} */
const nextConfig = {
reactStrictMode: false,

typescript: {
ignoreBuildErrors: true,
},

images: {
remotePatterns: [
{
protocol: "https",
hostname: "**",
},
],
},
};

module.exports = nextConfig;
