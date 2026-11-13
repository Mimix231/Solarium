import type { AnimeAccessory, AnimeAppearance, Expression } from '../domain/types';
import type { CharacterArtStyle } from '../avatar/layer-system';

interface DetailsProps { appearance: AnimeAppearance; style: CharacterArtStyle; expression: Expression; id: string }

const eyeShapes: Record<AnimeAppearance['eyeShape'], { width: number; rise: number; depth: number; tilt: number }> = {
  gentle: { width: 15, rise: 12, depth: 9, tilt: -4 },
  fox: { width: 16, rise: 8, depth: 6, tilt: 13 },
  doll: { width: 14, rise: 17, depth: 12, tilt: 0 },
  hooded: { width: 15, rise: 6, depth: 8, tilt: 2 },
  downturned: { width: 15, rise: 10, depth: 8, tilt: -13 },
  round: { width: 15, rise: 15, depth: 11, tilt: 0 },
  sharp: { width: 17, rise: 8, depth: 5, tilt: 17 },
  sleepy: { width: 15, rise: 5, depth: 6, tilt: -5 },
  almond: { width: 17, rise: 11, depth: 8, tilt: 5 },
  droopy: { width: 14, rise: 8, depth: 10, tilt: -8 },
  wide: { width: 17, rise: 15, depth: 12, tilt: 2 },
  narrow: { width: 16, rise: 6, depth: 5, tilt: 8 },
  upturned: { width: 16, rise: 11, depth: 9, tilt: 11 },
};

/** Custom hand-built vector details; the renderer can independently transform this eye layer. */
export function DetailedAnimeEyes({ appearance: a, style, expression, id }: DetailsProps) {
  const closed = expression === 'happy' || expression === 'embarrassed';
  const scale = (a.eyeScale / 100) * (style === 'chibi' ? 1.1 : 1);
  const { width, rise, depth, tilt } = eyeShapes[a.eyeShape];
  const color = [a.leftEyeColor || a.eyeColor, a.rightEyeColor || a.eyeColor];
  return <g className={a.animateEyes === false ? undefined : 'anime-blink'}>
    {([77, 123] as const).map((x, index) => {
      const angle = index === 0 ? tilt : -tilt;
      const lid = `M${-width} 0 Q0 ${-rise} ${width} 0`;
      const outline = `${lid} Q0 ${depth} ${-width} 0 Z`;
      return <g key={x} transform={`translate(${x} 107) rotate(${angle}) scale(${scale})`}>
      {closed ? <path d={`M${-width} 1 Q0 -13 ${width} 1`} fill="none" stroke={a.hairColor} strokeWidth={style === 'classic' ? 3 : 2.5} strokeLinecap="round" /> : <>
        <defs><clipPath id={`${id}-eye-${index}`}><path d={outline} /></clipPath>
          <radialGradient id={`${id}-iris-${index}`} cx="40%" cy="30%" r="77%"><stop offset="0" stopColor="#ffffff" stopOpacity=".65"/><stop offset=".23" stopColor={color[index]}/><stop offset=".68" stopColor={color[index]}/><stop offset="1" stopColor={a.hairColor}/></radialGradient>
        </defs>
        <path d={outline} fill="#fffdfb" stroke={a.hairColor} strokeWidth={style === 'classic' ? 2.7 : 1.65}/>
        <g clipPath={`url(#${id}-eye-${index})`}>
          <g transform={`translate(0 ${(depth - rise) / 8})`}>
            <ellipse cx="0" cy="1" rx={rise >= 12 ? 8.3 : 7.2} ry={10.8} fill={style === 'classic' ? color[index] : `url(#${id}-iris-${index})`} stroke={a.hairColor} strokeWidth="1.2"/>
            <ellipse cx="0" cy="4.5" rx="5.6" ry="5.4" fill={a.hairColor} opacity=".22" />
            {(a.irisPattern === 'sunburst' || a.irisPattern === 'constellation') && Array.from({ length: 14 }, (_, i) => <path key={i} d="M0 -5.7 V-9.3" transform={`rotate(${i*360/14})`} stroke="#fdf5ff" strokeWidth=".7" opacity=".78"/>)}
            {(a.irisPattern === 'ringed' || a.irisPattern === 'nebula') && <ellipse rx="5.4" ry="8.1" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity=".67" />}
            {a.irisPattern === 'spiral' && <path d="M-3 1Q-7 -6 0 -7Q8 -6 6 2Q3 8 -3 5" fill="none" stroke="#fff" strokeWidth="1" opacity=".65"/>}
            {a.irisPattern === 'flower' && Array.from({ length: 7 }, (_, i) => <ellipse key={i} cy="-4" rx="2" ry="3.3" fill="#fff" opacity=".46" transform={`rotate(${i*360/7})`} />)}
            {a.irisPattern === 'diamond' && <path d="M0 -7L6 0 0 7 -6 0Z" fill="none" stroke="#fff" strokeWidth="1" opacity=".85"/>}
            {(a.irisPattern === 'sparkle' || a.irisPattern === 'constellation') && <path d="M-7 -3L-3 -3 M-5 -5L-5 -1 M4 3L8 3 M6 1L6 5" stroke="#fff" strokeWidth="1.1" opacity=".8"/>}
            {a.pupil === 'star' ? <path d="M0 -5L1.6 -1.7 5 0 1.6 1.7 0 5 -1.6 1.7 -5 0 -1.6 -1.7Z" fill="#1e1934"/> : a.pupil === 'slit' || a.pupil === 'cat' ? <ellipse cy=".5" rx="1.7" ry="6.2" fill="#15142b"/> : a.pupil === 'heart' ? <path d="M0 5Q-8 -1 -4 -4Q-1 -6 0 -3Q3 -6 5 -3Q8 0 0 5Z" fill="#251934"/> : a.pupil === 'diamond' ? <path d="M0 -6L3 0 0 6 -3 0Z" fill="#251934"/> : <ellipse rx="3.5" ry="5" fill="#1d1b35"/>}
            <ellipse cx="-3" cy="-4" rx="3.1" ry="4.0" fill="#fff" opacity={a.sparkle / 100}/>
            <circle cx="3.4" cy="2.4" r="1.4" fill="#fff" opacity=".91"/>
            <circle cx="-4.8" cy="2.7" r=".85" fill="#fff" opacity={a.sparkle / 125}/>
          </g>
        </g>
        <path d={lid} fill="none" stroke={a.hairColor} strokeWidth={tilt >= 11 ? 3.5 : 2.65} strokeLinecap="round" />
        <path d={`M${index === 0 ? 1 - width : width - 1} -1 l${index === 0 ? -3 : 3} -3`} stroke={a.hairColor} strokeWidth="1.9" strokeLinecap="round"/>
        <path d={`M-10 ${depth * .45 + 2} Q0 ${depth * .65 + 3} 10 ${depth * .45 + 2}`} stroke={a.hairColor} opacity=".22" strokeWidth=".9" fill="none" />
      </>}
    </g>;
    })}
  </g>;
}

export const bustPaths: Record<AnimeAppearance['bodyShape'], string> = {
  standard: 'M19 214Q21 171 51 163L78 151H121L149 163Q179 172 184 214Z',
  petite: 'M33 214Q34 175 61 166L83 153H117L139 166Q166 175 167 214Z',
  soft: 'M17 214C20 180 36 164 65 161L84 152H116L135 161C164 164 180 180 183 214Z',
  tailored: 'M15 214L30 174Q34 167 45 166L79 151H121L155 166Q166 167 170 174L185 214Z',
};

export function blendPortraitColor(base: string, tint: string, weight: number) {
  const channel = (offset: number) => Math.round(
    parseInt(base.slice(offset, offset + 2), 16) * (1 - weight) + parseInt(tint.slice(offset, offset + 2), 16) * weight,
  ).toString(16).padStart(2, '0');
  return '#' + channel(1) + channel(3) + channel(5);
}

export function AnimeEars({ shape, skin, shade }: { shape: AnimeAppearance['ears']; skin: string; shade: string }) {
  if (shape === 'hidden') return null;
  const shell = shape === 'pointed' ? 'M64 102Q56 99 47 94Q49 116 62 125Z' : 'M63 103C48 98 50 118 61 125L66 120Z';
  return <g data-avatar-detail="ears" fill={skin} stroke={shade} strokeWidth="1.35">
    {[false, true].map(mirror => <g key={String(mirror)} transform={mirror ? 'translate(200 0) scale(-1 1)' : undefined}>
      <path d={shell} />
      <path d="M55 109Q59 107 61 116" fill="none" strokeLinecap="round" />
    </g>)}
  </g>;
}

export function AnimeNose({ shape, shade }: { shape: AnimeAppearance['nose']; shade: string }) {
  const path = { classic: 'M100 117L98 122 101 124', button: 'M97 122Q100 126 103 122',
    minimal: 'M99 122h2', defined: 'M100 114Q99 119 97 122Q100 125 104 122' }[shape];
  return <g data-avatar-detail="nose" fill="none" strokeLinecap="round">
    {shape !== 'minimal' && <path d="M101 117l1 2" stroke="white" strokeWidth="1.8" opacity=".4" />}
    <path d={path} stroke={shade} strokeWidth={shape === 'button' ? 1.65 : 1.4}/>
  </g>;
}

function Glint({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return <path d="M0-7Q1-1 7 0Q1 1 0 7Q-1 1-7 0Q-1-1 0-7Z" fill={color} transform={`translate(${x} ${y}) scale(${size / 7})`} />;
}

export function AnimeBackdrop({ design, accent }: { design: AnimeAppearance['backdrop']; accent: string }) {
  if (design === 'glow') return null;
  return <g data-avatar-backdrop={design} pointerEvents="none">
    {design === 'orbit' && <>
      <g fill="none" stroke={accent} opacity=".5"><circle cx="100" cy="96" r="74"/><circle cx="100" cy="96" r="67" strokeDasharray="1 5" strokeLinecap="round"/></g>
      <Glint x={37} y={42} size={7} color="#fff4d9"/><Glint x={169} y={105} size={5} color="#fff4d9"/>
      <circle cx="157" cy="34" r="4" fill={accent}/><circle cx="31" cy="146" r="2.5" fill="#fff4d9"/>
    </>}
    {design === 'petals' && <g fill={accent}>
      <path d="M21 45Q14 33 24 29Q31 31 29 44Z M168 48Q170 35 181 34Q187 43 173 51Z M27 130Q21 117 11 124Q10 134 27 130Z M179 156Q168 142 163 150Q163 159 179 156Z" opacity=".7"/>
      <path d="M39 77Q24 68 26 63Q39 58 44 69Z M158 81Q169 69 177 75Q175 85 158 81Z M174 119Q181 109 189 112Q192 122 174 119Z" opacity=".38"/>
    </g>}
    {design === 'studio' && <g fill="none" stroke={accent} opacity=".38">
      <rect x="20" y="20" width="160" height="160" rx="23"/>
      <path d="M32 52V37q0-5 5-5h15 M148 32h15q5 0 5 5v15 M32 148v15q0 5 5 5h15 M148 168h15q5 0 5-5v-15" strokeWidth="1.8"/>
    </g>}
  </g>;
}

export function AnimeOrnament({ kind, accent, dark }: { kind: AnimeAccessory; accent: string; dark: string }) {
  switch (kind) {
    case 'moon-pin': return <g transform="translate(136 68) rotate(12)">
      <path d="M-10 2H9M-10 6H7" stroke={dark} strokeWidth="2" strokeLinecap="round"/>
      <path d="M-7-8C-16-3-12 9-3 10C3 10 7 6 8 1C3 6-8 1-7-8Z" fill={accent} stroke="#fff5e2" strokeWidth="1.25"/>
      <Glint x={4} y={-6} size={5} color="#fff5e2"/>
    </g>;
    case 'pearl-drops': return <g fill={accent} stroke={dark} strokeWidth="1">
      {[58, 142].map(x => <g key={x} transform={`translate(${x} 124)`}>
        <circle r="2.6"/><path d="M0 3v6" fill="none"/>
        <ellipse cy="12" rx="3.9" ry="5.3"/><circle cx="-1" cy="10" r="1.4" fill="white" stroke="none" opacity=".85"/>
      </g>)}
    </g>;
    case 'bunny-ears': return <g fill={dark} stroke={accent} strokeWidth="1.6">
      <path d="M66 39C52 32 48 9 57 5C68 2 77 23 79 35Z M125 36C127 19 139 4 149 7C160 12 149 32 138 41Z"/>
      <path d="M67 33C57 24 54 11 59 11C65 11 71 25 72 32Z M132 32C135 20 144 11 149 13C152 16 144 28 138 34Z" fill={accent}/>
      <path d="M72 40Q102 23 134 42" fill="none" strokeWidth="3"/>
    </g>;
    case 'heart-glasses': return <g fill={accent} fillOpacity=".14" stroke={accent} strokeWidth="2.5" strokeLinejoin="round">
      {[77, 123].map(x => <g key={x} transform={`translate(${x} 107)`}>
        <path d="M0-7C-6-16-19-11-17-2C-16 5-6 11 0 16C6 11 16 5 17-2C19-11 6-16 0-7Z"/>
        <path d="M-13-2Q-14-7-9-8" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity=".75"/>
      </g>)}
      <path d="M94 104Q100 100 106 104 M59 104l-5-2 M141 104l5-2" fill="none" />
    </g>;
    case 'pocket-bird': return <g transform="translate(144 172)">
      <path d="M-19 20Q-17 8-6 5Q-9-6 1-10Q10-13 16-4Q20 4 14 11Q12 18 17 21Z" fill={accent} stroke={dark} strokeWidth="1.5"/>
      <path d="M-13 15q8-10 15-5q-1 7-10 8Z" fill="white" fillOpacity=".5"/>
      <path d="M16-2l7 3-7 4Z" fill="#ffc88d" stroke={dark} strokeWidth=".85"/>
      <circle cx="10" cy="-3" r="1.7" fill={dark}/><circle cx="10.5" cy="-3.6" r=".55" fill="white"/>
      <ellipse cx="8" cy="2" rx="2.6" ry="1.4" fill="#f490ab"/>
    </g>;
    default: return null;
  }
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
