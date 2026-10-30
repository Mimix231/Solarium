import { memo, useId, type ReactNode } from 'react';
import type { AnimeAppearance, Expression, SparkAvatar } from '../domain/types';
import { defaultAnime } from '../domain/defaults';
import { migrateAvatarAppearance, resolveLayer, type AvatarLayerId } from '../avatar/layer-system';
import { AnimeFaceFinish, AnimeHairFinish, AnimeOutfitFinish, DetailedAnimeEyes } from './AvatarDetails';

interface Props { avatar: SparkAvatar; size?: number; active?: boolean; className?: string }
/** Original, fully editable vector-anime bust. Rendered locally: no remote images or LLM required. */
export const AnimeAvatar = memo(function AnimeAvatar({ avatar, size = 100, active, className = '' }: Props) {
  const expr: Expression = avatar.expression;
  const base = migrateAvatarAppearance({ ...defaultAnime, ...avatar.anime });
  const overridden = base.expressionPresets?.[expr] ?? {};
  const a: AnimeAppearance = { ...base, ...overridden };
  const artStyle = a.artStyle ?? 'modern';
  const chibiHead = artStyle === 'chibi' ? 'translate(100 113) scale(1.2 1.16) translate(-100 -113)' : '';
  const layer = (id: AvatarLayerId, children: ReactNode): ReactNode => {
    const config = resolveLayer(a, id);
    return config.visible ? <g data-avatar-layer={id} transform={`translate(${100 + config.offsetX} ${100 + config.offsetY}) scale(${config.scale / 100}) translate(-100 -100) ${id !== 'body' ? chibiHead : ''}`}>{children}</g> : null;
  };
  const localId = useId().replaceAll(':', '');
  const faceExpression: Expression = overridden.mouth || overridden.eyeShape ? 'neutral' : expr;
  const isHappy = faceExpression === 'happy' || faceExpression === 'embarrassed';
  const isFocused = faceExpression === 'focused';
  const rx = artStyle === 'chibi' ? 44 : a.face === 'round' ? 41 : a.face === 'sharp' ? 37 : 39;
  const faceBottom = artStyle === 'chibi' ? 160 : a.face === 'sharp' ? 153 : a.face === 'round' ? 149 : 152;
  const hairPath = a.hairstyle === 'shag' ? 'M44 105L33 86 48 72 40 53 61 48Q75 23 104 24Q149 24 153 66L165 83 150 103 161 138 146 132 151 189 128 188 132 78 68 79 68 190 43 185 50 140Z'
    : a.hairstyle === 'short-curls' ? 'M49 98Q26 92 41 67Q35 46 56 41Q61 20 83 30Q99 16 119 27Q146 22 150 43Q171 53 156 77Q169 92 149 106L137 129 128 84 71 84 63 124Z'
    : a.hairstyle === 'soft-bob' ? 'M48 100Q33 52 70 31Q109 18 140 36Q157 58 150 104L154 147Q132 166 122 144L130 83 70 83 78 145Q57 163 47 141Z'
    : a.hairstyle === 'long-waves' ? 'M47 107Q31 55 69 27Q106 9 140 32Q162 60 151 99Q163 119 147 140Q163 161 146 181Q160 194 146 205L122 205 132 81 68 83 66 205 42 205Q31 190 47 173Q30 152 48 130Z'
    : a.hairstyle === 'wolf-cut' ? 'M46 100L35 92 49 77 39 62 60 56Q56 25 95 23Q148 15 155 66L164 84 151 102 159 153 142 144 139 194 120 193 128 81 69 80 63 195 45 195 54 142Z' : a.hairstyle === 'curly' ? 'M46 108Q23 93 41 75Q29 53 53 44Q54 20 79 28Q95 9 115 24Q141 18 146 44Q165 53 156 76Q171 97 150 113L155 186 136 182 131 82 69 82 62 191 43 189Z' : a.hairstyle === 'layered' ? 'M48 99Q36 53 67 30Q99 12 135 32Q157 52 150 98L161 130 148 136 160 171 147 182 156 202 130 201 130 84 68 83 67 201 42 200 49 175 38 149 50 130Z' : a.hairstyle === 'pixie'
    ? 'M57 102Q45 69 66 40Q83 17 117 28Q151 32 149 87L137 100 130 71 72 71Z'
    : a.hairstyle === 'bob'
      ? 'M49 100Q36 59 68 32Q91 17 120 28Q154 39 150 100L151 145Q138 159 123 146L130 86 70 86 75 145Q57 157 47 139Z'
      : a.hairstyle === 'hime'
        ? 'M51 105Q36 54 67 28Q109 6 141 42Q158 64 150 115L156 195 133 195 131 79 69 79 66 195 42 195Z'
        : a.hairstyle === 'messy'
          ? 'M41 103L28 82 46 79 40 55 64 59 60 29 83 39 94 18 111 35 134 24 130 52 159 46 151 68 171 83 150 96 142 132 128 123 126 75 70 77 70 132 56 124Z'
          : 'M48 102Q30 47 69 28Q106 9 139 36Q164 64 147 112L157 204 134 204 132 86 69 86 62 204 40 204Z';
  const clipId = `${localId}-clip`;
  const gradientId = `${localId}-gradient`;
  const hairId = `${localId}-hair`;
  const skinId = `${localId}-skin`;
  const fabricId = `${localId}-fabric`;
  return <svg className={`spark-avatar anime-avatar ${active && avatar.animate ? 'avatar-active' : ''} ${className}`} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Editable anime Spark portrait">
    <defs>
      <clipPath id={clipId}><rect width="200" height="200" rx="25" /></clipPath>
      <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor={a.background}/><stop offset="1" stopColor={avatar.secondary}/></linearGradient>
      <linearGradient id={skinId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff3e7"/><stop offset=".32" stopColor={a.skin}/><stop offset=".85" stopColor={a.skin}/><stop offset="1" stopColor="#c18b83"/></linearGradient>
      <linearGradient id={fabricId} x1="0" y1="0" x2="1" y2="1"><stop stopColor={a.outfitAccent}/><stop offset=".18" stopColor={a.outfitColor}/><stop offset=".8" stopColor={a.outfitColor}/><stop offset="1" stopColor={a.outfitAccent}/></linearGradient>
      <linearGradient id={hairId} x1="0" x2=".85" y1="0" y2="1"><stop stopColor={a.hairAccent}/><stop offset=".45" stopColor={a.hairColor}/><stop offset="1" stopColor={a.hairColor}/></linearGradient>
    </defs>
    <g clipPath={`url(#${clipId})`}>
      <rect width="200" height="200" fill={`url(#${gradientId})`}/>
      <circle cx="168" cy="30" r="64" fill={avatar.color} opacity=".19"/>
      <circle cx="18" cy="188" r="63" fill={a.outfitAccent} opacity=".10"/>
      <g transform={`translate(${a.offsetX} ${a.offsetY}) translate(100 100) scale(${a.zoom / 100}) translate(-100 -100)`}>
        {layer('backHair', <g transform={`translate(100 0) scale(${a.hairVolume / 100} 1) translate(-100 0)`}>
        {/* Rear hair and independent ponytail/twin-tail layers */}
        <path d={hairPath} fill={artStyle === 'classic' ? a.hairColor : `url(#${hairId})`} stroke={a.hairColor} strokeWidth="2" strokeLinejoin="round" />
        {a.hairstyle === 'twin-tails' && <g fill={`url(#${hairId})`} stroke={a.hairColor} strokeWidth="2">
          <path d="M53 67Q18 55 27 112Q34 140 20 196L47 196Q70 123 62 76Z" />
          <path d="M148 67Q182 55 174 112Q168 145 185 196L156 196Q131 125 140 76Z" />
        </g>}
        {(a.hairstyle === 'ponytail' || a.hairstyle === 'side-ponytail' || a.hairstyle === 'high-ponytail') && <path d="M140 53Q183 43 168 95Q160 133 172 183Q140 148 147 93Z" fill={a.hairColor} stroke={a.hairAccent} strokeWidth="2"/>}
        {(a.hairstyle === 'low-twintails') && <g fill={`url(#${hairId})`} stroke={a.hairColor} strokeWidth="1.5"><path d="M53 89Q24 91 30 146L22 201 54 201 62 90Z"/><path d="M147 89Q176 91 171 146L179 201 146 201 138 90Z"/></g>}
        {(a.hairstyle === 'side-braid') && <g fill={a.hairColor} stroke={a.hairAccent} strokeWidth="1.3">{[95,106,117,128,139,150,161,172,183].map((y, i) => <ellipse key={i} cx={151 + (i%2?3:-3)} cy={y} rx="9" ry="7"/>)}</g>}
        {a.hairstyle === 'braided-crown' && <g fill={a.hairAccent} stroke={a.hairColor} strokeWidth='1.5'>{[54,65,76,87,98,109,120,131,142].map((x,i)=><ellipse key={x} cx={x} cy={40-Math.sin((i/8)*Math.PI)*17} rx={8} ry={5}/>)}</g>}
        {a.hairstyle === 'ahoge' && <path d='M98 36Q90 3 109 8Q118 13 104 28' fill='none' stroke={a.hairColor} strokeWidth='7' strokeLinecap='round' />}
        </g>)}
        {layer('body', <>
        {/* Outfit layers and collar */}
        <g transform={`translate(100 0) scale(${a.shoulderWidth / 100} 1) translate(-100 0)`}>
        <path d="M19 214Q21 171 51 163L78 151 121 151 149 163Q179 172 184 214Z" fill={artStyle === 'classic' ? a.outfitColor : `url(#${fabricId})`} stroke={a.outfitAccent} strokeWidth="2" />
        {a.outfit === 'hoodie' && <><path d="M60 164Q94 188 140 164L157 208 42 208Z" fill={a.outfitColor}/><path d="M72 161L65 189 82 196 M127 160L134 189 118 196" stroke={a.outfitAccent} strokeWidth="3" fill="none" strokeLinecap="round"/><path d="M66 193Q100 187 135 193" stroke={a.outfitAccent} fill="none" opacity=".65" /></>}
        {a.outfit === 'uniform' && <><path d="M68 159L99 194 131 159 138 178 99 209 59 178Z" fill={a.outfitAccent}/><path d="M75 161L100 188 125 161 116 174 100 193 84 173Z" fill="#ffffff" opacity=".82"/><path d="M99 190L91 214 107 214Z" fill={avatar.color}/></>}
        {a.outfit === 'dress' && <><path d="M62 162Q99 186 137 162L145 213H55Z" fill={a.outfitAccent} opacity=".45"/><path d="M85 163Q100 180 114 163" fill="none" stroke="#fff" strokeWidth="3"/><circle cx="100" cy="190" r="5" fill={avatar.color}/></>}
        {a.outfit === 'kimono' && <><path d='M56 162L99 207 139 160 155 208 40 208Z' fill={a.outfitAccent} opacity='.7'/><path d='M67 159L117 207M130 160L83 207' stroke={a.outfitColor} strokeWidth='5'/></>}
        {a.outfit === 'turtleneck' && <path d='M79 145L121 145 124 175 76 175Z' fill={a.outfitAccent} stroke={a.outfitColor} strokeWidth='2'/>}
        {a.outfit === 'armor' && <><path d='M36 179L60 166 97 186 140 166 163 180 163 208 36 208Z' fill={a.outfitAccent} opacity='.82'/><path d='M64 169L100 200 136 169' fill='none' stroke='white' strokeWidth='3'/></>}
        {a.outfit === 'cardigan' && <><path d='M72 161L96 210 53 211 54 168Z M128 161L104 210 146 211 146 168Z' fill={a.outfitAccent}/><path d='M100 182L100 210' stroke='#fff' strokeWidth='2'/></>}
        {(a.outfit === 'blazer' || a.outfit === 'sailor' || a.outfit === 'cape' || a.outfit === 'gothic' || a.outfit === 'streetwear') && <><path d="M62 163L98 190 137 163 148 209 51 209Z" fill={a.outfitAccent} opacity=".37"/>{a.outfit === 'sailor' && <path d="M65 164L99 193 136 164" stroke="#fff" strokeWidth="4" fill="none"/>}{a.outfit === 'cape' && <path d="M56 162L24 200 54 218 100 178 146 218 176 200 144 162" fill={a.outfitColor} stroke={a.outfitAccent} strokeWidth="2"/>}{a.outfit === 'blazer' && <path d="M73 159L99 187 126 159 117 183 100 202 82 183Z" fill="#fff" opacity=".8"/>}{a.outfit === 'gothic' && <path d="M77 168L99 198 124 169M81 179L119 179" fill="none" stroke="#fff" strokeWidth="1.8"/>}</>}
        {a.outfit === 'jacket' && <><path d="M65 164L98 186 84 207 59 178Z M136 164L102 186 119 207 145 178Z" fill={a.outfitAccent}/><path d="M101 183L101 212" stroke="white" strokeWidth="2"/></>}
        </g>
        <AnimeOutfitFinish appearance={a} style={artStyle}/></>)}
        {layer('skin', <>
        {/* Neck and face */}
        <path d="M86 136L84 163Q100 179 116 163L114 136Z" fill={artStyle === 'classic' ? a.skin : `url(#${skinId})`} stroke="#9e6868" strokeWidth="1.4" />
        </>)}
        {layer('face', <path d={`M${100-rx} 82 Q${100-rx-3} 119 81 140 Q99 ${faceBottom+4} 119 140 Q${100+rx+3} 117 ${100+rx} 82 Q137 48 100 50 Q63 48 ${100-rx} 82Z`} fill={artStyle === 'classic' ? a.skin : `url(#${skinId})`} stroke="#bc8992" strokeWidth={artStyle === 'classic' ? 2.3 : 1.45} />)}
        {layer('eyebrows', <>
        <path d={a.brows === 'arched' || faceExpression === 'angry' ? 'M70 94Q79 82 89 94 M111 94Q123 82 133 94' : a.brows === 'straight' ? 'M70 94L89 94 M111 94L133 94' : 'M70 96Q77 86 88 94 M111 94Q124 86 133 97'} fill="none" stroke={a.hairColor} strokeWidth={isFocused || faceExpression === 'angry' ? 3.8 : 2.5} strokeLinecap="round"/>
        </>)}
        {layer('eyes', <DetailedAnimeEyes appearance={a} expression={faceExpression} style={artStyle} id={localId}/>)}
        {layer('expression', <>
        {/* cheeks, nose and expression */}
        <g opacity={a.blush / 125} fill="#ef749a"><ellipse cx="67" cy="124" rx="13" ry="5"/><ellipse cx="132" cy="124" rx="13" ry="5"/></g>
        {a.makeup === 'freckles' && <g fill='#a96d64' opacity='.65'>{[64,70,76,124,130,136].map((x,i) => <circle key={i} cx={x} cy={120 + i%2 * 3} r='1.4'/>)}</g>}
        {a.makeup === 'beauty-mark' && <circle cx='127' cy='132' r='2' fill='#5c3c46'/>}
        {a.makeup === 'star-cheeks' && <g fill={a.hairAccent}><path d='M63 123l2 4 4 1-4 2-2 4-2-4-4-2 4-1Z'/><path d='M137 123l2 4 4 1-4 2-2 4-2-4-4-2 4-1Z'/></g>}
        {a.makeup === 'eyeliner' && <path d='M63 102L58 98M138 102L143 98' stroke={a.hairColor} strokeWidth='3' strokeLinecap='round'/>}
        <path d="M100 117L98 122 101 124" fill="none" stroke="#bc8992" strokeWidth="1.4"/>
        <path d={isHappy ? 'M88 134Q100 149 113 134Q100 141 88 134Z' : faceExpression === 'curious' ? 'M95 137Q100 141 106 137' : faceExpression === 'sad' ? 'M92 141Q100 133 108 141' : faceExpression === 'surprised' ? 'M96 136Q100 132 104 136Q104 148 100 148Q96 148 96 136Z' : faceExpression === 'angry' ? 'M91 137L109 138' : isFocused ? 'M94 138L105 138' : a.mouth === 'laugh' ? 'M88 133Q100 154 114 133Z' : a.mouth === 'grin' ? 'M88 134Q100 146 114 134L109 139 93 139Z' : a.mouth === 'fang' ? 'M90 136Q101 145 111 136L108 141 105 136 100 141Z' : a.mouth === 'pout' ? 'M95 140Q100 134 105 140' : a.mouth === 'open' ? 'M95 134Q100 129 105 134Q105 147 100 147Q95 147 95 134Z' : a.mouth === 'cat-smile' ? 'M89 134L97 140 101 135 105 140 112 134' : a.mouth === 'frown' ? 'M91 143Q100 135 110 143' : a.mouth === 'soft-smile' ? 'M91 136Q100 142 109 136' : a.mouth === 'smile' ? 'M91 134Q100 148 110 134' : a.mouth === 'smirk' ? 'M92 138Q104 142 111 134' : a.mouth === 'neutral' ? 'M94 137L106 137' : 'M92 136Q100 140 108 136'} fill={isHappy || faceExpression === 'surprised' ? '#b95776' : 'none'} stroke="#a75f78" strokeWidth="2" strokeLinecap="round"/>
        <AnimeFaceFinish appearance={a} style={artStyle} expression={faceExpression}/></>)}
        {layer('frontHair', <g transform={`translate(100 0) scale(${a.hairVolume / 100} 1) translate(-100 0)`}>
        {/* Foreground anime bangs; distinct selectable cut paths */}
        <g fill={`url(#${hairId})`} stroke={a.hairColor} strokeWidth="1.8" strokeLinejoin="round">
          {a.bangs === 'curtain' && <><path d="M57 94Q45 45 91 41Q86 68 68 92L72 73Z"/><path d="M88 41Q146 37 144 90L127 75Q121 91 109 94Q110 64 88 41Z"/></>}
          {a.bangs === 'straight' && <path d="M57 93Q53 50 97 37Q144 47 143 94L133 86 122 96 113 85 101 97 90 86 79 97 69 85Z" />}
          {a.bangs === 'swept' && <path d="M53 100Q48 52 98 35Q143 35 145 80Q108 88 81 91Q105 77 117 59Q88 77 53 100Z" />}
          {a.bangs === 'wispy' && <><path d="M60 90Q58 50 101 36L93 89 83 61 76 96Z"/><path d="M96 37Q136 45 140 93L125 75 113 94Z"/></>}
          {a.bangs === 'hime-cut' && <><path d="M57 91L66 52Q97 23 140 66L141 96 126 86 112 90 95 87 78 91Z"/><path d="M56 93L69 93 69 145 55 149Z M133 93L144 93 145 149 132 145Z"/></>}
          {a.bangs === 'side-part' && <path d="M52 101Q46 55 95 32Q139 37 145 87L138 92Q131 73 109 56Q95 85 52 101Z"/>}
          {a.bangs === 'micro' && <path d="M59 84Q55 47 96 36Q144 41 142 84L132 79 121 83 111 77 100 84 87 78 72 86Z"/>}
          {a.hairstyle === 'hime' && <><path d="M56 93L68 88 68 148 51 154Z"/><path d="M133 88L146 94 148 155 133 148Z"/></>}
        </g>
        {a.sideHair === 'wispy' && <g stroke={a.hairAccent} fill="none" strokeWidth="4" strokeLinecap="round"><path d="M58 97Q50 125 59 155"/><path d="M142 96Q151 122 142 157"/></g>}
        {(a.sideHair === 'ringlets' || a.sideHair === 'long-locks' || a.sideHair === 'short-locks') && <g fill="none" stroke={a.hairColor} strokeWidth="6" strokeLinecap="round"><path d={a.sideHair === 'ringlets' ? 'M58 100Q40 120 57 138Q69 146 54 161M141 99Q159 119 143 138Q131 145 146 160' : a.sideHair === 'long-locks' ? 'M59 98Q55 142 61 191M140 98Q142 143 138 190' : 'M60 95Q53 117 60 134M140 95Q148 117 140 134'}/></g>}
        {a.sideHair === 'braids' && <g fill={a.hairColor} stroke={a.hairAccent} strokeWidth="1.5">
          {[111,122,133,144,155].map((y) => <g key={y}><ellipse cx="55" cy={y} rx="6" ry="8"/><ellipse cx="147" cy={y} rx="6" ry="8"/></g>)}
        </g>}
        <path d="M71 57Q101 35 129 53" fill="none" stroke={a.hairAccent} strokeWidth="2.2" opacity=".55" strokeLinecap="round" />
        <AnimeHairFinish appearance={a} style={artStyle}/>
        </g>)}
        {layer('accessories', <>
        {/* Interchangeable anime accessories */}
        {(a.accessory === 'ribbon' || a.accessorySecondary === 'ribbon') && <g transform="translate(135 56)"><path d="M0 0L-17 -10Q-23 5 -17 11Z M0 0L17 -10Q22 5 17 11Z" fill={a.outfitAccent} stroke={a.outfitColor} strokeWidth="1.3"/><circle r="4" fill={avatar.color}/></g>}
        {(a.accessory === 'glasses' || a.accessorySecondary === 'glasses') && <g stroke={a.outfitAccent} fill="none" strokeWidth="2"><rect x="61" y="99" width="35" height="22" rx="8"/><rect x="106" y="99" width="35" height="22" rx="8"/><path d="M96 104Q101 100 106 104"/></g>}
        {(a.accessory === 'earrings' || a.accessorySecondary === 'earrings') && <g fill={a.outfitAccent}><circle cx="58" cy="125" r="3"/><circle cx="142" cy="125" r="3"/><path d="M58 128l-4 11 4 4 4-4Z M142 128l-4 11 4 4 4-4Z"/></g>}
        {(a.accessory === 'cat-ears' || a.accessorySecondary === 'cat-ears') && <g fill={a.hairColor} stroke={a.hairAccent} strokeWidth="2"><path d="M64 48L55 11 90 37Z"/><path d="M111 37L148 11 139 52Z"/></g>}
        {(a.accessory === 'face-mask' || a.accessorySecondary === 'face-mask') && <g><path d='M72 117Q100 128 128 117L124 145Q100 156 77 145Z' fill='#e5eff4' stroke='#92a0b0' strokeWidth='2'/><path d='M72 122L58 117M128 122L143 117' fill='none' stroke='#a9b7cc' strokeWidth='2'/><path d='M82 130L118 130M84 136L116 136' stroke='#c8d6dd' strokeWidth='1'/></g>}
        {(a.accessory === 'beret' || a.accessorySecondary === 'beret') && <g><ellipse cx='100' cy='37' rx='56' ry='20' fill={a.outfitAccent} stroke={a.outfitColor} strokeWidth='2'/><path d='M60 36Q57 2 113 9Q151 14 143 37Z' fill={a.outfitColor}/><circle cx='106' cy='9' r='4' fill={a.outfitAccent}/></g>}
        {(a.accessory === 'witch-hat' || a.accessorySecondary === 'witch-hat') && <g><path d='M45 41L107 -18 134 39Z' fill={a.outfitColor} stroke={a.outfitAccent} strokeWidth='3'/><ellipse cx='100' cy='41' rx='71' ry='10' fill={a.outfitColor} stroke={a.outfitAccent} strokeWidth='2'/><path d='M82 30L128 30' stroke={a.outfitAccent} strokeWidth='6'/></g>}
        {(a.accessory === 'cap' || a.accessorySecondary === 'cap') && <g><path d='M53 61Q52 20 101 22Q148 20 148 60Z' fill={a.outfitColor} stroke={a.outfitAccent} strokeWidth='3'/><path d='M85 59Q139 52 167 66Q142 77 86 66Z' fill={a.outfitAccent}/></g>}
        {(a.accessory === 'headphones' || a.accessorySecondary === 'headphones') && <g fill={a.outfitColor} stroke={a.outfitAccent} strokeWidth='3'><path d='M50 114Q41 16 100 22Q163 22 151 114' fill='none'/><rect x='43' y='96' width='17' height='34' rx='7'/><rect x='141' y='96' width='17' height='34' rx='7'/></g>}
        {(a.accessory === 'eyepatch' || a.accessorySecondary === 'eyepatch') && <g><path d='M61 108Q79 93 97 107Q93 124 77 125Q62 120 61 108Z' fill={a.outfitColor} stroke={a.outfitAccent} strokeWidth='2'/><path d='M60 100L141 90' stroke={a.outfitAccent} strokeWidth='2'/></g>}
        {(a.accessory === 'choker' || a.accessorySecondary === 'choker') && <g><path d='M85 153Q99 157 116 153L118 162Q99 167 83 162Z' fill={a.outfitColor}/><circle cx='100' cy='160' r='4' fill={a.outfitAccent}/></g>}
        {(a.accessory === 'flower-crown' || a.accessorySecondary === 'flower-crown') && <g>{[59,72,85,99,113,127,140].map((x,i) => <g key={x} transform={`translate(${x},${43-Math.sin((i/6)*Math.PI)*19})`}><circle r='6' fill={a.outfitAccent}/><circle r='3' fill={avatar.color}/></g>)}</g>}
        {(a.accessory === 'halo' || a.accessorySecondary === 'halo') && <ellipse cx="101" cy="18" rx="33" ry="8" fill="none" stroke={a.outfitAccent} strokeWidth="5" />}
        {(a.accessory === 'hairclip' || a.accessorySecondary === 'hairclip') && <g transform="translate(143 71)"><path d="M-11 -4L11 4M-10 3L10 -3" fill="none" stroke={a.outfitAccent} strokeWidth="4" strokeLinecap="round"/></g>}
        {(a.accessory === 'tiara' || a.accessorySecondary === 'tiara') && <path d="M65 45L73 27 87 40 100 20 114 40 129 27 136 45Z" fill={a.outfitAccent} stroke="#fff" strokeWidth="1.3"/>}
        {(a.accessory === 'nose-bandage' || a.accessorySecondary === 'nose-bandage') && <g transform="rotate(-18 100 122)"><rect x="92" y="119" width="18" height="6" rx="2" fill="#efd6c0" stroke="#cfb39a" strokeWidth=".6"/><path d="M98 120v4M101 120v4M104 120v4" stroke="#b6a28f" strokeWidth=".6"/></g>}
        {(a.accessory === 'visor' || a.accessorySecondary === 'visor') && <path d="M58 101Q101 92 143 101L135 118Q101 127 65 118Z" fill="#7dd3dd" fillOpacity=".43" stroke={a.outfitAccent} strokeWidth="2"/>}
        </>)}
        {layer('lighting', <><path d="M53 58Q75 22 101 28" fill="none" stroke="#fff" strokeWidth="2.4" opacity={artStyle === 'classic' ? .18 : .44} strokeLinecap="round"/><ellipse cx="157" cy="39" rx="3" ry="8" transform="rotate(45 157 39)" fill="#fff" opacity=".28"/></>)}
      </g>
    </g>
  </svg>;
});
