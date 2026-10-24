import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { useContent } from '../../data/store';
import { href } from '../../lib/router';
import { useWelcomeDue } from '../welcome/Welcome';
import { markNewsSeen, useNews } from './news';
import './news.css';

const fill = (text: string, his: string, her: string) =>
  text.split('{his}').join(his).split('{her}').join(her);

/** "Wat is er nieuw?": once after each update, and from the menu any time. */
export function NewsHost() {
  const { entries, browsing } = useNews();
  const profile = useContent((c) => c.profile);
  const welcomeDue = useWelcomeDue();
  // Let the app settle first, and never on top of the welcome moment.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 1800);
    return () => window.clearTimeout(timer);
  }, []);
  const open = browsing || (ready && !welcomeDue && entries.length > 0);

  return (
    <Dialog
      open={open}
      onClose={markNewsSeen}
      title="Wat is er nieuw?"
      eyebrow="new in our universe"
      size="md"
      footer={
        <button type="button" className="btn btn--primary" onClick={markNewsSeen}>
          Top, gezien ✨
        </button>
      }
    >
      <div className="news">
        {entries.map((entry) => (
          <section key={entry.id} className="news__entry" aria-labelledby={`news-${entry.id}`}>
            <p className="news__when">{entry.when}</p>
            <h3 id={`news-${entry.id}`} className="news__title">
              {entry.title}
            </h3>
            <ul className="news__list">
              {entry.items.map((item) => {
                const body = (
                  <>
                    <span className="news__emoji" aria-hidden="true">
                      {item.emoji}
                    </span>
                    <span className="news__text">
                      <strong>{item.title}</strong>
                      <span>{fill(item.text, profile.yourName, profile.partnerName)}</span>
                    </span>
                    {item.path && <ArrowRight className="news__go" aria-hidden="true" />}
                  </>
                );
                return (
                  <li key={item.title}>
                    {item.path ? (
                      <a className="news__item" href={href(item.path)} onClick={markNewsSeen}>
                        {body}
                      </a>
                    ) : (
                      <div className="news__item">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
