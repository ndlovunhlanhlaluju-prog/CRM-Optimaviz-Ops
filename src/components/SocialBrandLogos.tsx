import React from 'react';

type LogoProps = {
  size?: number;
  className?: string;
  title?: string;
};

/** Official-style brand marks (SVG) for Social Hub UI. */
export function FacebookLogo({ size = 22, className, title = 'Facebook' }: LogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role="img">
      {title ? <title>{title}</title> : null}
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.491 0-1.956.93-1.956 1.886v2.26h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}

export function InstagramLogo({ size = 22, className, title = 'Instagram' }: LogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role="img">
      {title ? <title>{title}</title> : null}
      <defs>
        <radialGradient id="igGrad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <path
        fill="url(#igGrad)"
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
      />
    </svg>
  );
}

export function LinkedInLogo({ size = 22, className, title = 'LinkedIn' }: LogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role="img">
      {title ? <title>{title}</title> : null}
      <path
        fill="#0A66C2"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      />
    </svg>
  );
}

/** Official Meta infinity mark (blue). */
export function MetaLogo({ size = 22, className, title = 'Meta' }: LogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 24" aria-hidden={title ? undefined : true} role="img">
      {title ? <title>{title}</title> : null}
      <path
        fill="#0668E1"
        d="M8.5 2.5C4.4 2.5.8 6.3.8 12S4.4 21.5 8.5 21.5c2.7 0 4.9-1.7 6.8-4.1 1.9 2.4 4.1 4.1 6.8 4.1 4.1 0 7.7-3.8 7.7-9.5S26.2 2.5 22.1 2.5c-2.7 0-4.9 1.7-6.8 4.1C13.4 4.2 11.2 2.5 8.5 2.5zm0 3.2c1.8 0 3.5 1.5 5 3.7-1.5 2.2-3.2 3.7-5 3.7S3.5 11.6 2 9.4c1.5-2.2 3.2-3.7 5-3.7zm13.6 0c1.8 0 3.5 1.5 5 3.7-1.5 2.2-3.2 3.7-5 3.7s-3.5-1.5-5-3.7c1.5-2.2 3.2-3.7 5-3.7z"
      />
    </svg>
  );
}

/** Compact paid-media mark used in the Social Hub Ads surfaces. */
export function MetaAdsLogo({ size = 22, className, title = 'Meta Ads' }: LogoProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role="img">
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="paidMediaMark" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F766E" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="7" fill="url(#paidMediaMark)" />
      <path d="M6.5 16.5V13M11 16.5V10.5M15.5 16.5V7.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m7 9 3-2 2.6 1.2L17.5 5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m15.6 5 1.9 0 0 1.9" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SocialNetworkLogo({
  network,
  size = 22,
}: {
  network: 'facebook' | 'instagram' | 'linkedin' | 'meta';
  size?: number;
}) {
  if (network === 'facebook') return <FacebookLogo size={size} />;
  if (network === 'instagram') return <InstagramLogo size={size} />;
  if (network === 'linkedin') return <LinkedInLogo size={size} />;
  return <MetaLogo size={size} />;
}
