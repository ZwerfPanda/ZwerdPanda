import { INK } from '../../../components/art/shapes';
import { CocoFigure } from '../../../components/art/SampleArt';
import { NS_BLUE, NS_YELLOW } from '../TrainRide';
import { Backdrop, Floor, Mini, Moment, Moon, RisingHearts, S, Say, Sign, Stars } from './kit';
import {
  BubbleTea,
  Burger,
  Candle,
  CanalHouse,
  Flamingo,
  PastaPlate,
  RingBox,
  ShopBag,
  Tree,
} from './props';

/* My house in Amsterdam: off to her, early in the morning, thinking of her. */
export function HomeScene() {
  return (
    <g>
      <Backdrop id="sc-home" from="#f6dcc4" to="#efc9a8" />
      {/* the window: sunrise over the canal houses */}
      <defs>
        <linearGradient id="sc-home-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb98c" />
          <stop offset="1" stopColor="#ffe6b8" />
        </linearGradient>
        <clipPath id="sc-home-win">
          <rect x="-214" y="-318" width="150" height="150" rx="10" />
        </clipPath>
      </defs>
      <rect x="-214" y="-318" width="150" height="150" rx="10" fill="url(#sc-home-sky)" />
      <g clipPath="url(#sc-home-win)">
        <circle cx="-110" cy="-210" r="22" fill="#fff3c7" />
        <CanalHouse x={-224} y={-168} w={40} h={70} color="#a8574a" gable="step" />
        <CanalHouse x={-184} y={-168} w={36} h={84} color="#d49a5c" gable="bell" />
        <CanalHouse x={-148} y={-168} w={40} h={62} color="#6d7f97" gable="point" />
        <CanalHouse x={-108} y={-168} w={44} h={78} color="#9a6a8f" gable="step" />
      </g>
      <rect x="-214" y="-318" width="150" height="150" rx="10" fill="none" {...S} strokeWidth={4} />
      <path d="M-139-318V-168M-214-243H-64" stroke={INK} strokeWidth="3" />
      {/* a wall clock: early */}
      <circle cx="44" cy="-350" r="16" fill="#fffdf8" {...S} />
      <path d="M44-350V-362M44-350L53-345" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      {/* the door, out to Den Haag */}
      <rect x="150" y="-300" width="80" height="300" rx="6" fill="#7a4b3a" {...S} />
      <rect
        x="162"
        y="-286"
        width="56"
        height="120"
        rx="4"
        fill="#8d5a46"
        stroke={INK}
        strokeWidth="1.6"
      />
      <circle cx="216" cy="-150" r="5" fill="#e8bd6a" stroke={INK} strokeWidth="1.6" />
      <Floor color="#c98f5e" />
      {[-200, -120, -40, 40, 120, 200].map((x) => (
        <path key={x} d={`M${x} -8V20`} stroke="#a8734a" strokeWidth="2" />
      ))}
      {/* Coco sees him off */}
      <CocoFigure x={-20} y={-36} scale={0.42} blink />
      <Mini who="you" x={92} pose="wave" face="grin" />
      {/* thinking of her */}
      <circle cx="16" cy="-238" r="5" fill="#fffdf8" {...S} strokeWidth={2} />
      <circle cx="-2" cy="-262" r="8" fill="#fffdf8" {...S} strokeWidth={2} />
      <circle cx="-48" cy="-300" r="44" fill="#fffdf8" {...S} strokeWidth={2} />
      <Mini who="partner" x={-48} y={-166} s={0.62} pieces={['head']} face="happy" />
      <path d="M-22-326q-4-4-8 0t8 8q12-4 8-8t-8 0z" fill="#e6627f" />
    </g>
  );
}

/* Den Haag Centraal, 4 May, 20:00: everyone silent… except us. */
function Bystander({ x, s = 1, look = 0 }: { x: number; s?: number; look?: number }) {
  return (
    <g transform={`translate(${x} 0) scale(${s})`}>
      <path
        d="M-24 0V-120Q-24-150 0-150Q24-150 24-120V0Z"
        fill="#9aa3b5"
        stroke={INK}
        strokeWidth="2"
      />
      <circle cx="0" cy="-172" r="20" fill="#b9c0cc" stroke={INK} strokeWidth="2" />
      <circle cx={look * 7 - 4} cy="-172" r="2.4" fill={INK} />
      <circle cx={look * 7 + 5} cy="-172" r="2.4" fill={INK} />
      <path d={`M${look * 6 - 4} -163h8`} stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

export function StationScene() {
  return (
    <g>
      <Backdrop id="sc-station" from="#cfe0ee" to="#eef4f8" />
      {/* the glass roof */}
      <path d="M-240-260Q0-400 240-260" fill="none" stroke="#8aa0b4" strokeWidth="6" />
      {[-180, -120, -60, 0, 60, 120, 180].map((x) => (
        <path
          key={x}
          d={`M${x} ${-262 - (1 - (x / 240) ** 2) * 70}V-150`}
          stroke="#b7c6d3"
          strokeWidth="3"
        />
      ))}
      {/* the departure board */}
      <rect x="-112" y="-374" width="224" height="58" rx="6" fill={NS_BLUE} {...S} />
      {[
        ['20:00', 'twee minuten stilte'],
        ['20:02', 'Utrecht Centraal'],
      ].map(([t, to], i) => (
        <g
          key={t}
          fontFamily="var(--font-body)"
          fontWeight="700"
          fontSize="13"
          fill={i === 0 ? '#fff' : NS_YELLOW}
        >
          <text x="-98" y={-350 + i * 22}>
            {t}
          </text>
          <text x="-48" y={-350 + i * 22}>
            {to}
          </text>
        </g>
      ))}
      {/* the clock, at eight */}
      <circle cx="176" cy="-296" r="26" fill="#fff" {...S} />
      <path d="M176-296V-316M176-296L159-286" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <text
        x="176"
        y="-256"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill={INK}
        fontFamily="var(--font-body)"
      >
        4 mei
      </text>
      <Floor color="#c5c9cf" />
      <path d="M-240 6H240" stroke="#fff" strokeWidth="2" strokeDasharray="14 10" />
      {/* everyone stands still, and looks at us */}
      <Bystander x={-206} s={0.92} look={1} />
      <Bystander x={-152} s={0.82} look={1} />
      <Bystander x={162} s={0.85} look={-1} />
      <Bystander x={214} s={0.95} look={-1} />
      <Mini who="partner" x={-46} pose="talk" face="talk" tilt={4} />
      <Mini who="you" x={58} pose="talk" face="grin" tilt={-3} />
      <Say x={-130} y={-322} text="…en toen zei ze—" tx={-60} ty={-250} w={150} />
      <Say x={196} y={-206} text="Ssst! 👀" tx={210} ty={-170} w={90} />
      <path d="M-4-268q-3-3-6 0t6 6q9-3 6-6t-6 0z" fill="#e6627f" />
    </g>
  );
}

/* Den Haag Moerwijk: her home station, late at night, a hug goodbye. */
export function PlatformScene() {
  return (
    <g>
      <Backdrop id="sc-platform" from="#0f1c3d" to="#3a3768" />
      <Stars n={22} seed={3} />
      <Moon x={170} y={-320} r={20} />
      {/* a sprinter waiting at the platform */}
      <g>
        <rect x="-250" y="-210" width="420" height="120" rx="18" fill={NS_YELLOW} {...S} />
        <rect x="-250" y="-108" width="420" height="18" fill={NS_BLUE} />
        {[-220, -140, -60, 20, 100].map((x) => (
          <rect
            key={x}
            x={x}
            y="-196"
            width="56"
            height="44"
            rx="8"
            fill="#ffe9a8"
            stroke={INK}
            strokeWidth="2"
          />
        ))}
        <rect
          x="128"
          y="-196"
          width="34"
          height="86"
          rx="4"
          fill="#ffe9a8"
          stroke={INK}
          strokeWidth="2"
        />
      </g>
      {/* the station sign */}
      <path d="M-196-90V-260" stroke="#5b6268" strokeWidth="6" />
      <Sign x={-150} y={-268} w={150} h={34} text="Den Haag Moerwijk" bg={NS_BLUE} size={13} />
      {/* a lamp */}
      <path d="M206-6V-250" stroke="#4a4f55" strokeWidth="6" />
      <circle cx="206" cy="-254" r="34" fill="#ffd27a" opacity="0.22" />
      <path d="M192-254h28l-6-12h-16z" fill="#ffd27a" stroke={INK} strokeWidth="2" />
      <Floor color="#7d7a86" line="#2d2a33" y={-60} />
      <path d="M-240-56H240" stroke={NS_YELLOW} strokeWidth="5" strokeDasharray="22 10" />
      <Moment kind="hug" dx={6} />
    </g>
  );
}

/* SiSi: jasmine bubble tea with tapioca, like always. */
export function BubbleTeaScene() {
  return (
    <g>
      <Backdrop id="sc-boba" from="#ffe1ec" to="#d9f3e8" />
      {/* the shop */}
      <rect x="-210" y="-330" width="420" height="190" rx="18" fill="#fff6fa" {...S} />
      <Sign
        x={0}
        y={-310}
        w={140}
        h={42}
        text="SiSi"
        bg="#f49ab0"
        size={24}
        font="var(--font-display)"
      />
      <g fontFamily="var(--font-hand)" fontSize="18" fill={INK}>
        <text x="-186" y="-250">
          jasmine tea ♡
        </text>
        <text x="-186" y="-222">
          + tapioca
        </text>
        <text x="80" y="-250">
          taro
        </text>
        <text x="80" y="-222">
          brown sugar
        </text>
      </g>
      <path d="M-210-180H210" stroke={INK} strokeWidth="2" />
      {[-150, -110, 110, 150].map((x, i) => (
        <BubbleTea
          key={x}
          x={x}
          y={-150}
          s={0.6}
          tea={['#e9d79a', '#c9b1de', '#d9a46b', '#e9d79a'][i]}
        />
      ))}
      <Floor color="#f3cfdc" />
      <Mini who="partner" x={-62} face="happy" tilt={6} hands={{ right: { x: 18, y: -150 } }} />
      <BubbleTea x={-42} y={-142} s={0.95} />
      <Mini who="you" x={70} face="grin" tilt={-4} hands={{ left: { x: -20, y: -182 } }} />
      <BubbleTea x={50} y={-174} s={0.95} tea="#c9b1de" />
      <Say x={-120} y={-340} text="jasmine + tapioca, zoals altijd ♡" tx={-70} ty={-262} w={230} />
    </g>
  );
}

/* Westfield: our first date, and our first kiss by the matcha shop. */
export function MallScene() {
  return (
    <g>
      <Backdrop id="sc-mall" from="#f7efe4" to="#efe3d2" />
      {/* skylight and upper floor */}
      <path d="M-240-330H240" stroke="#d6c7b2" strokeWidth="8" />
      <path d="M-240-300H240" stroke={INK} strokeWidth="2" />
      {[-200, -150, -100, -50, 0, 50, 100, 150, 200].map((x) => (
        <path key={x} d={`M${x} -300V-276`} stroke="#b9a891" strokeWidth="2" />
      ))}
      <path d="M-240-276H240" stroke={INK} strokeWidth="2" />
      {/* the matcha shop */}
      <rect x="-236" y="-250" width="200" height="250" fill="#e3edd6" {...S} />
      <path d="M-236-250h200l-10 30h-180z" fill="#6f9160" {...S} strokeWidth={2} />
      {[-226, -196, -166, -136, -106, -76].map((x) => (
        <path key={x} d={`M${x} -220q15 14 30 0`} fill="#fffdf8" stroke={INK} strokeWidth="1.6" />
      ))}
      <Sign x={-136} y={-272} w={110} h={26} text="MATCHA" bg="#4c6a40" size={13} />
      <rect
        x="-216"
        y="-190"
        width="80"
        height="110"
        rx="6"
        fill="#f6fbef"
        stroke={INK}
        strokeWidth="2"
      />
      <g transform="translate(-176 -110)">
        <path d="M-14-30H14L10 10H-10Z" fill="#a8c97f" {...S} strokeWidth={2} />
        <path d="M-16-36H16V-28H-16Z" fill="#fffdf8" {...S} strokeWidth={2} />
      </g>
      {/* a jewellery window */}
      <rect x="40" y="-250" width="196" height="250" fill="#f2e7f2" {...S} />
      <Sign x={138} y={-272} w={110} h={26} text="♡ jewels" bg="#c2416a" size={13} />
      <rect
        x="60"
        y="-200"
        width="156"
        height="100"
        rx="8"
        fill="#fffaff"
        stroke={INK}
        strokeWidth="2"
      />
      <RingBox x={100} y={-118} s={1.1} />
      <RingBox x={176} y={-118} s={0.9} />
      <Floor color="#e2d4c1" />
      <path d="M-240 4H240" stroke="#cfbfa8" strokeWidth="2" />
      <ShopBag x={-112} y={0} s={1.2} />
      <ShopBag x={-80} y={2} s={0.95} color="#cbbfe9" />
      <rect x="106" y="-30" width="58" height="30" rx="3" fill="#fffdf8" {...S} strokeWidth={2} />
      <path d="M106-20h58" stroke={INK} strokeWidth="1.6" />
      <Moment kind="kiss" dx={-10} />

      <Sign
        x={-14}
        y={-358}
        w={170}
        h={26}
        text="onze eerste kus ♡"
        bg="#fffdf8"
        fg={INK}
        size={16}
        font="var(--font-hand)"
        weight={600}
        rx={13}
      />
    </g>
  );
}

/* The Vogeltuin: flamingos, and shopping for Coco. */
export function BirdsScene() {
  return (
    <g>
      <Backdrop id="sc-birds" from="#bfe3f2" to="#e8f6ee" />
      {/* the aviary */}
      <path d="M-240-150Q0-430 240-150" fill="none" stroke="#7d8c86" strokeWidth="4" />
      {[-160, -80, 0, 80, 160].map((x) => (
        <path
          key={x}
          d={`M${x} ${-150 - (1 - (x / 240) ** 2) * 140}V-150`}
          stroke="#9aa8a2"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
      ))}
      <Tree x={-200} y={-30} s={1.2} />
      <Tree x={210} y={-40} s={0.9} color="#7fb877" />
      <Floor color="#9cc98b" />
      <ellipse cx="140" cy="-6" rx="110" ry="18" fill="#8fd0e8" {...S} strokeWidth={2} />
      <Flamingo x={100} y={-8} s={1} />
      <Flamingo x={160} y={-12} s={0.9} flip />
      <Flamingo x={204} y={-6} s={0.8} />
      <Mini who="partner" x={-60} face="grin" tilt={8} hands={{ right: { x: 76, y: -196 } }} />
      <Mini who="you" x={-150} face="smile" hands={{ left: { x: -26, y: -116 } }} />
      <ShopBag x={-176} y={-96} s={1.3} color="#ffd9a8" />
      <path d="M-180-132l6-18 4 2-4 16z" fill="#f08a36" stroke={INK} strokeWidth="1.4" />
      <path
        d="M-176-150q2-6 6-6"
        fill="none"
        stroke="#5f7d52"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Say x={40} y={-322} text="flamingo’s!! 🦩" tx={-20} ty={-262} w={150} />
    </g>
  );
}

/* Juicy Burgers & Pasta: creamy pasta pesto for her, always. */
export function PastaScene() {
  return (
    <g>
      <Backdrop id="sc-pasta" from="#5a2a2e" to="#7a3b35" />
      {/* brick wall */}
      {Array.from({ length: 7 }, (_, row) => (
        <path key={row} d={`M-240 ${-340 + row * 40}H240`} stroke="#4a2024" strokeWidth="2" />
      ))}
      <g className="scene-neon">
        <text
          x="0"
          y="-300"
          textAnchor="middle"
          fontFamily="var(--font-hand)"
          fontSize="46"
          fontWeight="700"
          fill="#ff8fb8"
          stroke="#ffd6e6"
          strokeWidth="1"
        >
          Juicy ♡
        </text>
      </g>
      {[-120, 120].map((x) => (
        <g key={x}>
          <path d={`M${x} -380V-262`} stroke="#2d1517" strokeWidth="2" />
          <path
            d={`M${x - 22} -240Q${x} -272 ${x + 22} -240Z`}
            fill="#e8bd6a"
            {...S}
            strokeWidth={2}
          />
          <ellipse cx={x} cy="-236" rx="30" ry="10" fill="#ffd27a" opacity="0.3" />
        </g>
      ))}
      {/* we sit at our table */}
      <Mini
        who="partner"
        x={-66}
        y={64}
        face="happy"
        tilt={6}
        hands={{ right: { x: 26, y: -150 } }}
      />
      <Mini who="you" x={72} y={74} face="grin" tilt={-6} hands={{ left: { x: -30, y: -160 } }} />
      <path d="M-200-80H200L210-64H-210Z" fill="#fffdf8" {...S} />
      <path d="M-206-66H206V20H-206Z" fill="#e9dcc8" {...S} />
      <path d="M-206-40H206" stroke="#d9363e" strokeWidth="3" strokeDasharray="10 8" />
      <PastaPlate x={-62} y={-84} s={1.1} />
      <Burger x={74} y={-84} s={1.1} />
      <Candle x={6} y={-80} />
      <RisingHearts x={0} y={-236} color="#ff8fb8" />
      <Say x={-132} y={-212} text="creamy pasta pesto, duh ♡" tx={-90} ty={-180} w={200} />
    </g>
  );
}
