import { GoldenHost, TicketRain } from './GoldenDay';
import { MedalHost } from './Medals';

/** Everything the arcade shows wherever you are: loaded just after the app opens. */
export default function ArcadeHosts() {
  return (
    <>
      <GoldenHost />
      <TicketRain />
      <MedalHost />
    </>
  );
}
