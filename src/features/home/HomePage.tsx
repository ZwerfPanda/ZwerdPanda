import { DailyQuestion, SendLove } from './Together';
import { useState } from 'react';
import { useContent } from '../../data/store';
import { Starfield } from '../../components/art/Starfield';
import { SiteFooter } from '../../components/common/SiteFooter';
import { HeroPlanet } from './HeroPlanet';
import { Counter } from './Counter';
import { Explore } from './Explore';
import { InstallBanner } from '../../pwa/InstallBanner';
import './home.css';
import { Countdowns } from './Countdowns';
import { DateMemories } from '../dates/DatePlanner';
import { WhatsNew } from './WhatsNew';
import { HuntChip } from '../hunt/HuntBoard';
import { DailyThing } from './DailyThing';
import { WrappedButton } from '../wrapped/Wrapped';
import { YearButton } from '../year/YearButton';
import { StudioNudge } from '../studio/StudioNudge';

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
        <WhatsNew />
        <StudioNudge />
        <div className="home__together">
          <SendLove />
          <DailyQuestion />
        </div>
        <div className="home__lead">
          <Counter />
          <HomeNote />
        </div>
        <div className="home__wrapped">
          <WrappedButton />
          <YearButton />
        </div>
        <Explore />
        <DateMemories />
        <Countdowns />
        <div className="home__hunt">
          <HuntChip />
        </div>
        <InstallBanner />
        <DailyThing />
        <SiteFooter />
      </div>
    </div>
  );
}

function HomeNote() {
  const { homeGreeting, homeMessage, yourName } = useContent((c) => c.profile);
  const [open, setOpen] = useState(false);
  if (!homeMessage.trim()) return null;
  const paragraphs = homeMessage.split(/\n{2,}/);
  const shown = open ? paragraphs : paragraphs.slice(0, 1);
  return (
    <article className="home-note paper" aria-label="Een briefje van degene die dit maakte">
      <span
        className="tape"
        style={{ top: -12, left: '50%', marginLeft: -43, transform: 'rotate(-3deg)' }}
        aria-hidden="true"
      />
      {homeGreeting && <p className="home-note__greeting">{homeGreeting}</p>}
      {shown.map((paragraph, i) => (
        <p className="home-note__p" key={i}>
          {paragraph}
        </p>
      ))}
      {paragraphs.length > 1 && (
        <button
          type="button"
          className="home-note__more"
          aria-expanded={open}
          data-sfx="paper"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Weer opvouwen' : 'Lees verder…'}
        </button>
      )}
      {(open || paragraphs.length === 1) && <p className="home-note__sign">— {yourName}</p>}
    </article>
  );
}
