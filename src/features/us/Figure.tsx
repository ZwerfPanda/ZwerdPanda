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
/** The separately drawable pieces of a figure. */
export type Piece = 'body' | 'head' | 'armL' | 'armR';

export type Face = 'smile' | 'grin' | 'kiss' | 'talk' | 'wink' | 'happy' | 'calm';

type P = { x: number; y: number };

const SKIN = { you: '#bb855e', partner: '#946040' };
const SKIN_SHADE = { you: '#a06c48', partner: '#7d4d31' };
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
  you: { headR: 32, shoulder: 47, waist: 32, hip: 31, upper: 52, fore: 50, arm: 18 },
  partner: { headR: 30, shoulder: 30, waist: 25, hip: 36, upper: 41, fore: 40, arm: 12.5 },
};

export const heightUnits = (cm: number) => cm * 1.5625;

/** Where the head, shoulders and hips are, so a scene can line the two of us up. */
export function bodyFrame(who: Person, heightCm: number) {
  const B = BUILD[who];
  const H = heightUnits(heightCm);
  const cy = -H + B.headR + 4;
  const shY = cy + B.headR + 11;
  const hipY = -H * 0.47;
  return {
    cy,
    shY,
    hipY,
    waistY: shY + (hipY - shY) * 0.55,
    headR: B.headR,
    shoulder: B.shoulder,
    /** Mouth height, relative to the head centre. */
    mouth: B.headR * (who === 'partner' ? 0.5 : 0.62),
  };
}

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
  // Elbows go out to the side and down, like real arms: never in towards the
  // body or across the face, whatever the hand is doing.
  const score = (e: P) => -(e.x - s.x) * side + e.y * 0.6;
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
  dip = 0,
  tiptoe = 0,
  hands,
  pieces,
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
  /** Bend the knees: lowers the upper body by this many units. */
  dip?: number;
  /** Rise onto tiptoes by this many units. */
  tiptoe?: number;
  /** Put a hand exactly here (figure coordinates), whatever the pose says. */
  hands?: { left?: P; right?: P };
  /**
   * Draw only some pieces, so the two of us can overlap properly: in a hug one
   * of his arms goes behind her and the other round her, in front; in a
   * forehead kiss his head comes in front of hers while his body stays behind.
   */
  pieces?: Piece[];
}) {
  const uid = useId().replace(/:/g, '');
  const blink = useBlink(face !== 'happy' && face !== 'wink');
  const has = (p: Piece) => !pieces || pieces.includes(p);
  const body = has('body');
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
  const free = !hands?.left && !hands?.right;
  const holdsTeddy = free && acc.has('teddy') && (pose === 'idle' || pose === 'talk');
  const holdsCup =
    free && acc.has('stanley') && (pose === 'idle' || pose === 'talk' || pose === 'point');
  const sL: P = { x: -B.shoulder + 6, y: shY + 7 };
  const sR: P = { x: B.shoulder - 6, y: shY + 7 };
  const reach = (B.upper + B.fore) * 0.985;
  // Arms hang almost straight, just clear of the body.
  const rest = (side: -1 | 1): P => ({ x: side * (B.shoulder + 3), y: shY + 7 + reach });
  const t = toward;
  let targetL = rest(-1);
  let targetR = rest(1);
  switch (pose) {
    case 'wave':
      targetR = { x: B.shoulder + 30, y: shY - 62 };
      break;
    case 'peace':
      targetR = { x: B.headR * 1.3, y: cy - 2 };
      break;
    case 'heart':
      targetL = { x: -7, y: shY + 26 };
      targetR = { x: 7, y: shY + 26 };
      break;
    case 'selfie':
      targetR = { x: B.shoulder * 0.45, y: shY + 8 };
      break;
    case 'hug':
      // She's shorter: her arms go round his waist, below her own face.
      if (her) {
        targetL = { x: t * (B.shoulder + 26), y: shY + 52 };
        targetR = { x: t * (B.shoulder + 44), y: shY + 40 };
        if (t < 0)
          [targetL, targetR] = [
            { x: -(B.shoulder + 44), y: shY + 40 },
            { x: -(B.shoulder + 26), y: shY + 52 },
          ];
        break;
      }
      // He's taller: his arms go round her shoulders, under her face.
      targetL = { x: t * (B.shoulder + 24), y: shY + 70 };
      targetR = { x: t * (B.shoulder + 44), y: shY + 52 };
      if (t < 0)
        [targetL, targetR] = [
          { x: -(B.shoulder + 44), y: shY + 52 },
          { x: -(B.shoulder + 24), y: shY + 70 },
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
      // a relaxed hand gesturing in front, elbow by the side
      targetR = { x: B.shoulder * 0.7, y: shY + 62 };
      break;
    case 'shrug':
      targetL = { x: -(B.shoulder + 30), y: shY + 20 };
      targetR = { x: B.shoulder + 30, y: shY + 20 };
      break;
  }
  if (holdsTeddy) targetL = { x: -B.shoulder * 0.3, y: shY + 52 };
  // The cup hangs from an almost straight arm, held a little out from her side.
  if (holdsCup && pose === 'idle') targetR = { x: B.shoulder + 6, y: shY + 7 + reach * 0.95 };
  if (hands?.left) targetL = hands.left;
  if (hands?.right) targetR = hands.right;
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
    // Upper arm and forearm with a softly rounded elbow.
    const toward = (from: P, to: P, len: number) => {
      const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const k = Math.min(len, d / 2) / d;
      return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
    };
    const e1 = toward(a.elbow, s, 9);
    const e2 = toward(a.elbow, a.hand, 9);
    const path = `M${s.x} ${s.y}L${e1.x} ${e1.y}Q${a.elbow.x} ${a.elbow.y} ${e2.x} ${e2.y}L${a.hand.x} ${a.hand.y}`;
    const lerp = (p: P, q: P, t: number) => ({
      x: p.x + (q.x - p.x) * t,
      y: p.y + (q.y - p.y) * t,
    });
    const at = (t: number) =>
      t <= 0.5 ? lerp(s, a.elbow, t * 2) : lerp(a.elbow, a.hand, (t - 0.5) * 2);
    const w = B.arm;
    const ringHand = her && side === -1 && acc.has('ring');
    const wrist = at(0.9);
    const part = (share: number, color: string, width: number) => (
      <path
        d={path}
        pathLength={100}
        strokeDasharray={`${share} 200`}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
    );
    return (
      <g key={`arm${side}${front}`}>
        <path d={path} fill="none" stroke={INK} strokeWidth={w + 5} strokeLinecap="round" />
        <path d={path} fill="none" stroke={skin} strokeWidth={w} strokeLinecap="round" />
        {!her && !sleeve && (
          // a bit of definition on his arms
          <path
            d={`M${at(0.18).x - side * w * 0.22} ${at(0.18).y}Q${at(0.3).x - side * w * 0.42} ${at(0.3).y} ${at(0.44).x - side * w * 0.2} ${at(0.44).y}`}
            fill="none"
            stroke={shade}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.6"
          />
        )}
        {sleeve && part(86, sleeve, w + 3)}
        {shortSleeve && part(32, shortSleeve, w + 5)}
        {(acc.has('bracelet') && !her && side === 1) || (her && side === 1) ? (
          <circle
            cx={wrist.x}
            cy={wrist.y}
            r={w * 0.42}
            fill="none"
            stroke={her ? '#e2b65a' : '#c9cdd3'}
            strokeWidth="2"
          />
        ) : null}
        <circle cx={a.hand.x} cy={a.hand.y} r={w * 0.58} fill={skin} {...S} strokeWidth={2.2} />
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
      uid={uid}
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
          <ellipse
            cx={-B.headR * 0.84}
            cy={cy + 2}
            rx="6"
            ry="8"
            fill={skin}
            {...S}
            strokeWidth={2.2}
          />
          <ellipse
            cx={B.headR * 0.84}
            cy={cy + 2}
            rx="6"
            ry="8"
            fill={skin}
            {...S}
            strokeWidth={2.2}
          />
        </>
      )}
      <path d={headPath(B.headR, cy, her)} fill={skin} {...S} />
      <FaceFeatures who={who} cy={cy} r={B.headR} face={face} blink={blink} shade={shade} />
      {her ? (
        <HerFrontHair cy={cy} r={B.headR} wavy={look.hair === 'wavy'} uid={uid} />
      ) : // His slick back unless the curly top was picked (older saves say 'straight').
      look.hair !== 'curls' ? (
        <SlickBack cy={cy} r={B.headR} />
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
      <>
        <defs>
          {/* soft light from the left on every garment */}
          <linearGradient id={`cloth-${uid}`} x1="0" x2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="32%" stopColor="#fff" stopOpacity="0" />
            <stop offset="66%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.24" />
          </linearGradient>
          <linearGradient id={`hairshine-${uid}`} x1="0" x2="1">
            <stop offset="0%" stopColor={HAIR} />
            <stop offset="45%" stopColor={HAIR_LIGHT} />
            <stop offset="100%" stopColor={HAIR} />
          </linearGradient>
        </defs>
        {body && <ellipse cx="0" cy="2" rx={B.hip + 22} ry="7" fill="#000" opacity="0.13" />}
      </>
      <g style={{ transform: `translateY(${-tiptoe}px)`, transition: 'transform 0.45s ease' }}>
        {body && (
          <>
            <g style={{ transform: `translateY(${dip}px)`, transition: 'transform 0.45s ease' }}>
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
              {her && (
                <HerBackHair cy={cy} r={B.headR} shY={shY} wavy={look.hair === 'wavy'} uid={uid} />
              )}
            </g>
            <g
              style={{
                transformBox: 'view-box',
                transformOrigin: '0px 0px',
                transform: `scaleY(${(-hipY - dip) / -hipY})`,
                transition: 'transform 0.45s ease',
              }}
            >
              {legs}
            </g>
          </>
        )}
        <g style={{ transform: `translateY(${dip}px)`, transition: 'transform 0.45s ease' }}>
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
              className={pieces ? undefined : 'mini__breath'}
              style={{ transformBox: 'view-box', transformOrigin: `0px ${hipY}px` }}
            >
              {body && (
                <>
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
                    uid={uid}
                  />
                  {!her && !outfit.layer && (
                    // a hint of chest under his tee
                    <path
                      d={`M${-B.shoulder * 0.62} ${shY + 30}q${B.shoulder * 0.3} 8 ${B.shoulder * 0.56} 2M${B.shoulder * 0.62} ${shY + 30}q${-B.shoulder * 0.3} 8 ${-B.shoulder * 0.56} 2`}
                      fill="none"
                      stroke="#000"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      opacity="0.28"
                    />
                  )}
                  {acc.has('chain') && !her && (
                    <g>
                      <path
                        d={`M-12 ${shY + 1}q12 26 24 0`}
                        fill="none"
                        stroke="#d6dbe1"
                        strokeWidth="2"
                      />
                      <path
                        d={`M0 ${shY + 13}v9M-3 ${shY + 16}h6`}
                        stroke="#d6dbe1"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                  )}
                  {acc.has('necklace') && her && (
                    <path
                      d={`M-10 ${shY - 1}q10 18 20 0`}
                      fill="none"
                      stroke="#e2b65a"
                      strokeWidth="1.8"
                    />
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
                </>
              )}
              {has('head') && head}
              <>
                {has('armL') && holdsTeddy && <Teddy x={-B.shoulder - 6} y={shY + 30} />}
                {has('armL') && arm(armL, sL, -1, true)}
                {has('armR') && arm(armR, sR, 1, true)}
                {has('armR') && pose === 'peace' && peaceFingers(armR.hand)}
                {has('armL') && has('armR') && pose === 'heart' && (
                  <path
                    d={`M0 ${shY + 34}l-11 -11a6.5 6.5 0 0 1 11 -8a6.5 6.5 0 0 1 11 8z`}
                    fill="none"
                    stroke={skin}
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                )}
                {has('armR') && pose === 'selfie' && (
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
                {has('armR') && holdsCup && <Stanley x={armR.hand.x + 2} y={armR.hand.y} />}
                {has('armL') &&
                  free &&
                  acc.has('pink-bag') &&
                  her &&
                  pose !== 'heart' &&
                  pose !== 'hug' && <PinkBag x={armL.hand.x} y={armL.hand.y} />}
              </>
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------- the parts */

/** Face outline: his longer with a defined jaw, hers rounder and softer. */
function headPath(r: number, cy: number, her: boolean) {
  const top = cy - r;
  if (her) {
    // Hers: rounder and softer.
    const w = r * 0.9;
    const chin = cy + r * 0.98;
    const jaw = r * 0.5;
    return (
      `M0 ${top}C${w * 0.62} ${top} ${w} ${cy - r * 0.6} ${w} ${cy - r * 0.05}` +
      `C${w} ${cy + r * 0.45} ${jaw + 6} ${chin - 4} 0 ${chin}` +
      `C${-jaw - 6} ${chin - 4} ${-w} ${cy + r * 0.45} ${-w} ${cy - r * 0.05}` +
      `C${-w} ${cy - r * 0.6} ${-w * 0.62} ${top} 0 ${top}Z`
    );
  }
  // His: high cheekbones, a sharp jaw angle and a defined chin.
  const side = (d: 1 | -1) =>
    `Q${d * r * 0.88} ${cy + r * 0.3} ${d * r * 0.74} ${cy + r * 0.7}` +
    `Q${d * r * 0.6} ${cy + r * 0.98} ${d * r * 0.3} ${cy + r * 1.05}`;
  return (
    `M0 ${top}C${r * 0.52} ${top} ${r * 0.86} ${cy - r * 0.6} ${r * 0.86} ${cy - r * 0.15}` +
    side(1) +
    `Q0 ${cy + r * 1.12} ${-r * 0.3} ${cy + r * 1.05}` +
    `Q${-r * 0.6} ${cy + r * 0.98} ${-r * 0.74} ${cy + r * 0.7}` +
    `Q${-r * 0.88} ${cy + r * 0.3} ${-r * 0.86} ${cy - r * 0.15}` +
    `C${-r * 0.86} ${cy - r * 0.6} ${-r * 0.52} ${top} 0 ${top}Z`
  );
}

function FaceFeatures({
  who,
  cy,
  r,
  face,
  blink,
  shade,
}: {
  who: Person;
  cy: number;
  r: number;
  face: Face;
  blink: boolean;
  shade: string;
}) {
  const her = who === 'partner';
  const ex = r * (her ? 0.36 : 0.33);
  const ey = cy + r * 0.02;
  const closed = blink || face === 'happy';
  const lip = her ? '#7a3a43' : '#6a3a2c';

  const eye = (x: number, wink = false) => {
    const out = x > 0 ? 1 : -1;
    if (closed || wink) {
      return (
        <g>
          <path
            d={`M${x - 6} ${ey}q6 5 12 0`}
            fill="none"
            stroke={INK}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {her && (
            <path
              d={`M${x + out * 5} ${ey + 1}l${out * 3} 2M${x + out * 2} ${ey + 3}l${out * 1.5} 3`}
              stroke={INK}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
        </g>
      );
    }
    return her ? (
      <g>
        {/* almond eyes, lined, with lashes */}
        <path d={`M${x - 7} ${ey}q7 -8 14 0q-7 6 -14 0z`} fill="#fff" />
        <circle cx={x + out * 0.5} cy={ey - 0.5} r="4.4" fill="#3a2119" />
        <circle cx={x + out * 0.5} cy={ey - 0.5} r="2.4" fill="#120b0c" />
        <circle cx={x + out * 0.5 + 1.6} cy={ey - 2.4} r="1.4" fill="#fff" />
        <path
          d={`M${x - 7.5} ${ey + 0.5}q7.5 -9.5 15 -0.5l${out * 3} -2.5`}
          fill="none"
          stroke={INK}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${x + out * 5.5} ${ey - 3.5}l${out * 2.6} -1.6`}
          stroke={INK}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    ) : (
      <g>
        <path d={`M${x - 6} ${ey}q6 -6.5 12 0q-6 5 -12 0z`} fill="#fff" />
        <circle cx={x} cy={ey - 0.3} r="3.8" fill="#2a1914" />
        <circle cx={x} cy={ey - 0.3} r="2" fill="#0f0a0a" />
        <circle cx={x + 1.3} cy={ey - 1.8} r="1.1" fill="#fff" />
        <path
          d={`M${x - 6.5} ${ey + 0.3}q6.5 -8 13 0`}
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    );
  };

  const my = cy + r * (her ? 0.5 : 0.62);
  const happy = face === 'grin' || face === 'happy';
  const mouth =
    face === 'kiss' ? (
      <g>
        <ellipse cx="2" cy={my} rx="5" ry="4.4" fill={lip} {...S} strokeWidth={1.6} />
        <path d={`M-1 ${my}h6`} stroke="#3d1f22" strokeWidth="1.2" />
      </g>
    ) : happy ? (
      <g>
        <path
          d={`M-10 ${my - 2}q10 ${her ? 12 : 11} 20 0z`}
          fill="#fff"
          stroke={her ? lip : INK}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {her && <path d={`M-10 ${my - 2}q10 -3 20 0`} fill="none" stroke={lip} strokeWidth="3" />}
      </g>
    ) : face === 'talk' ? (
      <ellipse
        cx="0"
        cy={my}
        rx="5"
        ry="4.2"
        fill="#4a2326"
        stroke={her ? lip : INK}
        strokeWidth="1.8"
      />
    ) : her ? (
      // full lips with a cupid's bow and a little shine
      <g>
        <path
          d={`M-8 ${my}q3 -4.5 5.5 -3.5q2.5 1.2 2.5 1.2q0 0 2.5 -1.2q2.5 -1 5.5 3.5q-8 ${face === 'calm' ? 1.5 : 2.5} -16 0z`}
          fill={lip}
          stroke={INK}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d={`M-8 ${my}q8 ${face === 'calm' ? 7 : 9} 16 0q-8 ${face === 'calm' ? 1.5 : 2.5} -16 0z`}
          fill="#8e4650"
          stroke={INK}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </g>
    ) : (
      // his easy closed smile
      <path
        d={`M-8 ${my - 1}q8 ${face === 'calm' ? 3 : 6} 16 0`}
        fill="none"
        stroke={INK}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    );

  return (
    <g>
      {/* brows: hers arched and neat, his straight and thick */}
      {her ? (
        <path
          d={`M${-ex - 7} ${ey - 9}q5 -6 13 -3M${ex + 7} ${ey - 9}q-5 -6 -13 -3`}
          fill="none"
          stroke="#1b1413"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      ) : (
        <path
          d={`M${-ex - 8} ${ey - 8.5}l14 -2.5l0.6 2.2l-14.6 1.6zM${ex + 8} ${ey - 8.5}l-14 -2.5l-0.6 2.2l14.6 1.6z`}
          fill="#1b1413"
          stroke="#1b1413"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
      {eye(-ex)}
      {eye(ex, face === 'wink')}
      {/* nose */}
      {her ? (
        // a small, cute version of his
        <path
          d={`M-0.5 ${cy + r * 0.1}q0 ${r * 0.18} -2.5 ${r * 0.25}q3 2.4 6.5 -0.3`}
          fill="none"
          stroke="#5e3622"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d={`M-1.5 ${cy + r * 0.02}q0 ${r * 0.2} -3 ${r * 0.27}q4 3 9 -0.5`}
          fill="none"
          stroke={shade}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <ellipse
        cx={-r * 0.56}
        cy={cy + r * 0.3}
        rx="6"
        ry="4"
        fill="#e07f86"
        opacity={her ? 0.38 : 0.12}
      />
      <ellipse
        cx={r * 0.56}
        cy={cy + r * 0.3}
        rx="6"
        ry="4"
        fill="#e07f86"
        opacity={her ? 0.38 : 0.12}
      />
      {!her && (
        // cheekbones and jawline
        <path
          d={`M${-r * 0.7} ${cy + r * 0.2}q${r * 0.08} ${r * 0.2} ${r * 0.24} ${r * 0.3}M${r * 0.7} ${cy + r * 0.2}q${-r * 0.08} ${r * 0.2} ${-r * 0.24} ${r * 0.3}M${-r * 0.7} ${cy + r * 0.7}Q${-r * 0.56} ${cy + r * 0.94} ${-r * 0.3} ${cy + r * 0.98}M${r * 0.7} ${cy + r * 0.7}Q${r * 0.56} ${cy + r * 0.94} ${r * 0.3} ${cy + r * 0.98}`}
          fill="none"
          stroke={shade}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />
      )}
      {mouth}
      {!her && (
        <g fill="#1b1413">
          {/* thin moustache, and a small beard only on the chin, like in the photos */}
          {/* moustache: under the nose, above the lip */}
          <path
            d={`M-9.5 ${cy + r * 0.5}q9.5 -3.4 19 0q-2 1.4 -4 0.7q-5.5 -1.6 -11 0q-2 0.7 -4 -0.7z`}
          />
          <path
            d={`M-4 ${cy + r * 0.88}h8q2.6 ${r * 0.12} 1.2 ${r * 0.22}q-5.2 2.4 -10.4 0q-1.4 ${-r * 0.1} 1.2 ${-r * 0.22}z`}
          />
        </g>
      )}
    </g>
  );
}

/** Deterministic little wobble so the curls don't look stamped. */
const wob = (i: number) => Math.sin(i * 12.9898) * 0.5 + 0.5;

/**
 * His curly slick back: a sharp line-up across the forehead with crisp temple
 * corners, a front taper fading down to the ears, and the curls pushed back
 * with volume on top, a few spilling out at the back.
 */
function SlickBack({ cy, r }: { cy: number; r: number }) {
  const line = cy - r * 0.58; // hairline
  const temple = cy - r * 0.2; // where the taper starts
  const top = cy - r * 1.3;
  // Loose curly outline over the top, right to left.
  const bumps = 12;
  let crown = '';
  for (let i = 1; i <= bumps; i++) {
    const at = (t: number, k: number) => {
      const a = Math.PI * (2 - t / bumps);
      return {
        x: Math.cos(a) * r * 0.97 * k,
        y: cy - r * 0.5 + Math.sin(a) * (cy - r * 0.5 - top) * k,
      };
    };
    const p = at(i, 1 + wob(i) * 0.05);
    const c = at(i - 0.5, 1.1 + wob(i + 5) * 0.06);
    crown += `Q${c.x} ${c.y} ${p.x} ${p.y}`;
  }
  const edge =
    `M${-r * 0.8} ${temple}V${line + r * 0.08}L${-r * 0.62} ${line}` +
    `Q0 ${line - r * 0.08} ${r * 0.62} ${line}L${r * 0.8} ${line + r * 0.08}V${temple}`;
  const d = `${edge}L${r * 0.9} ${cy - r * 0.5}${crown}L${-r * 0.8} ${temple}Z`;
  // Loose curls, all swept back from the hairline.
  const curls = [
    { x: -0.5, y: 0.2 },
    { x: -0.16, y: 0.16 },
    { x: 0.18, y: 0.18 },
    { x: 0.5, y: 0.22 },
    { x: -0.34, y: 0.48 },
    { x: 0.02, y: 0.44 },
    { x: 0.36, y: 0.5 },
    { x: -0.62, y: 0.52 },
    { x: 0.66, y: 0.56 },
  ].map((c, i) => ({ x: c.x * r, y: line - r * c.y - 2, flip: i % 2 }));
  return (
    <g>
      {/* front taper: short at the temples, fading out above the ears */}
      <path
        d={`M${-r * 0.8} ${temple}L${-r * 0.84} ${cy + r * 0.12}L${-r * 0.74} ${cy + r * 0.1}L${-r * 0.7} ${temple}zM${r * 0.8} ${temple}L${r * 0.84} ${cy + r * 0.12}L${r * 0.74} ${cy + r * 0.1}L${r * 0.7} ${temple}z`}
        fill={HAIR}
        opacity="0.4"
      />
      {/* little curls peeking out behind the temples */}
      {([-1, 1] as const).map((dir) => (
        <path
          key={dir}
          d={`M${dir * r * 0.86} ${cy - r * 0.5}q${dir * 6} -1 ${dir * 5} 5q${dir * -1} 3 ${dir * -4} 1`}
          fill="none"
          stroke={HAIR}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      ))}
      <path d={d} fill={HAIR} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      {curls.map((c, i) => (
        <path
          key={i}
          d={
            c.flip
              ? `M${c.x - 4} ${c.y + 3}q-1 -6 4 -6q4 1 2 5q-2 2 -4 0`
              : `M${c.x + 4} ${c.y + 3}q1 -6 -4 -6q-4 1 -2 5q2 2 4 0`
          }
          fill="none"
          stroke={HAIR_LIGHT}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ))}
      {/* the line-up: a crisp edge along the hairline and temples */}
      <path d={edge} fill="none" stroke="#0e0a0a" strokeWidth="1.6" strokeLinejoin="miter" />
    </g>
  );
}

function HisHair({ cy, r }: { cy: number; r: number }) {
  // Loose curls on top with volume, falling forward a little; short taper on the sides.
  const n = 11;
  const crown: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (1.04 + (i / n) * 0.92);
    const lift = 1 + wob(i) * 0.12;
    crown.push({
      x: Math.cos(a) * r * 0.98 * lift,
      y: cy - r * 0.32 + Math.sin(a) * r * 0.98 * lift,
    });
  }
  let d = `M${-r * 0.82} ${cy - r * 0.18}`;
  crown.forEach((p, i) => {
    const prev = i ? crown[i - 1] : { x: -r * 0.82, y: cy - r * 0.18 };
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2;
    const out = Math.hypot(mx, my - cy) || 1;
    const bulge = 5 + wob(i + 3) * 4;
    d += `Q${mx + (mx / out) * bulge} ${my + ((my - cy) / out) * bulge} ${p.x} ${p.y}`;
  });
  // fringe: curls tumbling onto the forehead
  const fringe = [0.82, 0.55, 0.3, 0.06, -0.2, -0.46, -0.72];
  let x0 = r * 0.82;
  d += `L${x0} ${cy - r * 0.18}`;
  fringe.slice(1).forEach((f, i) => {
    const x = f * r;
    const dip = cy - r * 0.42 + (i % 2 ? 6 : 11) + wob(i) * 3;
    d += `Q${(x0 + x) / 2} ${dip} ${x} ${cy - r * 0.48}`;
    x0 = x;
  });
  d += `Q${-r * 0.8} ${cy - r * 0.36} ${-r * 0.82} ${cy - r * 0.18}Z`;

  const texture = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI * (1.12 + wob(i + 7) * 0.76);
    const rr = r * (0.35 + wob(i + 11) * 0.5);
    return { x: Math.cos(a) * rr, y: cy - r * 0.5 + Math.sin(a) * rr * 0.75, flip: i % 2 };
  });
  return (
    <g>
      {/* taper: short hair above the ears */}
      <path
        d={`M${-r * 0.86} ${cy - r * 0.3}Q${-r * 0.92} ${cy + r * 0.1} ${-r * 0.8} ${cy + r * 0.2}L${-r * 0.74} ${cy - r * 0.2}zM${r * 0.86} ${cy - r * 0.3}Q${r * 0.92} ${cy + r * 0.1} ${r * 0.8} ${cy + r * 0.2}L${r * 0.74} ${cy - r * 0.2}z`}
        fill={HAIR}
        opacity="0.55"
      />
      <path d={d} fill={HAIR} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      {texture.map((t, i) => (
        <path
          key={i}
          d={
            t.flip
              ? `M${t.x - 4} ${t.y + 2}q1 -6 5 -4q3 2 0 5`
              : `M${t.x + 4} ${t.y + 2}q-1 -6 -5 -4q-3 2 0 5`
          }
          fill="none"
          stroke={HAIR_LIGHT}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ))}
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
  // Just past the shoulders.
  const bottom = shY + 34;
  const w = r * 1.12;
  const d = wavy
    ? `M${-w} ${cy}C${-w} ${cy - r * 1.4} ${w} ${cy - r * 1.4} ${w} ${cy}Q${w + 12} ${cy + 26} ${w + 2} ${cy + 46}Q${w - 6} ${bottom - 10} ${w + 8} ${bottom}Q0 ${bottom + 12} ${-w - 8} ${bottom}Q${-w + 6} ${bottom - 10} ${-w - 2} ${cy + 46}Q${-w - 12} ${cy + 26} ${-w} ${cy}z`
    : `M${-w} ${cy}C${-w} ${cy - r * 1.4} ${w} ${cy - r * 1.4} ${w} ${cy}L${w + 5} ${bottom}Q0 ${bottom + 10} ${-w - 5} ${bottom}z`;
  return <path d={d} fill={`url(#hairshine-${uid})`} {...S} />;
}

function HerFrontHair({ cy, r, wavy, uid }: { cy: number; r: number; wavy: boolean; uid: string }) {
  // Middle part, curtains framing her face down to the shoulders.
  const top = cy - r * 1.04;
  const end = cy + r * 1.5;
  const side = (dir: 1 | -1) => {
    const outer = wavy
      ? `Q${dir * r * 1.28} ${cy + r * 0.4} ${dir * r * 1.08} ${cy + r * 0.85}Q${dir * r * 0.95} ${cy + r * 1.2} ${dir * r * 1.14} ${end}`
      : `L${dir * r * 1.1} ${end}`;
    return (
      `M0 ${top}C${dir * r * 0.55} ${top - 3} ${dir * r * 1.08} ${cy - r * 0.72} ${dir * r * 1.08} ${cy}` +
      outer +
      `L${dir * r * 0.82} ${end - 4}C${dir * r * 0.8} ${cy + r * 0.7} ${dir * r * 0.9} ${cy - r * 0.1} ${dir * r * 0.7} ${cy - r * 0.55}` +
      `C${dir * r * 0.5} ${cy - r * 0.86} ${dir * r * 0.18} ${top + 8} 0 ${top + 6}z`
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
        d={`M${-r * 0.55} ${cy - r * 0.66}q-7 18 -5 40M${r * 0.55} ${cy - r * 0.66}q7 18 5 40`}
        fill="none"
        stroke="#5a3b32"
        strokeWidth="1.6"
        opacity="0.75"
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
  uid,
}: {
  outfit: Outfit;
  torso: string;
  B: Build;
  shY: number;
  hipY: number;
  waistY: number;
  skin: string;
  uid: string;
}) {
  const { top, layer, bottom } = outfit;
  const isDress = bottom.kind === 'dress';
  const light = `url(#cloth-${uid})`;
  const cami = `M${-B.shoulder + 4} ${shY + 22}Q0 ${shY + 30} ${B.shoulder - 4} ${shY + 22}C${B.shoulder - 2} ${waistY - 8} ${B.waist} ${waistY - 4} ${B.waist} ${waistY}C${B.waist} ${waistY + 10} ${B.hip} ${hipY - 14} ${B.hip} ${hipY + 4}H${-B.hip}C${-B.hip} ${hipY - 14} ${-B.waist} ${waistY + 10} ${-B.waist} ${waistY}C${-B.waist} ${waistY - 4} ${-B.shoulder + 2} ${waistY - 8} ${-B.shoulder + 4} ${shY + 22}Z`;
  return (
    <g>
      {top.kind === 'cami' ? (
        <g>
          {/* neckline and straps: the top starts at the chest */}
          <path d={cami} fill={top.color} {...S} />
          <path d={cami} fill={light} />
          {/* a little drape across the waist */}
          <path
            d={`M${-B.waist + 4} ${waistY + 4}q${B.waist} 6 ${B.waist * 2 - 8} 0`}
            fill="none"
            stroke="#000"
            strokeWidth="1.4"
            opacity="0.22"
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
          <path d={torso} fill={light} />
          {/* hem stitching and a soft fold at the waist */}
          <path
            d={`M${-B.hip + 3} ${hipY - 2}H${B.hip - 3}`}
            stroke="#fff"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.3"
          />
          <path
            d={`M${-B.waist * 0.7} ${waistY - 6}q${B.waist * 0.4} 5 ${B.waist * 0.8} 1M${B.waist * 0.15} ${waistY + 8}q${B.waist * 0.3} 4 ${B.waist * 0.6} -1`}
            fill="none"
            stroke="#000"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.2"
          />
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
            <g>
              <path
                d={`M-12 ${shY - 1}l8 12l4 -8l4 8l8 -12`}
                fill={top.color}
                stroke={INK}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d={`M0 ${shY + 4}v18`} stroke="#000" strokeWidth="1.4" opacity="0.35" />
              <circle cx="0" cy={shY + 12} r="1.6" fill="#f4f1ec" />
              <circle cx="0" cy={shY + 19} r="1.6" fill="#f4f1ec" />
            </g>
          )}
        </g>
      )}
      {layer && <LayerArt layer={layer} B={B} shY={shY} hipY={hipY} uid={uid} />}
    </g>
  );
}

function LayerArt({
  layer,
  B,
  shY,
  hipY,
  uid,
}: {
  layer: NonNullable<Outfit['layer']>;
  B: Build;
  shY: number;
  hipY: number;
  uid: string;
}) {
  const light = `url(#cloth-${uid})`;
  const stitch = {
    fill: 'none',
    stroke: '#fff',
    strokeWidth: 1.2,
    strokeDasharray: '2.5 2.5',
    opacity: 0.45,
  };
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
        <g key={dir}>
          <path d={panel(dir)} fill={layer.color} {...S} />
          <path d={panel(dir)} fill={light} />
        </g>
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
        <g>
          {/* zip, drawstrings and pockets */}
          <path
            d={`M-12 ${shY + 8}V${hem}M12 ${shY + 8}V${hem}`}
            stroke="#8d8790"
            strokeWidth="1.6"
            strokeDasharray="2 2"
          />
          <rect x="9" y={shY + 30} width="5" height="9" rx="1.5" fill="#b9b4bc" />
          <path
            d={`M-8 ${shY + 4}q-2 12 0 24M8 ${shY + 4}q2 12 0 24`}
            fill="none"
            stroke={layer.hood ?? '#e9e5ef'}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d={`M${-hemW + 6} ${hem - 30}q${hemW * 0.4} -4 ${hemW - 20} 8M${hemW - 6} ${hem - 30}q${-hemW * 0.4} -4 ${-hemW + 20} 8`}
            fill="none"
            stroke="#000"
            strokeWidth="1.6"
            opacity="0.35"
          />
          <path
            d={`M${-hemW + 2} ${hem - 4}H-14M14 ${hem - 4}H${hemW - 2}`}
            stroke="#000"
            strokeWidth="1.4"
            opacity="0.3"
          />
        </g>
      )}
      {layer.kind === 'denim' && (
        <g>
          {/* yoke seams, chest pockets with flaps, buttons and orange-ish stitching */}
          <path
            d={`M${-w + 4} ${shY + 18}Q${-w * 0.55} ${shY + 22} -12 ${shY + 18}M12 ${shY + 18}Q${w * 0.55} ${shY + 22} ${w - 4} ${shY + 18}`}
            fill="none"
            stroke="#5f7d9f"
            strokeWidth="1.6"
          />
          {([-1, 1] as const).map((d) => (
            <g key={d}>
              <rect
                x={d > 0 ? 16 : -32}
                y={shY + 24}
                width="16"
                height="13"
                rx="2"
                fill="none"
                stroke="#5f7d9f"
                strokeWidth="1.4"
              />
              <path d={`M${d > 0 ? 16 : -32} ${shY + 28}h16`} stroke="#5f7d9f" strokeWidth="1.4" />
              <circle cx={d * 24} cy={shY + 31} r="1.4" fill="#c9a46a" />
              <path d={`M${d * 15} ${shY + 6}V${hem - 3}`} {...stitch} stroke="#e7b277" />
            </g>
          ))}
          <path
            d={`M${-hemW + 2} ${hem - 6}H-12M12 ${hem - 6}H${hemW - 2}`}
            stroke="#5f7d9f"
            strokeWidth="1.6"
          />
          <path d={`M-14 ${shY + 2}l-6 14M14 ${shY + 2}l6 14`} stroke={INK} strokeWidth="2" />
          {[0.45, 0.75].map((f) => (
            <circle
              key={f}
              cx="-15"
              cy={shY + (hem - shY) * f}
              r="1.8"
              fill="#c9a46a"
              stroke={INK}
              strokeWidth="0.8"
            />
          ))}
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
          <circle cx="-9" cy={hem - 30} r="2.4" fill="#2b2a2d" />
          <circle cx="-9" cy={hem - 16} r="2.4" fill="#2b2a2d" />
          {/* pocket flaps and a breast pocket */}
          <path
            d={`M${-hemW + 6} ${hem - 22}h16M${hemW - 22} ${hem - 22}h16M${w - 24} ${shY + 30}h13`}
            stroke={INK}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d={`M${w - 22} ${shY + 29}l3 -5l2 5`} fill="#f4f1ec" stroke={INK} strokeWidth="1" />
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
  uid,
}: {
  outfit: Outfit;
  H: number;
  hipY: number;
  kneeY: number;
  legX: number;
  hip: number;
  skin: string;
  her: boolean;
  uid: string;
}) {
  const light = `url(#cloth-${uid})`;
  const { bottom, shoes } = outfit;
  const ankle = -10;
  const leg = (
    dir: 1 | -1,
    topW: number,
    botW: number,
    from: number,
    to: number,
    color: string,
  ) => {
    const d = `M${dir * legX - topW} ${from}L${dir * legX + topW} ${from}L${dir * (legX + 2) + botW} ${to}Q${dir * (legX + 2)} ${to + 4} ${dir * (legX + 2) - botW} ${to}z`;
    return (
      <g key={`${dir}${color}${from}`}>
        <path d={d} fill={color} {...S} />
        <path d={d} fill={light} />
      </g>
    );
  };
  /** Soft creases where fabric folds (knees, ankles). */
  const crease = (key: string, d: string, opacity = 0.28) => (
    <path
      key={key}
      d={d}
      fill="none"
      stroke="#000"
      strokeWidth="1.4"
      strokeLinecap="round"
      opacity={opacity}
    />
  );
  const legs: React.ReactNode[] = [];
  const skinLeg = (from: number, color = skin, w = her ? 10 : 11, b = her ? 7 : 8) =>
    ([-1, 1] as const).forEach((d) => legs.push(leg(d, w, b, from, ankle, color)));

  if (bottom.kind === 'baggy') {
    ([-1, 1] as const).forEach((d) =>
      legs.push(leg(d, hip * 0.55, hip * 0.62, hipY, ankle + 2, bottom.color)),
    );
    // waistband, knee folds and the stack at the ankles
    legs.push(
      crease('wb', `M${-hip - 2} ${hipY + 7}H${hip + 2}`, 0.3),
      ...([-1, 1] as const).flatMap((d) => [
        crease(
          `k${d}`,
          `M${d * legX - 8} ${kneeY - 4}q6 5 14 1M${d * legX - 6} ${kneeY + 6}q5 3 11 0`,
        ),
        crease(`a${d}`, `M${d * (legX + 2) - 12} ${ankle - 14}q6 4 12 0q5 4 10 0`),
        crease(`p${d}`, `M${d * (hip - 4)} ${hipY + 8}q${-d * 6} 10 ${-d * 4} 18`, 0.22),
      ]),
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
    // a little sheen down the front of each leg
    ([-1, 1] as const).forEach((d) =>
      legs.push(
        <path
          key={`sh${d}`}
          d={`M${d * legX - 3} ${hipY + 16}L${d * (legX + 1) - 2} ${ankle - 14}`}
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.12"
        />,
      ),
    );
  } else if (bottom.kind === 'shorts') {
    skinLeg(kneeY);
    ([-1, 1] as const).forEach((d) =>
      legs.push(
        leg(d, hip * 0.58, hip * 0.6, hipY, kneeY + 10, bottom.color),
        crease(
          `h${d}`,
          `M${d * (legX + 2) - hip * 0.56} ${kneeY + 4}H${d * (legX + 2) + hip * 0.56}`,
          0.25,
        ),
      ),
    );
    legs.push(crease('wb', `M${-hip - 2} ${hipY + 7}H${hip + 2}`, 0.3));
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
      <path
        key="skirt-l"
        d={`M${-hip - 1} ${hipY - 2}H${hip + 1}L${hip + 8} ${kneeY + 6}H${-hip - 8}z`}
        fill={light}
      />,
      ...[-0.5, 0, 0.5].map((f) =>
        crease(`pl${f}`, `M${f * hip} ${hipY + 4}L${f * (hip + 8)} ${kneeY + 4}`, 0.3),
      ),
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
      <path
        key="dress-l"
        d={`M${-hip - 1} ${hipY - 6}H${hip + 1}C${hip + 3} ${hem - 30} ${hip - 2} ${hem - 10} ${hip - 4} ${hem}H${-hip + 4}C${-hip + 2} ${hem - 10} ${-hip - 3} ${hem - 30} ${-hip - 1} ${hipY - 6}z`}
        fill={light}
      />,
      // fabric falling in soft folds
      crease(
        'f1',
        `M${-hip * 0.35} ${hipY + 12}q-3 ${(hem - hipY) * 0.4} -1 ${hem - hipY - 16}`,
        0.22,
      ),
      crease(
        'f2',
        `M${hip * 0.4} ${hipY + 20}q3 ${(hem - hipY) * 0.35} 1 ${hem - hipY - 24}`,
        0.22,
      ),
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

  // Each shoe is drawn pointing right, then mirrored for the left foot.
  const shoe = () => {
    switch (shoes.kind) {
      case 'sneakers':
        return (
          <>
            <path
              d="M-13 -2Q-14 -14 -2 -14Q10 -14 18 -4Q20 2 6 2H-12Q-15 2 -13 -2z"
              fill={shoes.color}
              {...S}
            />
            <path
              d="M-13 -3H18Q20 2 6 2H-12Q-15 2 -13 -3z"
              fill="#f2efea"
              stroke={INK}
              strokeWidth="1.6"
            />
            <path d="M8 -12q6 2 8 7" fill="none" stroke="#000" strokeWidth="1.2" opacity="0.3" />
            <path
              d="M-6 -6q8 -5 16 -2"
              fill="none"
              stroke={shoes.laces}
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.8"
            />
            <path
              d="M-3 -12l5 4M1 -13l5 4"
              stroke={shoes.laces}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );
      case 'boots':
        return (
          <>
            <path d="M-11 2V-26H9V-10Q20 -8 20 2z" fill={shoes.color} {...S} />
            <path d="M-11 2V-26H-2V2z" fill="#000" opacity="0.08" />
            <path d="M-11 -24h20" stroke="#8e6435" strokeWidth="4" />
            <path d="M-11 0H20" stroke="#6d4c2a" strokeWidth="3" />
          </>
        );
      case 'fluffy':
        return (
          <>
            <ellipse cx="4" cy="-3" rx="15" ry="7" fill={skin} />
            <path
              d="M-12 -2q-2 -12 8 -12q4 -4 8 0q8 -2 9 6q4 6 -2 9H-10z"
              fill={shoes.color}
              {...S}
              strokeWidth={2}
            />
            <path
              d="M-8 -10l-3 -3M0 -14v-3M8 -11l3 -3"
              stroke={shoes.color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        );
      case 'slides':
        return (
          <>
            <path d="M-9 -2V-30H9V-2z" fill={shoes.socks} {...S} strokeWidth={2} />
            <path d="M-13 2Q-14 -10 0 -10Q18 -10 18 2z" fill={shoes.color} {...S} />
          </>
        );
    }
  };
  const foot = (dir: 1 | -1) => (
    <g key={`f${dir}`} transform={`translate(${dir * (legX + 2)} 0) scale(${dir} 1)`}>
      {shoe()}
    </g>
  );

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
