import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { updatePrefs, usePrefs } from '../../data/store';
import { useRoute } from '../../lib/router';
import { Dialog } from '../../components/ui/Dialog';
import { celebrate, toast } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { HutchArt } from './Props';
import { bringCocoAlong, pickHome } from './home';
import './companion.css';

/**
 * While Coco stays home, her hutch hides at the edge of one page (a different
 * one each time). Every few seconds her ears peek out of the door. Find it,
 * and she asks if she can come along again.
 */
export function HiddenHutch() {
  const { companion, cocoHome } = usePrefs();
  const { path } = useRoute();
  const reduce = useReducedMotion();
  const [peek, setPeek] = useState(0);
  const [found, setFound] = useState(false);

  // Sent home some other way (e.g. Settings): give her a hiding place.
  useEffect(() => {
    if (!companion && !cocoHome) updatePrefs({ cocoHome: pickHome(path) });
  }, [companion, cocoHome, path]);

  const here = !companion && cocoHome?.path === path;

  useEffect(() => {
    if (!here || reduce) return;
    let timer: number;
    const loop = () => {
      timer = window.setTimeout(
        () => {
          setPeek(0.5);
          timer = window.setTimeout(() => {
            setPeek(0);
            loop();
          }, 1400);
        },
        3000 + Math.random() * 3000,
      );
    };
    loop();
    return () => window.clearTimeout(timer);
  }, [here, reduce]);

  if (!here && !found) return null;

  return (
    <>
      {here && (
        <motion.button
          type="button"
          className={`hidden-hutch hidden-hutch--${cocoHome?.spot ?? 0}`}
          onClick={() => setFound(true)}
          aria-label="Coco’s hokje piept hier tevoorschijn"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <svg viewBox="-50 -40 100 90" aria-hidden="true">
            <HutchArt peek={reduce ? 0.5 : peek} />
          </svg>
        </motion.button>
      )}
      <Dialog
        open={found}
        onClose={() => setFound(false)}
        title="Je vond Coco’s hokje!"
        eyebrow="peekaboo"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                updatePrefs({ cocoHome: pickHome(path) });
                setFound(false);
                toast('Ze verstopt haar hokje een tijdje ergens anders.');
              }}
            >
              Nog even thuisblijven
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setFound(false);
                bringCocoAlong();
                celebrate();
              }}
            >
              Ga mee ♡
            </button>
          </>
        }
      >
        <div className="hutch-found">
          <svg viewBox="-50 -40 100 90" aria-hidden="true" className="hutch-found__art">
            <HutchArt open peek={1} />
          </svg>
          <p>
            Twee oortjes, een wiebelneusje… en dan steekt Coco haar kopje naar buiten. “Je hebt me
            gevonden! Mag ik weer met je mee?”
          </p>
        </div>
      </Dialog>
    </>
  );
}
