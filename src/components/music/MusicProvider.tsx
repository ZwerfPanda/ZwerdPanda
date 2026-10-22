import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MusicBox } from '../../lib/audio/musicBox';
import { getMediaUrl } from '../../lib/media';
import { updatePrefs, usePrefs } from '../../data/store';
import { toast } from '../ui/feedback';

interface MusicApi {
  playing: boolean;
  /** Human label for what is (or would be) playing. */
  label: string;
  source: 'musicbox' | 'custom';
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
}

const MusicContext = createContext<MusicApi | null>(null);

export function useMusic(): MusicApi {
  const api = useContext(MusicContext);
  if (!api) throw new Error('useMusic must be used inside <MusicProvider>');
  return api;
}

/** Fired when our own soundtrack starts, so other players (Spotify) can pause. */
export const SOUNDTRACK_PLAY_EVENT = 'olu:soundtrack-play';

/**
 * The site's soundtrack. Nothing ever autoplays: sound only starts from a tap
 * on a play button, and it can always be paused from the mini player.
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const prefs = usePrefs();
  const [playing, setPlaying] = useState(false);
  const boxRef = useRef<MusicBox | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const useCustom = prefs.soundtrack === 'custom' && Boolean(prefs.customSoundtrackId);
  const source: MusicApi['source'] = useCustom ? 'custom' : 'musicbox';
  const label = useCustom ? (prefs.customSoundtrackName ?? 'Our song') : 'Our little music box';

  const stopAll = useCallback(() => {
    boxRef.current?.stop();
    audioRef.current?.pause();
  }, []);

  const pause = useCallback(() => {
    stopAll();
    setPlaying(false);
  }, [stopAll]);

  const play = useCallback(async () => {
    stopAll();
    window.dispatchEvent(new Event(SOUNDTRACK_PLAY_EVENT));
    try {
      if (source === 'custom' && prefs.customSoundtrackId) {
        const url = await getMediaUrl(prefs.customSoundtrackId);
        if (!url) {
          updatePrefs({ soundtrack: 'musicbox' });
          throw new Error(
            'Your uploaded song isn’t on this device any more — switched back to the music box.',
          );
        }
        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.loop = true;
          audioRef.current.addEventListener('pause', () => setPlaying(false));
          audioRef.current.addEventListener('play', () => setPlaying(true));
        }
        if (audioRef.current.src !== url) audioRef.current.src = url;
        audioRef.current.volume = prefs.volume;
        await audioRef.current.play();
      } else {
        boxRef.current ??= new MusicBox();
        boxRef.current.setVolume(prefs.volume);
        await boxRef.current.start();
      }
      setPlaying(true);
    } catch (error) {
      setPlaying(false);
      toast(
        error instanceof Error && error.message
          ? error.message
          : 'Sound couldn’t start in this browser.',
        {
          tone: 'error',
        },
      );
    }
  }, [prefs.customSoundtrackId, prefs.volume, source, stopAll]);

  const toggle = useCallback(() => {
    if (playing) pause();
    else void play();
  }, [pause, play, playing]);

  // Keep the volume in sync with the preference slider.
  useEffect(() => {
    boxRef.current?.setVolume(prefs.volume);
    if (audioRef.current) audioRef.current.volume = prefs.volume;
  }, [prefs.volume]);

  // Switching soundtrack source while playing stops the old one.
  useEffect(() => {
    if (!playing) return;
    pause();
    // Only react to the source changing, not to `playing` itself.
  }, [source, prefs.customSoundtrackId]);

  useEffect(() => () => stopAll(), [stopAll]);

  const api = useMemo(
    () => ({ playing, label, source, play, pause, toggle }),
    [playing, label, source, play, pause, toggle],
  );
  return <MusicContext.Provider value={api}>{children}</MusicContext.Provider>;
}
