export type Tap = { cell: number; at: number; revision: string };
export function recognizeTap(previous: Tap | null, current: Tap) {
  const doubleTap = !!previous && previous.cell === current.cell
    && previous.revision === current.revision && current.at >= previous.at
    && current.at - previous.at <= 340;
  return { doubleTap, next: doubleTap ? null : current };
}
