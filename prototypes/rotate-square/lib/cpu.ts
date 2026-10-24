import { matches, rotate, type Color, type Game, type Player } from './game';

type KnownBoard = (Color | null)[];
const opponent = (p: Player): Player => p === 'red' ? 'blue' : 'red';

// Only the twelve tiles shown to the human are available to this simulation.
// Unknown refills stay null and cannot be used to predict further matches.
function forecast(board: KnownBoard, queue: Color[], row: number, col: number) {
  const b = rotate(board, row, col), q = queue.slice();
  const points = { red: 0, blue: 0 };
  for (let chain = 0; chain < 16; chain++) {
    const found = matches(b); if (!found.length) break;
    for (const i of found) if (b[i] === 'red' || b[i] === 'blue') points[b[i] as Player]++;
    for (const i of found) b[i] = q.shift() ?? null;
  }
  return { board: b, queue: q, points };
}

function potential(board: KnownBoard, player: Player) {
  let value = 0;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const a = r * 6 + c, cells = [board[a], board[a + 1], board[a + 6], board[a + 7]];
    if (cells.includes(null)) continue;
    const n = cells.filter(x => x === player).length;
    value += n === 3 ? 2 : n === 2 ? .3 : 0;
  }
  return value;
}

export function chooseCpuMove(game: Game, player: Player = 'blue') {
  const other = opponent(player), visible = game.queue.slice(0, 12);
  let best: { row: number; col: number; value: number } | null = null;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    const first = forecast(game.board, visible, row, col);
    let next = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const future = forecast(first.board, first.queue, r, c);
      next = Math.max(next, future.points[player] - future.points[other] * 1.1);
    }
    const repeat = game.last?.player === player && game.last.row === row && game.last.col === col;
    const value = first.points[player] * 10 - first.points[other] * 11 + next * 1.8
      + potential(first.board, player) * .3 - potential(first.board, other) * .25 - (repeat ? .6 : 0);
    if (!best || value > best.value) best = { row, col, value };
  }
  return best!;
}
