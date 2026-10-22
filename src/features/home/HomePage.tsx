import { ArrowRight } from 'lucide-react';
import { useContent } from '../../data/store';
import { href } from '../../lib/router';
import { parseIsoDate } from '../../lib/dates';
import { useToday } from '../../hooks/useToday';
import { Starfield } from '../../components/art/Starfield';
import { SparkleIcon } from '../../components/art/shapes';
import { SiteFooter } from '../../components/common/SiteFooter';
import { HeroPlanet } from './HeroPlanet';
import { Counter } from './Counter';
import { Explore } from './Explore';
import './home.css';

export function HomePage() {
  const profile = useContent((c) => c.profile);

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-names">
        <Starfield count={56} seed="hero" className="hero__stars" />
        <div className="hero__cloud hero__cloud--a" aria-hidden="true" />
        <div className="hero__cloud hero__cloud--b" aria-hidden="true" />
        <div className="hero__inner">
          <div className="hero__text">
            <p className="hero__eyebrow">a little world that belongs to</p>
            <h1 id="hero-names" className="hero__names">
              <span className="hero__name">{profile.yourName}</span>
              <span className="hero__amp">&amp;</span>
              <span className="hero__name">{profile.partnerName}</span>
            </h1>
          </div>
          <HeroPlanet />
        </div>
      </section>

      <div className="home__body">
        <div className="home__lead">
          <Counter />
          <HomeNote />
        </div>
        <Explore />
        <TodayNote />
        <SiteFooter />
      </div>
    </div>
  );
}

function HomeNote() {
  const { homeGreeting, homeMessage, yourName } = useContent((c) => c.profile);
  if (!homeMessage.trim()) return null;
  return (
    <article className="home-note paper" aria-label="A note from the person who made this">
      <span className="tape" style={{ top: -12, left: '50%', marginLeft: -43, transform: 'rotate(-3deg)' }} aria-hidden="true" />
      {homeGreeting && <p className="home-note__greeting">{homeGreeting}</p>}
      {homeMessage.split(/\n{2,}/).map((paragraph, i) => (
        <p className="home-note__p" key={i}>
          {paragraph}
        </p>
      ))}
      <p className="home-note__sign">— {yourName}</p>
    </article>
  );
}

function TodayNote() {
  const reasons = useContent((c) => c.surprises.reasons);
  const today = useToday();
  if (reasons.length === 0) return null;
  const dayNumber = Math.floor((parseIsoDate(today)?.getTime() ?? 0) / 86_400_000);
  const reason = reasons[dayNumber % reasons.length];
  return (
    <aside className="today" aria-labelledby="today-title">
      <SparkleIcon size={26} className="today__spark" color="var(--gold-400)" />
      <h2 id="today-title" className="today__title hand">
        today I love…
      </h2>
      <p className="today__text">{reason}</p>
      <a className="today__link" href={href('/surprises')}>
        Open the jar of little reasons <ArrowRight aria-hidden="true" />
      </a>
    </aside>
  );
}
