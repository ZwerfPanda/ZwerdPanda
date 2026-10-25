import { motion } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useMotion';
import { flowerOfDay } from './flowers';
import { FlowerHead } from './FlowerArt';

const INK = '#5b2a3a';

/** Zinc buckets of tulips on the pavement. */
function Bucket({ x, kind, n = 5 }: { x: number; kind: string; n?: number }) {
  return (
    <g transform={`translate(${x} 262)`}>
      {Array.from({ length: n }, (_, i) => {
        const dx = (i - (n - 1) / 2) * 7;
        const top = -34 - (i % 2) * 6;
        return (
          <g key={i}>
            <path d={`M${dx * 0.4} 0 L${dx} ${top}`} stroke="#5f9b5a" strokeWidth="2" />
            <g transform={`translate(${dx} ${top}) scale(0.55)`}>
              <FlowerHead kind={kind} hue={i * 9} />
            </g>
          </g>
        );
      })}
      <path d="M-15 -6h30l-3 24h-24z" fill="#b9c4cc" stroke={INK} strokeWidth="1.2" />
      <path d="M-15 -6h30" stroke="#e8eef2" strokeWidth="2" />
    </g>
  );
}

/**
 * Her flower shop from the street: a striped awning, a window full of
 * flowers, a door with a bell, buckets on the pavement and a Dutch bike with
 * a crate of flowers. The name and today's chalkboard are real text on top.
 */
export function ShopFront({
  name,
  eyebrow,
  stats,
}: {
  name: string;
  eyebrow: string;
  stats: string;
}) {
  const reduce = useReducedMotion();
  const today = flowerOfDay();
  return (
    <header className="shopfront">
      <div className="shopfront__scene">
        <svg className="shopfront__art" viewBox="0 0 400 300" aria-hidden="true">
          <defs>
            <linearGradient id="sf-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe9dc" />
              <stop offset="1" stopColor="#fff6ee" />
            </linearGradient>
            <linearGradient id="sf-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff9f2" />
              <stop offset="1" stopColor="#f6dccd" />
            </linearGradient>
          </defs>
          <rect width="400" height="300" fill="url(#sf-sky)" />
          {/* the building: a mint Dutch shop front with a gable */}
          <path d="M40 300V70l40-36h240l40 36v230z" fill="#bfe3d3" stroke={INK} strokeWidth="2" />
          <path d="M40 70h320" stroke={INK} strokeWidth="2" />
          <circle cx="200" cy="52" r="10" fill="#fff6ee" stroke={INK} strokeWidth="1.5" />
          <path d="M200 44v16M192 52h16" stroke={INK} strokeWidth="1.2" />
          {/* hanging baskets */}
          {[70, 330].map((x) => (
            <g key={x}>
              <path d={`M${x} 70v14`} stroke={INK} strokeWidth="1" />
              <path d={`M${x - 14} 84h28l-4 10h-20z`} fill="#c98b4a" stroke={INK} strokeWidth="1" />
              {[-9, 0, 9].map((dx, i) => (
                <g key={dx} transform={`translate(${x + dx} ${82 - (i % 2) * 3}) scale(0.45)`}>
                  <FlowerHead kind={i === 1 ? 'Gerbera’s' : 'Gemengd'} hue={i * 14} />
                </g>
              ))}
              <path
                d={`M${x - 12} 94q-2 10 2 14M${x + 12} 94q2 10 -2 14`}
                stroke="#5f9b5a"
                strokeWidth="1.5"
                fill="none"
              />
            </g>
          ))}
          {/* the shop window, full of flowers */}
          <rect
            x="62"
            y="132"
            width="150"
            height="104"
            rx="6"
            fill="url(#sf-glass)"
            stroke={INK}
            strokeWidth="2"
          />
          <path d="M137 132v104M62 184h150" stroke="#fff" strokeWidth="3" opacity="0.7" />
          {[
            'Rozen',
            'Tulpen',
            'Zonnebloemen',
            'Pioenrozen',
            'Lavendel',
            'Hortensia',
            'Gerbera’s',
            'Lelies',
          ].map((k, i) => (
            <g
              key={k}
              transform={`translate(${80 + (i % 4) * 38} ${i < 4 ? 168 : 220}) scale(0.7)`}
            >
              <FlowerHead kind={k} hue={i * 11} />
            </g>
          ))}
          <path d="M70 140l40 30M120 140l60 45" stroke="#fff" strokeWidth="5" opacity="0.35" />
          {/* the door, with its bell */}
          <rect
            x="236"
            y="128"
            width="78"
            height="134"
            rx="4"
            fill="#e7889f"
            stroke={INK}
            strokeWidth="2"
          />
          <rect
            x="248"
            y="140"
            width="54"
            height="60"
            rx="4"
            fill="url(#sf-glass)"
            stroke={INK}
            strokeWidth="1.5"
          />
          <circle cx="302" cy="208" r="3.5" fill="#d9a441" />
          <path d="M275 128v6" stroke={INK} strokeWidth="1" />
          <path
            className="shopfront__bell"
            d="M269 134q6 -8 12 0l1 6h-14z"
            fill="#d9a441"
            stroke={INK}
            strokeWidth="1"
          />
          {/* the step and the pavement */}
          <rect
            x="228"
            y="262"
            width="94"
            height="8"
            fill="#e4d2c2"
            stroke={INK}
            strokeWidth="1.2"
          />
          <rect y="270" width="400" height="30" fill="#e8d8c8" />
          <path d="M0 270H400" stroke={INK} strokeWidth="1.5" />
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} d={`M${i * 44} 270l-10 30`} stroke="#d6c2ae" strokeWidth="1.5" />
          ))}
          <Bucket x={70} kind="Tulpen" />
          <Bucket x={112} kind="Zonnebloemen" n={4} />
          <Bucket x={154} kind="Rozen" n={4} />
          {/* a Dutch bike with a crate of flowers */}
          <g transform="translate(340 256)">
            <circle cx="-22" cy="4" r="12" fill="none" stroke={INK} strokeWidth="2" />
            <circle cx="22" cy="4" r="12" fill="none" stroke={INK} strokeWidth="2" />
            <path
              d="M-22 4L-6 -16H14L22 4M-6 -16L0 4H14M14 -16l4 -8h6"
              stroke="#2b5aa6"
              strokeWidth="2.4"
              fill="none"
              strokeLinejoin="round"
            />
            <rect
              x="16"
              y="-34"
              width="20"
              height="12"
              fill="#c98b4a"
              stroke={INK}
              strokeWidth="1"
            />
            {[19, 26, 33].map((x, i) => (
              <g key={x} transform={`translate(${x} -36) scale(0.4)`}>
                <FlowerHead kind={i === 1 ? 'Tulpen' : 'Rozen'} hue={i * 20} />
              </g>
            ))}
            <path d="M-8 -16h-6" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
        {/* the striped awning, scalloped */}
        <div className="shopfront__awning" aria-hidden="true" />
        <div className="shopfront__sign">
          <p className="shopfront__eyebrow hand">{eyebrow}</p>
          <h1 className="shopfront__name">{name}</h1>
        </div>
        <motion.span
          className="shopfront__open"
          aria-hidden="true"
          animate={reduce ? undefined : { rotate: [-5, 5, -5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          OPEN ♡
        </motion.span>
      </div>
      <div className="shopfront__foot">
        <div className="shopfront__chalk">
          <p className="shopfront__chalk-title">bloem van de dag</p>
          <p className="shopfront__chalk-flower">
            {today.emoji} {today.name}
          </p>
          <p className="shopfront__chalk-meaning">“{today.meaning}”</p>
        </div>
        <p className="shopfront__stats">{stats}</p>
      </div>
    </header>
  );
}
