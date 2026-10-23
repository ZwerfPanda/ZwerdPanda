import { INK } from '../../../components/art/shapes';
import { CocoFigure } from '../../../components/art/SampleArt';
import { Backdrop, Floor, Mini, Moment, Moon, RisingHearts, S, Say, Sign, Stars } from './kit';
import {
  CanalHouse,
  ChickenBucket,
  Drumstick,
  Hotdog,
  Lights,
  Plush,
  Popcorn,
  ShopBag,
} from './props';

/* The Teleport: our own little room for a day. Niet storen. */
export function HotelScene() {
  return (
    <g>
      <Backdrop id="sc-hotel" from="#1b1236" to="#3b1f5c" />
      <g className="scene-neon">
        <text
          x="-120"
          y="-318"
          textAnchor="middle"
          fontFamily="var(--font-body)"
          fontSize="30"
          fontWeight="800"
          letterSpacing="4"
          fill="#8fe3ff"
          stroke="#e6faff"
          strokeWidth="0.8"
        >
          TELEPORT
        </text>
      </g>
      {[-200, -40].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="-250" rx="30" ry="40" fill="#b48cff" opacity="0.18" />
          <rect
            x={x - 6}
            y="-262"
            width="12"
            height="22"
            rx="4"
            fill="#d9c6ff"
            stroke={INK}
            strokeWidth="1.6"
          />
        </g>
      ))}
      {/* our door */}
      <rect x="110" y="-310" width="110" height="310" rx="6" fill="#4a2f73" {...S} />
      <rect
        x="122"
        y="-296"
        width="86"
        height="130"
        rx="4"
        fill="#5a3a88"
        stroke={INK}
        strokeWidth="1.6"
      />
      <circle cx="132" cy="-150" r="5" fill="#e8bd6a" stroke={INK} strokeWidth="1.6" />
      <rect
        x="126"
        y="-140"
        width="10"
        height="16"
        rx="2"
        fill="#2a1d40"
        stroke={INK}
        strokeWidth="1.4"
      />
      <circle cx="131" cy="-135" r="2" fill="#7dff9a" className="scene-flicker" />
      <text
        x="165"
        y="-318"
        textAnchor="middle"
        fontFamily="var(--font-body)"
        fontSize="14"
        fontWeight="800"
        fill="#ffd6e7"
      >
        ♡ 7
      </text>
      <g className="scene-swing" style={{ transformOrigin: '165px -232px' }}>
        <path d="M165-232l-14 18M165-232l14 18" stroke="#ffd6e7" strokeWidth="2" />
        <rect
          x="135"
          y="-214"
          width="60"
          height="78"
          rx="10"
          fill="#ff8fb8"
          {...S}
          strokeWidth={2}
        />
        <circle cx="165" cy="-200" r="7" fill="#3b1f5c" />
        <text
          x="165"
          y="-172"
          textAnchor="middle"
          fontFamily="var(--font-hand)"
          fontSize="15"
          fontWeight="700"
          fill={INK}
        >
          niet
        </text>
        <text
          x="165"
          y="-155"
          textAnchor="middle"
          fontFamily="var(--font-hand)"
          fontSize="15"
          fontWeight="700"
          fill={INK}
        >
          storen ♡
        </text>
      </g>
      <Floor color="#5c2d5e" line="#1b1236" />
      <path d="M-240 6H240" stroke="#ff8fb8" strokeWidth="2" strokeDasharray="4 10" />
      {/* she pulls him along by the hand */}
      <Mini
        who="you"
        x={34}
        face="grin"
        tilt={-6}
        hands={{ left: { x: -50, y: -150 }, right: { x: 46, y: -150 } }}
      />
      <path d="M78-152l14-4 2 8-14 4z" fill="#e8bd6a" stroke={INK} strokeWidth="1.4" />
      <Mini
        who="partner"
        x={-66}
        face="wink"
        tilt={-8}
        lean={-4}
        hands={{ right: { x: 50, y: -148 } }}
      />
      <RisingHearts x={-14} y={-260} color="#ff8fb8" />
      <Say x={-130} y={-212} text="kom 😏" tx={-80} ty={-180} w={80} />
    </g>
  );
}

/* Walibi Holland: the biggest plushie in the park, the ferris wheel, the coasters. */
export function ThemeparkScene() {
  return (
    <g>
      <Backdrop id="sc-park" from="#7fc3f0" to="#d9f0fb" />
      {/* the fierce sun */}
      <g className="scene-spin-slow" style={{ transformOrigin: '-190px -320px' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d="M-190-320l0-46"
            transform={`rotate(${i * 30} -190 -320)`}
            stroke="#ffd75e"
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}
      </g>
      <circle cx="-190" cy="-320" r="28" fill="#ffd75e" {...S} strokeWidth={2} />
      {/* the ferris wheel */}
      <path d="M150-40L150-196M150-196L104-40M150-196L196-40" stroke="#6b5b8f" strokeWidth="5" />
      <g className="scene-spin" style={{ transformOrigin: '150px -196px' }}>
        <circle cx="150" cy="-196" r="104" fill="none" stroke="#6b5b8f" strokeWidth="5" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          const x = 150 + Math.cos(a) * 104;
          const y = -196 + Math.sin(a) * 104;
          return (
            <g key={i}>
              <path d={`M150 -196L${x} ${y}`} stroke="#9a8ac2" strokeWidth="2" />
              <g transform={`translate(${x} ${y})`}>
                <g className="scene-spin-back">
                  <path
                    d="M-11 0h22v14a4 4 0 0 1-4 4h-14a4 4 0 0 1-4-4z"
                    fill={['#e05a7d', '#ffd75e', '#5b9bd5', '#9cd67a'][i % 4]}
                    {...S}
                    strokeWidth={1.6}
                  />
                  {i === 2 && <path d="M0 6q-3-3-6 0t6 6q9-3 6-6t-6 0z" fill="#fff" />}
                </g>
              </g>
            </g>
          );
        })}
      </g>
      {/* a coaster */}
      <path d="M-240-150Q-200-330-150-150T-60-210" fill="none" stroke="#c2416a" strokeWidth="6" />
      <path
        d="M-220-60V-205M-190-60V-260M-160-60V-168M-120-60V-190M-80-60V-206"
        stroke="#e8a3b5"
        strokeWidth="3"
      />
      <g className="scene-coaster">
        <rect
          x="-14"
          y="-12"
          width="28"
          height="14"
          rx="4"
          fill="#ffd75e"
          {...S}
          strokeWidth={1.6}
        />
      </g>
      {/* basketball, where he won it */}
      <path d="M-210-20V-150" stroke="#5b6268" strokeWidth="4" />
      <rect x="-226" y="-176" width="40" height="28" fill="#fff" {...S} strokeWidth={2} />
      <path d="M-216-150h20" stroke="#e9772b" strokeWidth="3" />
      <Floor color="#e8d6b8" />
      <Mini who="you" x={124} face="grin" tilt={-6} hands={{ left: { x: -80, y: -170 } }} />
      <Plush x={-2} y={-6} s={1.45} />
      <Mini who="partner" x={-134} face="happy" tilt={8} hands={{ right: { x: 70, y: -150 } }} />
      <Say x={60} y={-352} text="de grootste van het park!!" tx={-110} ty={-266} w={210} />
    </g>
  );
}

/* Walibi Belgium: the drive home at night, everyone asleep, me at the wheel. */
function Sleeper({
  x,
  y,
  r,
  hair = '#1b1413',
}: {
  x: number;
  y: number;
  r: number;
  hair?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-12)`}>
      <circle r={r} fill="#8d5b3c" {...S} strokeWidth={1.8} />
      <path
        d={`M${-r} ${-r * 0.1}Q${-r} ${-r * 1.15} 0 ${-r * 1.08}Q${r} ${-r * 1.15} ${r} ${-r * 0.1}Q${r * 0.3} ${-r * 0.7} ${-r} ${-r * 0.1}Z`}
        fill={hair}
      />
      <path
        d={`M${-r * 0.5} 0q${r * 0.2} ${r * 0.18} ${r * 0.36} 0M${r * 0.14} 0q${r * 0.2} ${r * 0.18} ${r * 0.36} 0`}
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  );
}

export function RoadtripScene() {
  return (
    <g>
      <Backdrop id="sc-road" from="#101a38" to="#3a2f5e" />
      <Stars n={20} seed={7} />
      <Moon x={-170} y={-310} r={18} />
      {/* the park, far behind us */}
      <g fill="none" stroke="#ffd27a" strokeWidth="3" opacity="0.75" strokeLinecap="round">
        <path d="M40-150Q90-150 118-196" />
        <circle cx="160" cy="-214" r="44" strokeDasharray="5 5" />
        <path d="M202-196Q230-150 240-150" />
      </g>
      <g fill="#ffd27a">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <circle
            key={i}
            cx={160 + Math.cos((i * Math.PI) / 4) * 44}
            cy={-214 + Math.sin((i * Math.PI) / 4) * 44}
            r="2.6"
            className="scene-bulb"
            style={{ animationDelay: `${(i % 3) * 0.4}s` }}
          />
        ))}
      </g>
      {/* the motorway */}
      <rect x="-240" y="-60" width="480" height="80" fill="#2c2c36" />
      <g className="scene-road">
        {[-240, -160, -80, 0, 80, 160, 240, 320].map((x) => (
          <rect key={x} x={x} y="-24" width="44" height="6" rx="3" fill="#ffd27a" />
        ))}
      </g>
      <path d="M-240-60H240" stroke="#5b6268" strokeWidth="3" />
      <g>
        <path d="M-200-60V-180" stroke="#5b6268" strokeWidth="5" />
        <Sign x={-200} y={-196} w={120} h={34} text="Nederland →" bg="#1f5fae" size={14} />
      </g>
      {/* our car */}
      <g transform="translate(0 -6) scale(1.32)">
        <g className="scene-bob">
          <path
            d="M-150-40Q-150-70-120-74L-80-120H70L120-76Q160-72 160-40Z"
            fill="#e05a7d"
            {...S}
          />
          <path d="M-72-112H-6V-78H-108Z" fill="#9ec4e6" {...S} strokeWidth={2} />
          <path d="M2-112H62L104-78H2Z" fill="#9ec4e6" {...S} strokeWidth={2} />
          {/* back seat: everyone asleep */}
          <Sleeper x={-70} y={-88} r={11} />
          <Sleeper x={-46} y={-90} r={13} hair="#2b1d1a" />
          <Mini who="partner" x={-22} y={-14} s={0.36} pieces={['head']} face="calm" tilt={-14} />
          {/* front: me, wide awake, driving us home safe */}
          <Mini who="you" x={54} y={-2} s={0.36} pieces={['head']} face="smile" />
          <circle cx="150" cy="-56" r="7" fill="#fff4b8" />
          <path d="M157-56L240-76V-36Z" fill="#fff4b8" opacity="0.22" />
          {[-96, 106].map((x) => (
            <g key={x} transform={`translate(${x} -40)`}>
              <g className="scene-wheel">
                <circle r="22" fill="#2a2a33" {...S} />
                <circle r="9" fill="#aab0bc" />
                <path d="M-9 0H9M0-9V9" stroke="#2a2a33" strokeWidth="2.4" />
              </g>
            </g>
          ))}
        </g>
      </g>
      <g className="scene-zzz" fontFamily="var(--font-hand)" fontWeight="700" fill="#cbd5ff">
        <text x="-80" y="-140" fontSize="22">
          z
        </text>
        <text x="-62" y="-160" fontSize="28">
          z
        </text>
        <text x="-40" y="-184" fontSize="34">
          Z
        </text>
      </g>
      <Say x={120} y={-226} text="ik breng jullie veilig thuis ♡" tx={70} ty={-150} w={210} />
    </g>
  );
}

/* Pathé: the films were good, but I mostly watched her. */
export function CinemaScene() {
  return (
    <g>
      <Backdrop id="sc-cinema" from="#1a0c12" to="#3a121c" />
      {/* the screen, flickering */}
      <rect
        x="-200"
        y="-370"
        width="400"
        height="140"
        rx="6"
        fill="#9ec4e6"
        className="scene-screen"
      />
      <path
        d="M-200-230L-240-150M200-230L240-150"
        stroke="#000"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      {/* curtains */}
      <path d="M-240-380H-196Q-206-290-196-200H-240Z" fill="#9b1d2c" {...S} strokeWidth={2} />
      <path d="M240-380H196Q206-290 196-200H240Z" fill="#9b1d2c" {...S} strokeWidth={2} />
      {/* us, in our seats */}
      <Mini who="partner" x={-60} y={52} face="smile" tilt={-10} />
      <Mini who="you" x={62} y={62} face="happy" tilt={-16} lean={-4} />
      <RisingHearts x={20} y={-262} color="#ff8fb8" />
      {/* the row in front */}
      {[-180, -60, 60, 180].map((x) => (
        <path
          key={x}
          d={`M${x - 56} 20V-70Q${x - 56} -96 ${x - 30} -96H${x + 30}Q${x + 56} -96 ${x + 56} -70V20Z`}
          fill="#b3243a"
          {...S}
        />
      ))}
      <Popcorn x={2} y={-92} s={1.15} />
      <Say x={120} y={-200} text="👀 …naar jou" tx={80} ty={-232} w={130} />
    </g>
  );
}

/* KFC: we love chicken. Simple. */
export function ChickenScene() {
  return (
    <g>
      <rect x="-240" y="-380" width="480" height="400" fill="#fffdf8" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={-240 + i * 40} y="-380" width="20" height="300" fill="#d9363e" />
      ))}
      <rect x="-240" y="-80" width="480" height="20" fill="#2d1517" />
      <Floor color="#e8d6c2" y={-60} />
      <Mini who="partner" x={-62} face="grin" tilt={6} hands={{ right: { x: 56, y: -232 } }} />
      <Mini who="you" x={70} face="grin" tilt={-6} hands={{ left: { x: -60, y: -262 } }} />
      <Drumstick x={-6} y={-236} s={1.1} r={-20} />
      <Drumstick x={10} y={-266} s={1.1} r={24} />
      <path className="scene-sparkle" d="M2-300l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#ffd75e" />
      <ChickenBucket x={-170} y={-60} s={1.2} />
      <ChickenBucket x={176} y={-60} s={0.9} />
      <Say x={-110} y={-330} text="we houden van kip!" tx={-60} ty={-262} w={170} />
    </g>
  );
}

/* IKEA: dates, and hot dogs with heeeeel veel saus. */
export function IkeaScene() {
  return (
    <g>
      <rect x="-240" y="-380" width="480" height="400" fill="#0058a3" />
      <rect x="-240" y="-300" width="480" height="40" fill="#ffda1a" />
      <Sign x={-110} y={-332} w={150} h={46} text="IKEA" bg="#ffda1a" fg="#0058a3" size={30} />
      {/* flat-pack boxes */}
      {[
        [-226, -150, 70, 90],
        [-176, -110, 60, 50],
        [168, -170, 64, 110],
        [130, -100, 50, 40],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill="#d8b98a" {...S} strokeWidth={2} />
          <path d={`M${x} ${y + h / 2}H${x + w}`} stroke="#b89566" strokeWidth="2" />
        </g>
      ))}
      <Floor color="#9aa3ad" y={-60} />
      <ShopBag x={-190} y={-56} s={1.4} color="#ffda1a" />
      <Mini who="partner" x={-62} face="grin" tilt={4} hands={{ right: { x: 26, y: -152 } }} />
      <Hotdog x={-30} y={-152} s={1} r={-8} />
      <Mini who="you" x={70} face="happy" tilt={-4} hands={{ left: { x: -30, y: -190 } }} />
      <Hotdog x={36} y={-190} s={1} r={10} />
      <Say x={80} y={-330} text="méér saus!!" tx={70} ty={-280} w={120} />
    </g>
  );
}

/* Amsterdam: canals, red lights, a tea house, my family, and Coco. */
export function AmsterdamScene() {
  return (
    <g>
      <Backdrop id="sc-ams" from="#2b2350" to="#7a4f7f" />
      <Stars n={10} seed={9} />
      {[
        [-250, 140, '#a8574a', 'step'],
        [-198, 170, '#d49a5c', 'bell'],
        [-148, 130, '#6d7f97', 'point'],
        [-96, 160, '#9a6a8f', 'step'],
        [-44, 140, '#c8655c', 'bell'],
        [8, 175, '#7f9a6a', 'step'],
        [60, 135, '#a8574a', 'point'],
        [112, 165, '#d49a5c', 'bell'],
        [164, 140, '#6d7f97', 'step'],
        [216, 160, '#9a6a8f', 'bell'],
      ].map(([x, h, color, gable]) => (
        <CanalHouse
          key={x as number}
          x={x as number}
          y={-110}
          w={52}
          h={h as number}
          color={color as string}
          gable={gable as 'step'}
        />
      ))}
      <Lights
        x1={-240}
        y1={-250}
        x2={240}
        y2={-250}
        sag={40}
        colors={['#ff3b5c', '#ff6b7f', '#ff3b5c']}
      />
      <Sign x={-150} y={-136} w={96} h={24} text="theehuisje" bg="#5f7d52" size={12} />
      {/* the canal */}
      <rect x="-240" y="-110" width="480" height="70" fill="#2f5d86" />
      <path
        d="M-220-80q20-8 40 0t40 0M40-70q20-8 40 0t40 0"
        fill="none"
        stroke="#8fc3ec"
        strokeWidth="2"
      />
      {/* the bridge we stand on */}
      <path d="M-240-40Q0-130 240-40V20H-240Z" fill="#b08968" {...S} />
      <path d="M-120 20Q0-60 120 20Z" fill="#1d3550" />
      <path d="M-240-56Q0-146 240-56" fill="none" stroke={INK} strokeWidth="3" />
      {[-200, -150, -100, 100, 150, 200].map((x) => (
        <path
          key={x}
          d={`M${x} ${-46 - (1 - (x / 240) ** 2) * 66}v-16`}
          stroke={INK}
          strokeWidth="2.6"
        />
      ))}
      {/* a bike, and Coco */}
      <g transform="translate(176 -88)" fill="none" stroke={INK} strokeWidth="2.6">
        <circle cx="-18" cy="0" r="12" />
        <circle cx="18" cy="0" r="12" />
        <path d="M-18 0L-4-18H12L18 0M-4-18L0 0H12M10-24h6" />
      </g>
      <CocoFigure x={-172} y={-96} scale={0.32} blink />
      <Moment kind="heart" dx={0} y={-98} s={0.86} />
      <RisingHearts x={0} y={-320} color="#ff6b7f" />
    </g>
  );
}
