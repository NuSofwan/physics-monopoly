import type { GameState } from "@physics-monopoly/shared";

interface Props {
  state: GameState;
  myId: string;
  onClose: () => void;
}

export function TradeModal({ state, myId, onClose }: Props): JSX.Element {
  void state;
  void myId;
  void onClose;
  // Classroom ruleset deliberately has no property trade until a two-party,
  // server-authorized offer protocol is implemented.
  return <></>;
}
