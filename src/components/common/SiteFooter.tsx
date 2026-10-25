import { useContent } from '../../data/store';
import { HiddenHeart } from './HiddenHeart';
import './common.css';

export function SiteFooter() {
  const signature = useContent((c) => c.profile.signature);
  return (
    <footer className="site-footer">
      <p className="site-footer__sig">{signature}</p>
      <p className="site-footer__small">
        Een privé wereldje voor twee <HiddenHeart />
      </p>
      <a className="site-footer__lock" href="#/secret" aria-label="Ons geheimpje">
        🔒
      </a>
    </footer>
  );
}
