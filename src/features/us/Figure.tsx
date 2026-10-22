import { useId } from 'react';
import type { Look, Person } from '../../data/types';
import { INK } from '../../components/art/shapes';
import { useBlink } from '../pet/Bunny';
import { outfitFor, type Outfit } from './wardrobe';

/**
 * Mini us: cartoon versions of the two of us, drawn from our photos.
 * Feet stand on y = 0; the figure is `heightCm × 1.5625` units tall, so the
 * real height difference (192 cm vs 158 cm) shows. Arms are posed by where
 * the hands should go (with a little two-bone IK), so new poses are cheap.
 */

export type Pose =
  | 'idle'
  | 'wave'
  | 'peace'
  | 'heart'
  | 'selfie'
  | 'hug'
  | 'highfive'
  | 'point'
  | 'talk'
  | 'shrug';
export type Face = 'smile' | 'grin' | 'kiss' | 'talk' | 'wink' | 'happy' | 'calm';

type P = { x: number; y: number };

const SKIN = { you: '#a46d48', partner: '#8f5a3b' };
const SKIN_SHADE = { you: '#8d5a39', partner: '#7a4a2f' };
const HAIR = '#1b1413';
const HAIR_LIGHT = '#3a2621';
const S = {
  stroke: INK,
  strokeWidth: 2.6,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

interface Build {
  headR: number;
  shoulder: number;
  waist: number;
  hip: number;
  upper: number;
  fore: number;
  arm: number;
}

const BUILD: Record<Person, Build> = {
  you: { headR: 33, shoulder: 40, waist: 31, hip: 30, upper: 52, fore: 50, arm: 15 },
  partner: { headR: 30, shoulder: 30, waist: 25, hip: 36, upper: 41, fore: 40, arm: 12.5 },
};

export const heightUnits = (cm: number) => cm * 1.5625;

/** Where the elbow goes so the hand reaches `target`: outward and down, like a real arm. */
function solveArm(s: P, target: P, a: number, b: number, side: 1 | -1): { elbow: P; hand: P } {
  const dx = target.x - s.x;
  const dy = target.y - s.y;
  const dist = Math.hypot(dx, dy);
  const d = Math.max(Math.abs(a - b) + 1, Math.min(dist, a + b - 0.5));
  const base = Math.atan2(dy, dx);
  const angle = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const options = [base + angle, base - angle].map((t) => ({
    x: s.x + a * Math.cos(t),
    y: s.y + a * Math.sin(t),
  }));
  const score = (e: P) => e.y + (e.x - s.x) * side * 0.8;
  const elbow = score(options[0]) >= score(options[1]) ? options[0] : options[1];
  const hand = dist > d ? { x: s.x + (dx / dist) * d, y: s.y + (dy / dist) * d } : target;
  return { elbow, hand };
}

export function Figure({
  who,
  look,
  heightCm,
  pose = 'idle',
  face = 'smile',
  toward = 1,
  lean = 0,
  tilt = 0,
}: {
  who: Person;
  look: Look;
  heightCm: number;
  pose?: Pose;
  face?: Face;
  /** Which side the other person is on (for hugs and high fives). */
  toward?: 1 | -1;
  /** Lean the upper body (degrees), e.g. for a forehead kiss. */
  lean?: number;
  /** Tilt the head (degrees). */
  tilt?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const blink = useBlink(face !== 'happy' && face !== 'wink');
  const B = BUILD[who];
  const H = heightUnits(heightCm);
  const outfit = outfitFor(who, look.outfit);
  const acc = new Set(look.accessories);
  const skin = SKIN[who];
  const shade = SKIN_SHADE[who];
  const her = who === 'partner';

  const cy = -H + B.headR + 4;
  const shY = cy + B.headR + 11;
  const hipY = -H * 0.47;
  const waistY = shY + (hipY - shY) * 0.55;
  const legX = B.hip * 0.47;
  const kneeY = hipY * 0.48;

  // Hands for this pose.
  const holdsTeddy = acc.has('teddy') && (pose === 'idle' || pose === 'talk');
  const holdsCup = acc.has('stanley') && (pose === 'idle' || pose === 'talk' || pose === 'point');
  const sL: P = { x: -B.shoulder + 6, y: shY + 7 };
  const sR: P = { x: B.shoulder - 6, y: shY + 7 };
  const reach = (B.upper + B.fore) * 0.96;
  const rest = (side: -1 | 1): P => ({ x: side * (B.shoulder + 2), y: shY + 7 + reach });
  const t = toward;
  let targetL = rest(-1);
  let targetR = rest(1);
  switch (pose) {
    case 'wave':
      targetR = { x: B.shoulder + 30, y: shY - 62 };
      break;
    case 'peace':
      targetR = { x: B.headR * 0.95, y: cy + 4 };
      break;
    case 'heart':
      targetL = { x: -7, y: shY + 26 };
      targetR = { x: 7, y: shY + 26 };
      break;
    case 'selfie':
      targetR = { x: B.shoulder * 0.45, y: shY + 8 };
      break;
    case 'hug':
      targetL = { x: t * (B.shoulder + 22) - (t < 0 ? 6 : -6), y: shY + 34 };
      targetR = { x: t * (B.shoulder + 40), y: shY + 18 };
      if (t < 0)
        [targetL, targetR] = [
          { x: -(B.shoulder + 40), y: shY + 18 },
          { x: -(B.shoulder + 22) + 6, y: shY + 34 },
        ];
      break;
    case 'highfive':
      // Hands meet at her height: she reaches up, he reaches across.
      if (t > 0) targetR = { x: B.shoulder + 36, y: her ? shY - 48 : shY - 2 };
      else targetL = { x: -(B.shoulder + 36), y: her ? shY - 48 : shY - 2 };
      break;
    case 'point':
      targetR = { x: B.shoulder * 0.55, y: shY + 30 };
      break;
    case 'talk':
      targetR = { x: B.shoulder + 16, y: shY + 52 };
      break;
    case 'shrug':
      targetL = { x: -(B.shoulder + 30), y: shY + 20 };
      targetR = { x: B.shoulder + 30, y: shY + 20 };
      break;
  }
  if (holdsTeddy) targetL = { x: -B.shoulder * 0.3, y: shY + 52 };
  if (holdsCup && pose === 'idle') targetR = { x: B.shoulder + 8, y: shY + 7 + reach * 0.86 };
  const armL = solveArm(sL, targetL, B.upper, B.fore, 1);
  const armR = solveArm(sR, targetR, B.upper, B.fore, -1);

  const sleeve = outfit.layer
    ? outfit.layer.color
    : outfit.top.kind === 'longsleeve'
      ? outfit.top.color
      : null;
  const shortSleeve =
    !outfit.layer && (outfit.top.kind === 'tee' || outfit.top.kind === 'polo')
      ? outfit.top.color
      : null;

  const torso = `M${-B.shoulder} ${shY + 10}Q${-B.shoulder} ${shY} ${-B.shoulder + 12} ${shY}H${B.shoulder - 12}Q${B.shoulder} ${shY} ${B.shoulder} ${shY + 10}C${B.shoulder - 2} ${waistY - 10} ${B.waist} ${waistY - 6} ${B.waist} ${waistY}C${B.waist} ${waistY + 10} ${B.hip} ${hipY - 14} ${B.hip} ${hipY + 4}H${-B.hip}C${-B.hip} ${hipY - 14} ${-B.waist} ${waistY + 10} ${-B.waist} ${waistY}C${-B.waist} ${waistY - 6} ${-B.shoulder + 2} ${waistY - 10} ${-B.shoulder} ${shY + 10}Z`;

  const arm = (a: { elbow: P; hand: P }, s: P, side: -1 | 1, front: boolean) => {
    const path = `M${s.x} ${s.y}L${a.elbow.x} ${a.elbow.y}L${a.hand.x} ${a.hand.y}`;
    const upperPath = `M${s.x} ${s.y}L${a.elbow.x} ${a.elbow.y}`;
    const shortEnd = { x: s.x + (a.elbow.x - s.x) * 0.6, y: s.y + (a.elbow.y - s.y) * 0.6 };
    const w = B.arm;
    const ringHand = her && side === -1 && acc.has('ring');
    return (
      <g key={`arm${side}${front}`}>
        <path
          d={path}
          fill="none"
          stroke={INK}
          strokeWidth={w + 5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path}
          fill="none"
          stroke={skin}
          strokeWidth={w}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {sleeve && (
          <path
            d={`M${s.x} ${s.y}L${a.elbow.x} ${a.elbow.y}L${a.elbow.x + (a.hand.x - a.elbow.x) * 0.82} ${a.elbow.y + (a.hand.y - a.elbow.y) * 0.82}`}
            fill="none"
            stroke={sleeve}
            strokeWidth={w + 2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {shortSleeve && (
          <path
            d={`M${s.x} ${s.y}L${shortEnd.x} ${shortEnd.y}`}
            fill="none"
            stroke={shortSleeve}
            strokeWidth={w + 4}
            strokeLinecap="round"
          />
        )}
        {!sleeve && !shortSleeve && (
          <path d={upperPath} fill="none" stroke={skin} strokeWidth={w} strokeLinecap="round" />
        )}
        {(acc.has('bracelet') && !her && side === 1) || (her && side === 1) ? (
          <circle
            cx={a.elbow.x + (a.hand.x - a.elbow.x) * 0.84}
            cy={a.elbow.y + (a.hand.y - a.elbow.y) * 0.84}
            r={w * 0.42}
            fill="none"
            stroke={her ? '#e2b65a' : '#c9cdd3'}
            strokeWidth="2"
          />
        ) : null}
        <circle cx={a.hand.x} cy={a.hand.y} r={w * 0.62} fill={skin} {...S} strokeWidth={2.2} />
        {her && (
          <path
            d={`M${a.hand.x - 3} ${a.hand.y + w * 0.5}l-1 3M${a.hand.x + 1} ${a.hand.y + w * 0.58}v3.2M${a.hand.x + 4} ${a.hand.y + w * 0.5}l1 3`}
            stroke="#f0d6cf"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        {ringHand && (
          <circle
            cx={a.hand.x + 3}
            cy={a.hand.y + 2}
            r="2.2"
            fill="#f4f1ff"
            stroke="#b9b3d6"
            strokeWidth="1"
          />
        )}
      </g>
    );
  };

  const peaceFingers = (h: P) => (
    <g>
      <path
        d={`M${h.x - 3} ${h.y - 4}l-4 -14M${h.x + 3} ${h.y - 4}l4 -14`}
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d={`M${h.x - 3} ${h.y - 4}l-4 -14M${h.x + 3} ${h.y - 4}l4 -14`}
        stroke={skin}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </g>
  );

  const legs = (
    <Legs
      outfit={outfit}
      H={H}
      hipY={hipY}
      kneeY={kneeY}
      legX={legX}
      hip={B.hip}
      skin={skin}
      her={her}
    />
  );

  const head = (
    <g
      style={{
        transformBox: 'view-box',
        transformOrigin: `0px ${shY}px`,
        transform: `rotate(${tilt}deg)`,
        transition: 'transform 0.4s ease',
      }}
    >
      {/* neck */}
      <rect x={-8} y={cy + B.headR - 8} width="16" height="22" fill={shade} />
      {!her && (
        <>
          <circle cx={-B.headR * 0.98} cy={cy + 3} r="7.5" fill={skin} {...S} strokeWidth={2.2} />
          <circle cx={B.headR * 0.98} cy={cy + 3} r="7.5" fill={skin} {...S} strokeWidth={2.2} />
        </>
      )}
      <ellipse cx="0" cy={cy} rx={B.headR * 0.9} ry={B.headR} fill={skin} {...S} />
      {/* jaw shading */}
      <path
        d={`M${-B.headR * 0.62} ${cy + B.headR * 0.55}q${B.headR * 0.62} ${B.headR * 0.5} ${B.headR * 1.24} 0`}
        fill="none"
        stroke={shade}
        strokeWidth="3"
        opacity="0.45"
      />
      <FaceFeatures
        who={who}
        cy={cy}
        r={B.headR}
        face={face}
        blink={blink}
        skin={skin}
        shade={shade}
      />
      {her ? (
        <HerFrontHair cy={cy} r={B.headR} wavy={look.hair === 'wavy'} uid={uid} />
      ) : (
        <HisHair cy={cy} r={B.headR} />
      )}
      {acc.has('sunglasses') && !her && (
        <g>
          <rect
            x={-B.headR * 0.62}
            y={cy - 6}
            width={B.headR * 0.5}
            height="11"
            rx="3"
            fill="#141215"
          />
          <rect
            x={B.headR * 0.12}
            y={cy - 6}
            width={B.headR * 0.5}
            height="11"
            rx="3"
            fill="#141215"
          />
          <path
            d={`M${-B.headR * 0.12} ${cy - 2}h${B.headR * 0.24}`}
            stroke="#141215"
            strokeWidth="2.5"
          />
          <path
            d={`M${-B.headR * 0.55} ${cy - 3}l5 0`}
            stroke="#fff"
            strokeWidth="1.5"
            opacity="0.5"
          />
        </g>
      )}
      {acc.has('cap') && !her && (
        <g>
          <path
            d={`M${-B.headR * 0.95} ${cy - B.headR * 0.42}C${-B.headR * 0.9} ${cy - B.headR * 1.25} ${B.headR * 0.9} ${cy - B.headR * 1.3} ${B.headR * 0.98} ${cy - B.headR * 0.5}z`}
            fill="#5f6f86"
            {...S}
          />
          <path
            d={`M${-B.headR * 0.55} ${cy - B.headR * 0.48}q${B.headR * 0.9} ${-B.headR * 0.12} ${B.headR * 1.55} ${B.headR * 0.12}q${-B.headR * 0.6} ${B.headR * 0.22} ${-B.headR * 1.55} ${-B.headR * 0.12}z`}
            fill="#4c5a6e"
            {...S}
            strokeWidth={2}
          />
        </g>
      )}
      {acc.has('bucket-hat') && her && (
        <g>
          <path
            d={`M${-B.headR * 0.88} ${cy - B.headR * 0.45}C${-B.headR * 0.85} ${cy - B.headR * 1.3} ${B.headR * 0.85} ${cy - B.headR * 1.3} ${B.headR * 0.88} ${cy - B.headR * 0.45}z`}
            fill="#5b4031"
            {...S}
          />
          <path
            d={`M${-B.headR * 1.25} ${cy - B.headR * 0.32}q${B.headR * 1.25} ${-B.headR * 0.42} ${B.headR * 2.5} 0q${-B.headR * 1.25} ${B.headR * 0.22} ${-B.headR * 2.5} 0z`}
            fill="#6b4c3b"
            {...S}
          />
        </g>
      )}
    </g>
  );

  return (
    <g className="mini">
      <defs>
        <linearGradient id={`hairshine-${uid}`} x1="0" x2="1">
          <stop offset="0%" stopColor={HAIR} />
          <stop offset="45%" stopColor={HAIR_LIGHT} />
          <stop offset="100%" stopColor={HAIR} />
        </linearGradient>
      </defs>
      <ellipse cx="0" cy="2" rx={B.hip + 22} ry="7" fill="#000" opacity="0.13" />
      {acc.has('backpack') && !her && (
        <rect
          x={-B.shoulder - 2}
          y={shY + 8}
          width={B.shoulder * 2 + 4}
          height={hipY - shY}
          rx="14"
          fill="#1b1a1d"
          {...S}
        />
      )}
      {her && <HerBackHair cy={cy} r={B.headR} shY={shY} wavy={look.hair === 'wavy'} uid={uid} />}
      {legs}
      <g
        className="mini__upper"
        style={{
          transformBox: 'view-box',
          transformOrigin: `0px ${hipY}px`,
          transform: `rotate(${lean}deg)`,
          transition: 'transform 0.45s ease',
        }}
      >
        <g
          className="mini__breath"
          style={{ transformBox: 'view-box', transformOrigin: `0px ${hipY}px` }}
        >
          {/* torso: skin base, then clothes */}
          <path d={torso} fill={skin} {...S} />
          <Top
            outfit={outfit}
            torso={torso}
            B={B}
            shY={shY}
            hipY={hipY}
            waistY={waistY}
            skin={skin}
          />
          {acc.has('chain') && !her && (
            <g>
              <path d={`M-12 ${shY + 1}q12 26 24 0`} fill="none" stroke="#d6dbe1" strokeWidth="2" />
              <path
                d={`M0 ${shY + 13}v9M-3 ${shY + 16}h6`}
                stroke="#d6dbe1"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          )}
          {acc.has('necklace') && her && (
            <path d={`M-10 ${shY - 1}q10 18 20 0`} fill="none" stroke="#e2b65a" strokeWidth="1.8" />
          )}
          {acc.has('backpack') && !her && (
            <path
              d={`M${-B.shoulder + 10} ${shY + 2}v${(hipY - shY) * 0.7}M${B.shoulder - 10} ${shY + 2}v${(hipY - shY) * 0.7}`}
              stroke="#1b1a1d"
              strokeWidth="6"
            />
          )}
          {acc.has('black-bag') && her && (
            <g>
              <path
                d={`M${B.shoulder - 8} ${shY + 2}L${-B.hip + 4} ${hipY - 6}`}
                stroke="#1b1a1d"
                strokeWidth="3"
              />
              <rect
                x={-B.hip - 12}
                y={hipY - 14}
                width="26"
                height="20"
                rx="5"
                fill="#1b1a1d"
                {...S}
                strokeWidth={2}
              />
            </g>
          )}
          {head}
          {holdsTeddy && <Teddy x={-B.shoulder - 6} y={shY + 30} />}
          {arm(armL, sL, -1, true)}
          {arm(armR, sR, 1, true)}
          {pose === 'peace' && peaceFingers(armR.hand)}
          {pose === 'heart' && (
            <path
              d={`M0 ${shY + 34}l-11 -11a6.5 6.5 0 0 1 11 -8a6.5 6.5 0 0 1 11 8z`}
              fill="none"
              stroke={skin}
              strokeWidth="5"
              strokeLinejoin="round"
            />
          )}
          {pose === 'selfie' && (
            <g transform={`translate(${armR.hand.x} ${armR.hand.y - 22}) rotate(-6)`}>
              <rect
                x="-11"
                y="-20"
                width="22"
                height="38"
                rx="5"
                fill={her ? '#cdd6c2' : '#d9d4cc'}
                {...S}
                strokeWidth={2}
              />
              <circle cx="-4" cy="-13" r="3" fill="#2a2a2a" />
              <circle cx="3" cy="-13" r="3" fill="#2a2a2a" />
              <circle cx="-0.5" cy="-7" r="3" fill="#2a2a2a" />
            </g>
          )}
          {holdsCup && <Stanley x={armR.hand.x + 2} y={armR.hand.y} />}
          {acc.has('pink-bag') && her && pose !== 'heart' && pose !== 'hug' && (
            <PinkBag x={armL.hand.x} y={armL.hand.y} />
          )}
        </g>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------- the parts */

function FaceFeatures({
  who,
  cy,
  r,
  face,
  blink,
  skin,
  shade,
}: {
  who: Person;
  cy: number;
  r: number;
  face: Face;
  blink: boolean;
  skin: string;
  shade: string;
}) {
  const her = who === 'partner';
  const ex = r * 0.36;
  const ey = cy + r * 0.04;
  const closed = blink || face === 'happy';
  const eye = (x: number, wink = false) =>
    closed || wink ? (
      <path
        d={`M${x - 5} ${ey}q5 -5 10 0`}
        fill="none"
        stroke={INK}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    ) : (
      <g>
        <ellipse cx={x} cy={ey} rx="4" ry="5" fill="#1a1214" />
        <circle cx={x + 1.4} cy={ey - 1.8} r="1.5" fill="#fff" />
        {her && (
          <path
            d={`M${x + (x > 0 ? 3 : -3)} ${ey - 4}l${x > 0 ? 3 : -3} -3`}
            stroke="#1a1214"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        )}
      </g>
    );
  const my = cy + r * 0.46;
  const lip = her ? '#6e3a3c' : '#5c3428';
  return (
    <g>
      {/* brows */}
      <path
        d={`M${-ex - 6} ${ey - 10}q6 ${her ? -4 : -3} 12 -1M${ex - 6} ${ey - 11}q6 ${her ? -3 : -3} 12 1`}
        fill="none"
        stroke="#1b1413"
        strokeWidth={her ? 2.2 : 3}
        strokeLinecap="round"
      />
      {eye(-ex)}
      {eye(ex, face === 'wink')}
      {/* nose */}
      <path
        d={`M-1 ${cy + r * 0.18}q3 4 0 7`}
        fill="none"
        stroke={shade}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx={-r * 0.55} cy={cy + r * 0.3} r="5" fill="#d27c74" opacity={her ? 0.35 : 0.18} />
      <circle cx={r * 0.55} cy={cy + r * 0.3} r="5" fill="#d27c74" opacity={her ? 0.35 : 0.18} />
      {/* mouth */}
      {face === 'kiss' ? (
        <g>
          <ellipse cx="2" cy={my} rx="5" ry="4.2" fill={lip} {...S} strokeWidth={1.6} />
          <path d={`M-1 ${my}h6`} stroke="#3d1f22" strokeWidth="1.2" />
        </g>
      ) : face === 'grin' || face === 'happy' ? (
        <g>
          <path
            d={`M-10 ${my - 2}q10 13 20 0z`}
            fill="#fff"
            stroke={her ? lip : INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d={`M-10 ${my - 2}h20`} stroke={her ? lip : INK} strokeWidth="2" />
        </g>
      ) : face === 'talk' ? (
        <ellipse
          cx="0"
          cy={my}
          rx="5"
          ry="4"
          fill="#4a2326"
          stroke={her ? lip : INK}
          strokeWidth="1.8"
        />
      ) : face === 'calm' ? (
        <path
          d={`M-5 ${my}q5 2 10 0`}
          fill="none"
          stroke={her ? lip : INK}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d={`M-7 ${my - 1}q7 7 14 0`}
          fill="none"
          stroke={her ? lip : INK}
          strokeWidth={her ? 3 : 2.4}
          strokeLinecap="round"
        />
      )}
      {!her && (
        <>
          {/* thin moustache and a small chin beard, like in the photos */}
          <path
            d={`M-8 ${my - 6}q8 -4 16 0`}
            fill="none"
            stroke="#1b1413"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path d={`M-5 ${cy + r * 0.82}q5 6 10 0q-5 -4 -10 0z`} fill="#1b1413" />
          <path
            d={`M${-r * 0.5} ${cy + r * 0.6}q${r * 0.5} ${r * 0.42} ${r} 0`}
            fill="none"
            stroke="#1b1413"
            strokeWidth="1.2"
            opacity="0.25"
          />
        </>
      )}
      {skin && null}
    </g>
  );
}

function HisHair({ cy, r }: { cy: number; r: number }) {
  // Short faded sides, a crown of tight curls falling forward.
  const curls: P[] = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.08 + (i / 8) * 0.84);
    curls.push({ x: Math.cos(a) * r * 0.78, y: cy - r * 0.42 + Math.sin(a) * r * 0.62 });
  }
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.15 + (i / 6) * 0.7);
    curls.push({ x: Math.cos(a) * r * 0.5, y: cy - r * 0.55 + Math.sin(a) * r * 0.48 });
  }
  const fringe: P[] = [-0.42, -0.16, 0.1, 0.36].map((f, i) => ({
    x: f * r,
    y: cy - r * 0.48 + (i % 2) * 3,
  }));
  return (
    <g>
      <path
        d={`M${-r * 0.9} ${cy - r * 0.1}C${-r * 0.95} ${cy - r * 1.2} ${r * 0.95} ${cy - r * 1.2} ${r * 0.9} ${cy - r * 0.1}C${r * 0.7} ${cy - r * 0.5} ${-r * 0.7} ${cy - r * 0.5} ${-r * 0.9} ${cy - r * 0.1}z`}
        fill={HAIR}
      />
      {[...curls, ...fringe].map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={r * 0.2}
          fill={i % 3 ? HAIR : HAIR_LIGHT}
          stroke={INK}
          strokeWidth="1.6"
        />
      ))}
      {[...curls, ...fringe].map((c, i) => (
        <path
          key={`s${i}`}
          d={`M${c.x - 2} ${c.y - 1}q2 -3 4 0`}
          fill="none"
          stroke="#4a3530"
          strokeWidth="1.2"
        />
      ))}
      {/* fade */}
      <path
        d={`M${-r * 0.9} ${cy - r * 0.15}q-2 ${r * 0.35} 2 ${r * 0.55}`}
        stroke={HAIR}
        strokeWidth="4"
        opacity="0.55"
        fill="none"
      />
      <path
        d={`M${r * 0.9} ${cy - r * 0.15}q2 ${r * 0.35} -2 ${r * 0.55}`}
        stroke={HAIR}
        strokeWidth="4"
        opacity="0.55"
        fill="none"
      />
    </g>
  );
}

function HerBackHair({
  cy,
  r,
  shY,
  wavy,
  uid,
}: {
  cy: number;
  r: number;
  shY: number;
  wavy: boolean;
  uid: string;
}) {
  const bottom = shY + 92;
  const w = r * 1.2;
  const d = wavy
    ? `M${-w} ${cy}C${-w} ${cy - r * 1.4} ${w} ${cy - r * 1.4} ${w} ${cy}Q${w + 14} ${cy + 30} ${w + 4} ${cy + 60}Q${w - 6} ${cy + 90} ${w + 8} ${bottom}Q0 ${bottom + 16} ${-w - 8} ${bottom}Q${-w + 6} ${cy + 90} ${-w - 4} ${cy + 60}Q${-w - 14} ${cy + 30} ${-w} ${cy}z`
    : `M${-w} ${cy}C${-w} ${cy - r * 1.4} ${w} ${cy - r * 1.4} ${w} ${cy}L${w + 6} ${bottom}Q0 ${bottom + 14} ${-w - 6} ${bottom}z`;
  return <path d={d} fill={`url(#hairshine-${uid})`} {...S} />;
}

function HerFrontHair({ cy, r, wavy, uid }: { cy: number; r: number; wavy: boolean; uid: string }) {
  // Middle part, long curtains framing the face.
  const top = cy - r * 1.04;
  const side = (dir: 1 | -1) => {
    const outer = wavy
      ? `Q${dir * r * 1.3} ${cy + r * 0.4} ${dir * r * 1.1} ${cy + r * 0.8}Q${dir * r * 0.92} ${cy + r * 1.2} ${dir * r * 1.18} ${cy + r * 1.62}`
      : `L${dir * r * 1.16} ${cy + r * 1.62}`;
    return (
      `M0 ${top}C${dir * r * 0.55} ${top - 3} ${dir * r * 1.1} ${cy - r * 0.72} ${dir * r * 1.1} ${cy}` +
      outer +
      `L${dir * r * 0.8} ${cy + r * 1.55}C${dir * r * 0.76} ${cy + r * 0.8} ${dir * r * 0.86} ${cy - r * 0.15} ${dir * r * 0.66} ${cy - r * 0.55}` +
      `C${dir * r * 0.48} ${cy - r * 0.85} ${dir * r * 0.18} ${top + 8} 0 ${top + 6}z`
    );
  };
  return (
    <g>
      {([-1, 1] as const).map((dir) => (
        <path
          key={dir}
          d={side(dir)}
          fill={`url(#hairshine-${uid})`}
          stroke={INK}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      ))}
      <path
        d={`M${-r * 0.58} ${cy - r * 0.62}q-6 20 -4 44M${r * 0.58} ${cy - r * 0.62}q6 20 4 44`}
        fill="none"
        stroke="#4b322b"
        strokeWidth="1.6"
        opacity="0.7"
      />
    </g>
  );
}

function Top({
  outfit,
  torso,
  B,
  shY,
  hipY,
  waistY,
  skin,
}: {
  outfit: Outfit;
  torso: string;
  B: Build;
  shY: number;
  hipY: number;
  waistY: number;
  skin: string;
}) {
  const { top, layer, bottom } = outfit;
  const isDress = bottom.kind === 'dress';
  return (
    <g>
      {top.kind === 'cami' ? (
        <g>
          {/* neckline and straps: the top starts at the chest */}
          <path
            d={`M${-B.shoulder + 4} ${shY + 22}Q0 ${shY + 30} ${B.shoulder - 4} ${shY + 22}C${B.shoulder - 2} ${waistY - 8} ${B.waist} ${waistY - 4} ${B.waist} ${waistY}C${B.waist} ${waistY + 10} ${B.hip} ${hipY - 14} ${B.hip} ${hipY + 4}H${-B.hip}C${-B.hip} ${hipY - 14} ${-B.waist} ${waistY + 10} ${-B.waist} ${waistY}C${-B.waist} ${waistY - 4} ${-B.shoulder + 2} ${waistY - 8} ${-B.shoulder + 4} ${shY + 22}Z`}
            fill={top.color}
            {...S}
          />
          <path
            d={`M${-B.shoulder + 10} ${shY + 22}l2 -21M${B.shoulder - 10} ${shY + 22}l-2 -21`}
            stroke={top.color}
            strokeWidth="3"
          />
          {isDress && bottom.lace && (
            <path
              d={`M${-B.shoulder + 6} ${shY + 23}Q0 ${shY + 32} ${B.shoulder - 6} ${shY + 23}`}
              fill="none"
              stroke="#1b1413"
              strokeWidth="2"
              strokeDasharray="2 3"
            />
          )}
        </g>
      ) : (
        <g>
          <path d={torso} fill={top.color} {...S} />
          {top.kind === 'longsleeve' && top.ribbed && (
            <path
              d={Array.from(
                { length: 7 },
                (_, i) =>
                  `M${-B.waist + 6 + i * ((B.waist * 2 - 12) / 6)} ${shY + 16}v${hipY - shY - 18}`,
              ).join('')}
              stroke="#000"
              strokeWidth="1"
              opacity="0.25"
            />
          )}
          {/* neckline */}
          <path
            d={`M-12 ${shY}q12 ${top.kind === 'polo' ? 6 : 10} 24 0`}
            fill={skin}
            stroke={INK}
            strokeWidth="2"
          />
          {top.kind === 'polo' && (
            <path
              d={`M-12 ${shY - 1}l8 12l4 -8l4 8l8 -12`}
              fill={top.color}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}
        </g>
      )}
      {layer && <LayerArt layer={layer} B={B} shY={shY} hipY={hipY} />}
    </g>
  );
}

function LayerArt({
  layer,
  B,
  shY,
  hipY,
}: {
  layer: NonNullable<Outfit['layer']>;
  B: Build;
  shY: number;
  hipY: number;
}) {
  const w = B.shoulder + 4;
  const cropped = layer.kind === 'denim';
  const hem = cropped ? hipY - (hipY - shY) * 0.22 : hipY + (layer.kind === 'blazer' ? 14 : 8);
  const hemW =
    layer.kind === 'puffer' ? Math.max(B.hip, B.waist) + 8 : Math.max(B.hip, B.waist) + 3;
  const panel = (dir: 1 | -1) =>
    `M${dir * 8} ${shY - 2}L${dir * (w - 12)} ${shY - 2}Q${dir * w} ${shY} ${dir * w} ${shY + 12}L${dir * hemW} ${hem}L${dir * (layer.kind === 'blazer' ? 10 : 12)} ${hem}L${dir * (layer.kind === 'blazer' ? 4 : 12)} ${shY + (layer.kind === 'blazer' ? 46 : 8)}z`;
  return (
    <g>
      {(layer.kind === 'zip-hoodie' || layer.kind === 'puffer') && (
        <path
          d={`M-18 ${shY - 2}q18 -14 36 0q-4 10 -18 10q-14 0 -18 -10z`}
          fill={layer.kind === 'zip-hoodie' && layer.hood ? layer.hood : layer.color}
          {...S}
          strokeWidth={2.2}
        />
      )}
      {([-1, 1] as const).map((dir) => (
        <path key={dir} d={panel(dir)} fill={layer.color} {...S} />
      ))}
      {layer.kind === 'puffer' &&
        [0.28, 0.52, 0.76].map((f) => (
          <path
            key={f}
            d={`M${-hemW + 2} ${shY + (hem - shY) * f}q${hemW * 0.5} 5 ${hemW - 12} 0M${12} ${shY + (hem - shY) * f}q${hemW * 0.5} 5 ${hemW - 14} 0`}
            fill="none"
            stroke={INK}
            strokeWidth="1.6"
            opacity="0.45"
          />
        ))}
      {layer.kind === 'puffer' && (
        <path
          d={`M${-w + 8} ${shY + 18}q4 18 2 34`}
          stroke={layer.shine}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.8"
        />
      )}
      {layer.kind === 'zip-hoodie' && (
        <path
          d={`M-12 ${shY + 8}V${hem}M12 ${shY + 8}V${hem}`}
          stroke="#8d8790"
          strokeWidth="1.6"
          strokeDasharray="2 2"
        />
      )}
      {layer.kind === 'denim' && (
        <g stroke="#6d8aab" strokeWidth="1.6" fill="none">
          <path d={`M${-w + 10} ${shY + 20}h${w - 22}M${12} ${shY + 20}h${w - 22}`} />
          <path d={`M-14 ${shY + 2}l-6 14M14 ${shY + 2}l6 14`} stroke={INK} strokeWidth="2" />
        </g>
      )}
      {layer.kind === 'blazer' && (
        <g>
          <path
            d={`M-10 ${shY - 2}l-10 22l12 4z M10 ${shY - 2}l10 22l-12 4z`}
            fill="#77787c"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="-9" cy={hem - 22} r="2.4" fill="#2b2a2d" />
        </g>
      )}
    </g>
  );
}

function Legs({
  outfit,
  H,
  hipY,
  kneeY,
  legX,
  hip,
  skin,
  her,
}: {
  outfit: Outfit;
  H: number;
  hipY: number;
  kneeY: number;
  legX: number;
  hip: number;
  skin: string;
  her: boolean;
}) {
  const { bottom, shoes } = outfit;
  const ankle = -10;
  const leg = (
    dir: 1 | -1,
    topW: number,
    botW: number,
    from: number,
    to: number,
    color: string,
  ) => (
    <path
      key={`${dir}${color}${from}`}
      d={`M${dir * legX - topW} ${from}L${dir * legX + topW} ${from}L${dir * (legX + 2) + botW} ${to}Q${dir * (legX + 2)} ${to + 4} ${dir * (legX + 2) - botW} ${to}z`}
      fill={color}
      {...S}
    />
  );
  const legs: React.ReactNode[] = [];
  const skinLeg = (from: number, color = skin, w = her ? 10 : 11, b = her ? 7 : 8) =>
    ([-1, 1] as const).forEach((d) => legs.push(leg(d, w, b, from, ankle, color)));

  if (bottom.kind === 'baggy') {
    ([-1, 1] as const).forEach((d) =>
      legs.push(leg(d, hip * 0.55, hip * 0.62, hipY, ankle + 2, bottom.color)),
    );
    if (bottom.print === 'stripe')
      ([-1, 1] as const).forEach((d) =>
        legs.push(
          <path
            key={`st${d}`}
            d={`M${d * (legX + hip * 0.5)} ${hipY + 6}L${d * (legX + hip * 0.58)} ${ankle - 2}`}
            stroke="#1b1a1d"
            strokeWidth="3"
          />,
        ),
      );
    if (bottom.print === 'logo')
      legs.push(
        <text
          key="logo"
          x={legX - 8}
          y={hipY + 30}
          fontSize="7"
          fill="#e8e3da"
          fontFamily="system-ui"
          fontWeight="800"
        >
          ✦✦
        </text>,
      );
  } else if (bottom.kind === 'leggings') {
    ([-1, 1] as const).forEach((d) => legs.push(leg(d, hip * 0.48, 7, hipY, ankle, bottom.color)));
  } else if (bottom.kind === 'shorts') {
    skinLeg(kneeY);
    ([-1, 1] as const).forEach((d) =>
      legs.push(leg(d, hip * 0.58, hip * 0.6, hipY, kneeY + 10, bottom.color)),
    );
    if (bottom.cargo)
      ([-1, 1] as const).forEach((d) =>
        legs.push(
          <rect
            key={`cp${d}`}
            x={d * (legX + hip * 0.25) - 6}
            y={kneeY - 16}
            width="12"
            height="12"
            rx="2"
            fill="none"
            stroke="#8e8e91"
            strokeWidth="1.6"
          />,
        ),
      );
  } else if (bottom.kind === 'skirt') {
    skinLeg(hipY + 10, bottom.tights, 10, 7);
    legs.push(
      <path
        key="skirt"
        d={`M${-hip - 1} ${hipY - 2}H${hip + 1}L${hip + 8} ${kneeY + 6}H${-hip - 8}z`}
        fill={bottom.color}
        {...S}
      />,
    );
  } else {
    // dress
    const hem = bottom.length === 'midi' ? -H * 0.13 : kneeY + 4;
    skinLeg(hem - 6);
    legs.push(
      <path
        key="dress"
        d={`M${-hip - 1} ${hipY - 6}H${hip + 1}C${hip + 3} ${hem - 30} ${hip - 2} ${hem - 10} ${hip - 4} ${hem}H${-hip + 4}C${-hip + 2} ${hem - 10} ${-hip - 3} ${hem - 30} ${-hip - 1} ${hipY - 6}z`}
        fill={bottom.color}
        {...S}
      />,
    );
    if (bottom.lace)
      legs.push(
        <path
          key="lace"
          d={`M${-hip + 4} ${hem}H${hip - 4}`}
          stroke="#1b1413"
          strokeWidth="5"
          strokeDasharray="3 2"
        />,
      );
  }

  const foot = (dir: 1 | -1) => {
    const x = dir * (legX + 2);
    switch (shoes.kind) {
      case 'sneakers':
        return (
          <g key={`f${dir}`}>
            <path
              d={`M${x - 13} -2Q${x - 14} -14 ${x - 2} -14Q${x + 10} -14 ${x + dir * 18} -4Q${x + dir * 20} 2 ${x + dir * 6} 2H${x - 12}Q${x - 15} 2 ${x - 13} -2z`}
              fill={shoes.color}
              {...S}
            />
            <path d={`M${x - 12} -1H${x + dir * 16}`} stroke="#f2efea" strokeWidth="3" />
            <path
              d={`M${x - 3} -12l5 4M${x + 1} -13l5 4`}
              stroke={shoes.laces}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        );
      case 'boots':
        return (
          <g key={`f${dir}`}>
            <path
              d={`M${x - 11} 2V-26H${x + 9}V-10Q${x + dir * 20} -8 ${x + dir * 20} 2z`}
              fill={shoes.color}
              {...S}
            />
            <path d={`M${x - 11} -24h20`} stroke="#8e6435" strokeWidth="4" />
            <path d={`M${x - 11} 0h${dir * 30}`} stroke="#6d4c2a" strokeWidth="3" />
          </g>
        );
      case 'fluffy':
        return (
          <g key={`f${dir}`}>
            <ellipse cx={x + dir * 4} cy="-3" rx="15" ry="7" fill={skin} />
            <path
              d={`M${x - 12} -2q-2 -12 8 -12q4 -4 8 0q8 -2 9 6q4 6 -2 9H${x - 10}z`}
              fill={shoes.color}
              {...S}
              strokeWidth={2}
            />
            <path
              d={`M${x - 8} -10l-3 -3M${x} -14v-3M${x + 8} -11l3 -3`}
              stroke={shoes.color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
        );
      case 'slides':
        return (
          <g key={`f${dir}`}>
            <path d={`M${x - 9} -2V-30H${x + 9}V-2z`} fill={shoes.socks} {...S} strokeWidth={2} />
            <path
              d={`M${x - 13} 2Q${x - 14} -10 ${x} -10Q${x + dir * 18} -10 ${x + dir * 18} 2z`}
              fill={shoes.color}
              {...S}
            />
          </g>
        );
    }
  };

  return (
    <g>
      {legs}
      {foot(-1)}
      {foot(1)}
    </g>
  );
}

function Stanley({ x, y }: { x: number; y: number }) {
  // Her Stanley cup: cream tumbler, lilac lid, straw and handle.
  return (
    <g transform={`translate(${x} ${y - 24})`}>
      <path d="M-9 -8h18l-3 44h-12z" fill="#f2ece4" {...S} strokeWidth={2} />
      <path d="M9 0q12 2 10 14q-2 8 -9 8" fill="none" stroke={INK} strokeWidth="5" />
      <path d="M9 0q12 2 10 14q-2 8 -9 8" fill="none" stroke="#f2ece4" strokeWidth="2.5" />
      <rect x="-10" y="-14" width="20" height="8" rx="3" fill="#c8b6e6" {...S} strokeWidth={2} />
      <path d="M3 -14l3 -16" stroke="#d6cce9" strokeWidth="3.5" strokeLinecap="round" />
    </g>
  );
}

function PinkBag({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-9 4q0 -14 9 -14q9 0 9 14" fill="none" stroke="#e9b8c6" strokeWidth="3" />
      <path d="M-16 4h32l-3 24h-26z" fill="#f2c8d4" {...S} strokeWidth={2} />
      <path d="M-14 10h28" stroke="#e3a9b9" strokeWidth="1.6" />
      <circle cx="0" cy="14" r="2" fill="#c9a24c" />
    </g>
  );
}

function Teddy({ x, y }: { x: number; y: number }) {
  // The giant white teddy from the fair.
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="40" rx="30" ry="42" fill="#fbfaf7" {...S} />
      <circle cx="-26" cy="-34" r="9" fill="#fbfaf7" {...S} />
      <circle cx="10" cy="-36" r="9" fill="#fbfaf7" {...S} />
      <ellipse cx="-8" cy="-14" rx="26" ry="24" fill="#fbfaf7" {...S} />
      <ellipse cx="-8" cy="-6" rx="10" ry="8" fill="#f1eee8" />
      <ellipse cx="-8" cy="-9" rx="4" ry="3" fill="#2a2326" />
      <circle cx="-18" cy="-20" r="3" fill="#2a2326" />
      <circle cx="2" cy="-20" r="3" fill="#2a2326" />
      <path d="M-20 10l-8 -6v12zM-20 10l8 -6v12z" fill="#9a8cd2" stroke={INK} strokeWidth="1.6" />
      <ellipse cx="-26" cy="78" rx="12" ry="8" fill="#fbfaf7" {...S} />
      <ellipse cx="14" cy="78" rx="12" ry="8" fill="#fbfaf7" {...S} />
    </g>
  );
}
