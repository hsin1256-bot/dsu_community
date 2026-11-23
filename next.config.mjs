/** @type {import('next').NextConfig} */

// 모든 응답에 붙는 기본 보안 헤더
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // next/image 를 사용하지 않으므로 이미지 최적화 원격 도메인 설정은 두지 않음
  // (Next 14 의 Image Optimizer 관련 DoS 취약점 노출 면적 축소)
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
