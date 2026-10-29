import { AnimatePresence, motion } from 'framer-motion';

/** The tickets a round earned, sliding out of the machine (the same strip as skeeball's). */
export function TicketStrip({ tickets }: { tickets: number | null }) {
  return (
    <AnimatePresence>
      {tickets !== null && (
        <motion.div
          className="skee-tickets"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {Array.from({ length: Math.min(tickets, 12) }, (_, i) => (
            <motion.span
              key={i}
              className="skee-ticket"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
            >
              🎟️
            </motion.span>
          ))}
          <strong>{tickets} tickets!</strong>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
