import { memo, useId } from 'react';
import type { SparkAvatar } from '../domain/types';
import { AnimeAvatar } from './AnimeAvatar';
interface Props { avatar: SparkAvatar; size?: number; active?: boolean; className?: string }
export const AvatarView = memo(function AvatarView({ avatar, size = 50, active = false, className = '' }: Props) {
  const local = useId().replace(/:/g, '');
  const id = `avatar-${local}`;
  const image = avatar.expressionImages?.[avatar.expression] ?? avatar.image;
  if (image?.startsWith('data:image/')) {
    return <img className={`spark-avatar ${active && avatar.animate ? 'avatar-active' : ''} ${className}`} src={image} alt="Custom Spark avatar" style={{ width: size, height: size }} />;
  }
  if (avatar.style === 'anime') return <AnimeAvatar avatar={avatar} size={size} active={active} className={className} />;
  return <svg className={`spark-avatar ${active && avatar.animate ? 'avatar-active' : ''} ${className}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${avatar.style} Spark avatar`}>
    <defs>
      <linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop stopColor={avatar.color} /><stop offset="1" stopColor={avatar.secondary} /></linearGradient>
      <clipPath id={`${id}-clip`}><rect x="0" y="0" width="100" height="100" rx="26" /></clipPath>
    </defs>
    <g clipPath={`url(#${id}-clip)`}>
      <rect width="100" height="100" fill={`url(#${id})`} />
      {avatar.style === 'portrait' ? <>
        <circle cx="50" cy="45" r="26" fill="rgba(12,18,36,.28)" />
        <path d="M9 104 Q13 76 40 73 L61 73 Q89 78 91 104" fill="rgba(8,14,30,.45)" />
        {avatar.hair !== 'none' && <path d={avatar.hair === 'short' ? 'M27 37 Q28 15 51 15 Q76 17 75 40 L70 43 Q66 31 50 31 Q36 33 31 43 Z' : 'M23 39 Q19 6 51 12 Q78 12 77 43 L72 50 Q67 29 49 31 Q34 32 27 52 Z'} fill="rgba(15,20,42,.60)" />}
        {avatar.accessory === 'glasses' && <g fill="none" stroke="white" strokeWidth="2"><rect x="34" y="41" width="15" height="12" rx="4"/><rect x="52" y="41" width="15" height="12" rx="4"/><path d="M49 44 L52 44"/></g>}
        {avatar.accessory === 'halo' && <ellipse cx="50" cy="15" rx="25" ry="7" fill="none" stroke="white" strokeWidth="3" opacity=".9" />}
        <circle cx="41" cy="47" r="2.5" fill="white"/><circle cx="60" cy="47" r="2.5" fill="white"/>
        <path d={avatar.expression === 'happy' ? 'M42 61 Q51 71 60 61' : avatar.expression === 'curious' ? 'M43 63 Q52 66 60 61' : 'M44 62 L58 62'} fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      </> : avatar.style === 'orb' ? <>
        <circle cx="50" cy="48" r="30" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.72)" strokeWidth="1.3"/>
        <ellipse cx="43" cy="39" rx="15" ry="8" transform="rotate(-35 43 39)" fill="rgba(255,255,255,.25)" />
        <path d="M15 75 Q50 95 86 70" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.8" />
        <circle cx="48" cy="48" r="6" fill="white" opacity=".85" />
      </> : <>
        <path d="M50 13 84 33 84 69 50 88 16 69 16 33Z" fill="rgba(10,18,32,.18)" stroke="rgba(255,255,255,.58)" strokeWidth="2" />
        <text x="50" y="66" textAnchor="middle" fontSize="42" fill="white" fontWeight="600">{avatar.glyph.slice(0, 2)}</text>
      </>}
    </g>
  </svg>;
});
