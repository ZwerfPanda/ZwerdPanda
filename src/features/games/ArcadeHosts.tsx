import { GoldenHost, TicketRain } from './GoldenDay';
import { MedalHost } from './Medals';
import { ChatHost } from '../chat/ArcadeChat';

/** Everything the arcade shows wherever you are: loaded just after the app opens. */
export default function ArcadeHosts() {
  return (
    <>
      <GoldenHost />
      <TicketRain />
      <MedalHost />
      <ChatHost />
    </>
  );
}
