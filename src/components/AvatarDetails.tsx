import type { AnimeAppearance, Expression } from '../domain/types';
import type { CharacterArtStyle } from '../avatar/layer-system';

interface DetailsProps { appearance: AnimeAppearance; style: CharacterArtStyle; expression: Expression; id: string }

/** Custom hand-built vector details; the renderer can independently transform this eye layer. */
export function DetailedAnimeEyes({ appearance: a, style, expression, id }: DetailsProps) {
  const closed = expression === 'happy' || expression === 'embarrassed';
  const scale = (a.eyeScale / 100) * (style === 'chibi' ? 1.24 : style === 'classic' ? 1.04 : 1);
  const sleepy = ['sleepy', 'hooded', 'narrow'].includes(a.eyeShape);
  const wide = ['wide', 'doll', 'round', 'gentle'].includes(a.eyeShape);
  const irisY = sleepy ? 105.7 : 108;
  const yDepth = wide ? 10.5 : sleepy ? 4 : 7;
  const color = [a.leftEyeColor || a.eyeColor, a.rightEyeColor || a.eyeColor];
  return <g className={a.animateEyes === false ? undefined : 'anime-blink'}>
    {([78, 124] as const).map((x, index) => <g key={x}>
      {closed ? <path d={`M${x-15} 108 Q${x} 94 ${x+15} 108`} fill="none" stroke={a.hairColor} strokeWidth={style === 'classic' ? 3 : 2.5} strokeLinecap="round" /> : <>
        <defs><clipPath id={`${id}-eye-${index}`}><path d={`M${x-15} 107 Q${x} ${106-yDepth*1.6} ${x+15} 107 Q${x} ${107+yDepth*1.35} ${x-15} 107 Z`} /></clipPath>
          <radialGradient id={`${id}-iris-${index}`} cx="40%" cy="30%" r="77%"><stop offset="0" stopColor="#ffffff" stopOpacity=".65"/><stop offset=".23" stopColor={color[index]}/><stop offset=".68" stopColor={color[index]}/><stop offset="1" stopColor={a.hairColor}/></radialGradient>
        </defs>
        <path d={`M${x-15} 107 Q${x} ${106-yDepth*1.6} ${x+15} 107 Q${x} ${107+yDepth*1.35} ${x-15} 107 Z`} fill="#fffdfb" stroke={a.hairColor} strokeWidth={style === 'classic' ? 2.7 : 2.1}/>
        <g clipPath={`url(#${id}-eye-${index})`}>
          <g transform={`translate(${x} ${irisY}) scale(${scale})`}>
            <ellipse cx="0" cy="1" rx={wide ? 8.3 : 7.2} ry={10.8} fill={style === 'classic' ? color[index] : `url(#${id}-iris-${index})`} stroke={a.hairColor} strokeWidth="1.2"/>
            <ellipse cx="0" cy="4.5" rx="5.6" ry="5.4" fill={a.hairColor} opacity=".22" />
            {(a.irisPattern === 'sunburst' || a.irisPattern === 'constellation') && Array.from({ length: 14 }, (_, i) => <path key={i} d="M0 -5.7 V-9.3" transform={`rotate(${i*360/14})`} stroke="#fdf5ff" strokeWidth=".7" opacity=".78"/>)}
            {(a.irisPattern === 'ringed' || a.irisPattern === 'nebula') && <ellipse rx="5.4" ry="8.1" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity=".67" />}
            {a.irisPattern === 'spiral' && <path d="M-3 1Q-7 -6 0 -7Q8 -6 6 2Q3 8 -3 5" fill="none" stroke="#fff" strokeWidth="1" opacity=".65"/>}
            {a.irisPattern === 'flower' && Array.from({ length: 7 }, (_, i) => <ellipse key={i} cy="-4" rx="2" ry="3.3" fill="#fff" opacity=".46" transform={`rotate(${i*360/7})`} />)}
            {a.irisPattern === 'diamond' && <path d="M0 -7L6 0 0 7 -6 0Z" fill="none" stroke="#fff" strokeWidth="1" opacity=".85"/>}
            {(a.irisPattern === 'sparkle' || a.irisPattern === 'constellation') && <path d="M-7 -3L-3 -3 M-5 -5L-5 -1 M4 3L8 3 M6 1L6 5" stroke="#fff" strokeWidth="1.1" opacity=".8"/>}
            {a.pupil === 'star' ? <path d="M0 -5L1.6 -1.7 5 0 1.6 1.7 0 5 -1.6 1.7 -5 0 -1.6 -1.7Z" fill="#1e1934"/> : a.pupil === 'slit' || a.pupil === 'cat' ? <ellipse cy=".5" rx="1.7" ry="6.2" fill="#15142b"/> : a.pupil === 'heart' ? <path d="M0 5Q-8 -1 -4 -4Q-1 -6 0 -3Q3 -6 5 -3Q8 0 0 5Z" fill="#251934"/> : a.pupil === 'diamond' ? <path d="M0 -6L3 0 0 6 -3 0Z" fill="#251934"/> : <ellipse rx="3.5" ry="5" fill="#1d1b35"/>}
            <ellipse cx="-3" cy="-4" rx="3.1" ry="4.0" fill="#fff" opacity={a.sparkle / 100}/>
            <circle cx="3.4" cy="3" r="1.4" fill="#fff" opacity=".91"/>
          </g>
        </g>
        <path d={`M${x-15} 107Q${x} ${106-yDepth*1.6} ${x+15} 107`} fill="none" stroke={a.hairColor} strokeWidth={a.eyeShape === 'sharp' || a.eyeShape === 'fox' ? 3.8 : 2.8} strokeLinecap="round" />
        {[-1, 1].map((side) => <path key={side} d={`M${x+side*13} 106l${side*4} -4`} stroke={a.hairColor} strokeWidth="1.9" strokeLinecap="round"/>)}
        <path d={`M${x-11} ${110+yDepth*.8}Q${x} ${113+yDepth} ${x+10} ${111+yDepth*.7}`} stroke={a.hairColor} opacity=".22" strokeWidth=".9" fill="none" />
      </>}
    </g>)}
  </g>;
}

/** Fine hand-placed silhouette strand work. Rendered above hair as its own optional detail layer. */
export function AnimeHairFinish({ appearance: a, style }: Omit<DetailsProps, 'expression' | 'id'>) {
  const ink = a.hairColor;
  return <g pointerEvents="none">
    <path d="M65 65Q80 35 100 33M75 71Q91 48 103 47M118 42Q137 50 143 75" fill="none" stroke={a.hairAccent} strokeWidth={style === 'classic' ? 2.4 : 1.5} strokeLinecap="round" opacity={style === 'classic' ? .56 : .8} />
    <path d="M52 110Q43 148 52 186M147 109Q152 149 141 190" fill="none" stroke={ink} strokeWidth=".8" opacity=".45"/>
    <path d="M60 82Q64 103 58 123M140 85Q136 109 143 126" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".27"/>
    {style !== 'classic' && <g fill="#fff" opacity=".28"><ellipse cx="83" cy="37" rx="3.5" ry="1.2" transform="rotate(-22 83 37)"/><ellipse cx="123" cy="42" rx="5" ry="1.2" transform="rotate(26 123 42)" /></g>}
  </g>;
}

export function AnimeOutfitFinish({ appearance: a, style }: Omit<DetailsProps, 'expression' | 'id'>) {
  return <g pointerEvents="none" opacity={style === 'classic' ? .50 : .78}>
    <path d="M33 192Q41 173 62 173M138 174Q164 177 169 195" stroke="#fff" fill="none" strokeWidth="2.1" opacity=".4" />
    <path d="M49 178Q66 186 71 204M150 180Q136 191 130 205" fill="none" stroke={a.outfitAccent} strokeWidth="1.8" />
    {(a.outfit === 'uniform' || a.outfit === 'blazer' || a.outfit === 'sailor') && <g><path d="M100 182L100 206" stroke="#f6f1ee" strokeWidth="1.3"/><circle cx="100" cy="198" r="1.4" fill="#fff"/></g>}
    {(a.outfit === 'dress' || a.outfit === 'gothic') && <path d="M87 176L100 189 113 176" fill="none" stroke="#fff" strokeWidth="2"/>}
    {a.outfit === 'streetwear' && <path d="M75 174L91 201 108 201 125 174" fill="none" stroke={a.outfitAccent} strokeWidth="2"/>}
  </g>;
}

export function AnimeFaceFinish({ style, expression }: Omit<DetailsProps, 'id'>) {
  return <g pointerEvents="none">
    {style !== 'classic' && <g fill="#fff" opacity=".23"><ellipse cx="70" cy="113" rx="5" ry="11" transform="rotate(-18 70 113)"/><ellipse cx="128" cy="111" rx="4.5" ry="11" transform="rotate(18 128 111)"/></g>}
    {(expression === 'embarrassed' || expression === 'happy') && <g stroke="#d76f87" strokeWidth="1.4" opacity=".6"><path d="M63 125l6 -3M67 129l7 -4M126 123l7 4M128 128l7 4"/></g>}
    {style === 'chibi' && <g fill="#ffe5e2" opacity=".5"><ellipse cx="67" cy="127" rx="12" ry="5"/><ellipse cx="132" cy="127" rx="12" ry="5"/></g>}
  </g>;
}
