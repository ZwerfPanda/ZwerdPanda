import { LogoMark } from '../components/art/LogoMark';

/** Shown for a moment while a page's code arrives. */
export function PageLoading() {
  return (
    <div className="page-loading" role="status">
      <LogoMark size={44} className="page-loading__mark" />
      <span className="visually-hidden">Loading…</span>
    </div>
  );
}
