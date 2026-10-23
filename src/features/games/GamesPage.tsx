import { lazy, Suspense } from 'react';
import { useContent } from '../../data/store';
import { otherPerson, useMe } from '../../data/people';
import { href, useRoute } from '../../lib/router';
import { PageHeader } from '../../components/ui/Fields';
import { SiteFooter } from '../../components/common/SiteFooter';
import { PageLoading } from '../../app/PageLoading';
import './games.css';

const ConnectFour = lazy(() => import('./ConnectFour').then((m) => ({ default: m.ConnectFour })));
const Uno = lazy(() => import('./Uno').then((m) => ({ default: m.Uno })));
const Hangman = lazy(() => import('./Hangman').then((m) => ({ default: m.Hangman })));
const Bowling = lazy(() => import('./Bowling').then((m) => ({ default: m.Bowling })));
const Skeeball = lazy(() => import('./Skeeball').then((m) => ({ default: m.Skeeball })));

const GAMES = [
  {
    id: 'uno',
    emoji: '🃏',
    title: 'UNO',
    blurb: 'Samen, of tegen Coco',
    tint: '#ffd8a8',
    kind: 'uno',
  },
  {
    id: 'c4',
    emoji: '🔴',
    title: '4 op een rij',
    blurb: 'Wie heeft er eerst vier?',
    tint: '#c9e4f5',
    kind: 'c4',
  },
  {
    id: 'hangman',
    emoji: '🎈',
    title: 'Galgje',
    blurb: 'Red Coco’s ballonnen',
    tint: '#e4ddf5',
    kind: 'hangman',
  },
  { id: 'bowling', emoji: '🎳', title: 'Bowlen', blurb: 'Veeg voor een strike', tint: '#f9d0e0' },
  { id: 'skeeball', emoji: '🎯', title: 'Skeeball', blurb: 'Mik op de 100', tint: '#e0ebd4' },
] as const;

/** Our arcade: a few games for the two of us. */
export function GamesPage() {
  const { params } = useRoute();
  const game = params.get('g');
  if (game) {
    const Game =
      game === 'uno'
        ? Uno
        : game === 'c4'
          ? ConnectFour
          : game === 'hangman'
            ? Hangman
            : game === 'bowling'
              ? Bowling
              : game === 'skeeball'
                ? Skeeball
                : null;
    if (Game)
      return (
        <Suspense fallback={<PageLoading />}>
          <Game />
        </Suspense>
      );
  }
  return <Arcade />;
}

function Arcade() {
  const matches = useContent((c) => c.games.matches);
  const me = useMe();
  return (
    <div className="page arcade">
      <PageHeader
        eyebrow="de speelhal van ons"
        title={
          <>
            Spelletjes <em>voor twee</em>
          </>
        }
        lede="Speel samen, elk op je eigen telefoon (de zetten gaan via de sync), of samen op één telefoon. Bij bowlen en skeeball verbreek je elkaars record."
      />
      <ul className="arcade__grid">
        {GAMES.map((g) => {
          const live =
            'kind' in g
              ? matches
                  .filter((m) => m.kind === g.kind && !m.winner)
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
              : undefined;
          const yourTurn = live?.turn === me;
          return (
            <li key={g.id}>
              <a
                className="arcade__card"
                href={href('/games', { g: g.id })}
                style={{ '--tint': g.tint } as React.CSSProperties}
              >
                <span className="arcade__emoji" aria-hidden="true">
                  {g.emoji}
                </span>
                <span>
                  <strong>{g.title}</strong>
                  <small>{g.blurb}</small>
                </span>
                {live && (
                  <span className={`arcade__badge ${yourTurn ? 'is-yours' : ''}`}>
                    {yourTurn ? 'jouw beurt!' : live.turn === otherPerson(me) ? 'bezig' : ''}
                  </span>
                )}
              </a>
            </li>
          );
        })}
        <li>
          <a
            className="arcade__card"
            href={href('/quiz')}
            style={{ '--tint': '#fff3d6' } as React.CSSProperties}
          >
            <span className="arcade__emoji" aria-hidden="true">
              🧩
            </span>
            <span>
              <strong>Wie kent wie?</strong>
              <small>Hoe goed ken je de ander?</small>
            </span>
          </a>
        </li>
      </ul>
      <SiteFooter />
    </div>
  );
}
