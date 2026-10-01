/** @type {import("next").NextConfig} */
const securityHeaders=[
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"X-Frame-Options",value:"DENY"},
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"},
  {key:"Cross-Origin-Opener-Policy",value:"same-origin"},
  {key:"Cross-Origin-Embedder-Policy",value:"require-corp"},
  {key:"Cross-Origin-Resource-Policy",value:"same-origin"},
  {
    key:"Content-Security-Policy",
    value:[
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "worker-src 'self' blob:",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "manifest-src 'self'"
    ].join("; ")
  }
];

/** @type {import("next").NextConfig} */
const nextConfig={
  reactStrictMode:true,
  poweredByHeader:false,
  serverExternalPackages:["@resvg/resvg-js","sharp","pdf-lib"],
  async headers(){
    return [
      {
        source:"/:path*",
        headers:securityHeaders
      },
      {
        source:"/wasm/:path*",
        headers:[
          {key:"Cache-Control",value:"public, max-age=31536000, immutable"},
          {key:"Cross-Origin-Resource-Policy",value:"same-origin"}
        ]
      }
    ];
  }
};
export default nextConfig;
