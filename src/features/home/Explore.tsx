import { ArrowRight } from 'lucide-react';
import { href } from '../../lib/router';
import { useContent } from '../../data/store';
import { plural } from '../../lib/dates';
import { MediaView } from '../../components/media/MediaView';
import { CocoFigure } from '../../components/art/SampleArt';
import { Starfield } from '../../components/art/Starfield';
import { HeartShape, INK, SparkleShape, StarShape } from '../../components/art/shapes';

/** The home page's index: every section as its own little keepsake. */
export function Explore() {
  const milestones = useContent((c) => c.milestones);
  const memories = useContent((c) => c.memories);
  const letters = useContent((c) => c.letters);
  const dreams = useContent((c) => c.dreams);
  const her = useContent((c) => c.her);
  const partnerName = useContent((c) => c.profile.partnerName);

  const unread = letters.filter((l) => l.status === 'shared' && !l.readAt).length;
  const somedays = dreams.filter((d) => d.someday).length;
  const plans = dreams.length - somedays;
  const stack = memories.slice(0, 3);

  return (
    <section className="explore" aria-labelledby="explore-title">
      <div className="explore__head">
        <p className="hand explore__eyebrow">come explore</p>
        <h2 id="explore-title" className="explore__title">
          Plekjes in <em>ons</em> universe
        </h2>
      </div>

      <div className="explore__grid">
        <a className="ex-world" href={href('/world')}>
          <Starfield count={34} seed="ex-world" />
          <svg
            className="ex-world__scene"
            viewBox="0 0 400 170"
            preserveAspectRatio="xMidYMax slice"
            aria-hidden="true"
          >
            <path d="M326 34a18 18 0 1 0 14 30 22 22 0 0 1-14-30z" fill="#f8e6bb" />
            <path d="M0 120c60-30 130-36 200-20s130 10 200-14v84H0z" fill="#6a3a63" />
            <path d="M0 140c80-22 150-24 230-10s120 6 170-6v56H0z" fill="#52294f" />
            <path
              d="M120 170c20-20 40-30 70-34s50-12 66-30"
              fill="none"
              stroke="#f6c5a6"
              strokeWidth="5"
              strokeDasharray="1 10"
              strokeLinecap="round"
            />
            <g transform="translate(262 92)">
              <rect
                x="-14"
                y="-16"
                width="28"
                height="18"
                fill="#fbf4ea"
                stroke={INK}
                strokeWidth="2"
              />
              <path
                d="M-19-14L0-30l19 16z"
                fill="#b9646f"
                stroke={INK}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="-4" y="-9" width="8" height="11" rx="4" fill="#f8e6bb" />
            </g>
            <g transform="translate(84 128)">
              <path d="M0 0v-12" stroke={INK} strokeWidth="2.5" />
              <circle cx="0" cy="-20" r="10" fill="#a7c191" stroke={INK} strokeWidth="2" />
            </g>
            <g transform="translate(176 140)">
              <rect
                x="-12"
                y="-14"
                width="24"
                height="16"
                rx="3"
                fill="#e4ddf5"
                stroke={INK}
                strokeWidth="2"
              />
              <rect x="-6" y="-9" width="12" height="6" fill="#f8e6bb" />
            </g>
          </svg>
          <div className="ex-world__text">
            <p className="hand ex-world__eyebrow">stap binnen</p>
            <h3 className="ex-world__title">Onze Kleine Wereld</h3>
            <p className="ex-world__blurb">
              Een klein kaartje van ons — de matcha-hoek, de arcade, de maanpost, Coco’s huisje en
              het huis waar we van dromen.
            </p>
            <span className="ex-world__cta">
              Bekijk de kaart <ArrowRight aria-hidden="true" />
            </span>
          </div>
        </a>

        <a className="ex-ticket" href={href('/story')}>
          <div className="ex-ticket__main">
            <p className="ex-ticket__kicker">Lijn ♡ · enkele reis, geen retour</p>
            <h3 className="ex-ticket__title">Ons Verhaal</h3>
            <dl className="ex-ticket__route">
              <div>
                <dt>van</dt>
                <dd>een livestream</dd>
              </div>
              <div>
                <dt>naar</dt>
                <dd>waar we ook heen gaan</dd>
              </div>
            </dl>
          </div>
          <div className="ex-ticket__stub">
            <span className="ex-ticket__count">{milestones.length}</span>
            <span className="ex-ticket__unit">
              {milestones.length === 1 ? 'chapter' : 'chapters'}
            </span>
          </div>
        </a>

        <a className="ex-memories" href={href('/memories')}>
          <div className="ex-memories__stack" aria-hidden="true">
            {stack.length === 0 ? (
              <div className="polaroid ex-memories__polaroid">
                <div className="polaroid__photo ex-memories__photo ex-memories__photo--empty" />
              </div>
            ) : (
              stack.map((m) => (
                <div className="polaroid ex-memories__polaroid" key={m.id}>
                  <div className="polaroid__photo ex-memories__photo">
                    <MediaView source={m.media} alt="" />
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="ex-memories__text">
            <h3 className="ex-label">Herinneringen</h3>
            <p className="ex-sub">
              {memories.length
                ? plural(memories.length, 'moment', 'momenten')
                : 'voeg de eerste toe'}
            </p>
          </div>
        </a>

        <a className="ex-letters" href={href('/letters')}>
          <svg className="ex-letters__env" viewBox="0 0 160 110" aria-hidden="true">
            <rect
              x="4"
              y="8"
              width="152"
              height="98"
              rx="6"
              fill="#f5dad6"
              stroke={INK}
              strokeWidth="2.5"
            />
            <path
              d="M4 14l76 52 76-52"
              fill="none"
              stroke={INK}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M4 104l58-44M156 104L98 60"
              fill="none"
              stroke={INK}
              strokeWidth="2"
              opacity="0.4"
            />
            <circle cx="80" cy="64" r="15" fill="#b9646f" stroke={INK} strokeWidth="2.5" />
            <HeartShape x={80} y={64} size={13} fill="#f5dad6" />
          </svg>
          <h3 className="ex-label">Open when…</h3>
          <p className="ex-sub">
            {unread ? `${plural(unread, 'brief', 'brieven')} wachten` : 'love letters'}
          </p>
        </a>

        <a className="ex-future" href={href('/future')}>
          <div className="ex-future__stamp" aria-hidden="true">
            <svg viewBox="0 0 40 46">
              <rect
                x="1"
                y="1"
                width="38"
                height="44"
                rx="2"
                fill="#fffcf6"
                stroke="#b9646f"
                strokeWidth="2"
                strokeDasharray="3 2"
              />
              <rect x="6" y="6" width="28" height="34" fill="#e4ddf5" />
              <path d="M10 34l8-12 6 8 4-5 6 9z" fill="#8e7cc3" />
              <circle cx="27" cy="14" r="3.5" fill="#f8e6bb" />
            </svg>
          </div>
          <p className="hand ex-future__note">wish you were here (you are)</p>
          <h3 className="ex-label">Onze Toekomst</h3>
          <p className="ex-sub">
            {plural(plans, 'plan', 'plannen')} · {plural(somedays, 'ooit-droom', 'ooit-dromen')}
          </p>
        </a>

        <a className="ex-gift" href={href('/surprises')}>
          <svg className="ex-gift__art" viewBox="0 0 90 90" aria-hidden="true">
            <rect
              x="14"
              y="38"
              width="62"
              height="44"
              rx="4"
              fill="#cbbfe9"
              stroke={INK}
              strokeWidth="2.5"
            />
            <rect
              x="10"
              y="26"
              width="70"
              height="16"
              rx="4"
              fill="#e4ddf5"
              stroke={INK}
              strokeWidth="2.5"
            />
            <path d="M45 26v56" stroke="#b9646f" strokeWidth="8" />
            <path
              d="M45 26c-6-14-26-16-22-4 3 7 22 4 22 4zM45 26c6-14 26-16 22-4-3 7-22 4-22 4z"
              fill="#d48d96"
              stroke={INK}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <SparkleShape x={80} y={14} size={12} fill="#e8bd6a" />
          </svg>
          <h3 className="ex-label">Little surprises</h3>
          <p className="ex-sub">expres verstopt</p>
        </a>

        <a className="ex-sticker ex-sticker--music" href={href('/music')}>
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="#2d172f" />
            <circle cx="40" cy="40" r="26" fill="none" stroke="#fff" strokeOpacity="0.12" />
            <circle cx="40" cy="40" r="19" fill="none" stroke="#fff" strokeOpacity="0.12" />
            <circle cx="40" cy="40" r="11" fill="#d48d96" />
            <circle cx="40" cy="40" r="2.5" fill="#2d172f" />
          </svg>
          <span>
            <h3 className="ex-label">Music corner</h3>
            <span className="ex-sub">onze liedjes</span>
          </span>
        </a>

        <a className="ex-sticker ex-sticker--coco" href={href('/coco')}>
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="#fbeeec" />
            <g transform="translate(40 48) scale(0.36)">
              <CocoFigure x={0} y={0} />
            </g>
            <StarShape x={66} y={16} size={10} fill="#e8bd6a" />
          </svg>
          <span>
            <h3 className="ex-label">Coco’s hoekje</h3>
            <span className="ex-sub">ons kleine konijntje</span>
          </span>
        </a>
        <a className="ex-sticker ex-sticker--us" href={href('/us')}>
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="#fde4ea" />
            <path d="M18 62q0-16 12-16t12 16z" fill="#f2c3d3" stroke={INK} strokeWidth="2" />
            <path d="M19 34q0-14 11-14t11 14v14h-22z" fill="#1b1413" />
            <circle cx="30" cy="35" r="9" fill="#8f5a3b" stroke={INK} strokeWidth="2" />
            <path d="M40 66q0-20 14-20t14 20z" fill="#1f1d22" stroke={INK} strokeWidth="2" />
            <circle cx="54" cy="30" r="10" fill="#a46d48" stroke={INK} strokeWidth="2" />
            <path d="M44 27q2-9 10-9t10 9q-4-3-10-3t-10 3z" fill="#1b1413" />
            <HeartShape x={42} y={14} size={9} fill="#e6889b" />
          </svg>
          <span>
            <h3 className="ex-label">Mini us</h3>
            <span className="ex-sub">wij tweetjes, maar dan mini</span>
          </span>
        </a>

        <a className="ex-sticker ex-sticker--lists" href={href('/lists')}>
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="#e7eef6" />
            <rect
              x="24"
              y="18"
              width="32"
              height="44"
              rx="4"
              fill="#fffcf6"
              stroke={INK}
              strokeWidth="2"
            />
            <path
              d="M30 30h20M30 40h20M30 50h12"
              stroke="#8f7a89"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <HeartShape x={56} y={56} size={10} fill="#e6889b" />
          </svg>
          <span>
            <h3 className="ex-label">Onze lijstjes</h3>
            <span className="ex-sub">babynamen & meer</span>
          </span>
        </a>

        <a className="ex-her" href={href('/her')}>
          <span className="ex-her__sticker" aria-hidden="true">
            {her.sticker}
          </span>
          <span>
            <h3 className="ex-label">{her.title || `${partnerName}’s Little World`}</h3>
            <span className="ex-sub">jouw eigen plekje — journal, bucket list & goals</span>
          </span>
        </a>
      </div>
    </section>
  );
}
