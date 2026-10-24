export type Color = 'red' | 'blue' | 'gray';
export type Player = 'red' | 'blue';
export type Game = {
  seed: number; rng: number; board: Color[]; queue: Color[];
  scores: Record<Player, number>; cooldown: Record<Player, number>;
  phase: 'practice' | 'waiting' | 'playing' | 'finished';
  startsAt: number; endsAt: number; round: number;
  ready: Record<Player, boolean>;
  history: { player: Player; row: number; col: number; at: number; red: number; blue: number; chains: number }[];
  last: null | { row: number; col: number; player: Player; at: number; red: number; blue: number; chains: number; cleared: number[] };
};
export const SIZE = 6;
export const COOLDOWN = 2000;
export const DURATION = 90000;
const colors: Color[] = ['red', 'blue', 'gray'];
function random(g: { rng: number }) {
  let x = g.rng >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  g.rng = x >>> 0; return g.rng / 4294967296;
}
function shuffle<T>(items: T[], g: { rng: number }) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(g) * (i + 1)); [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
export function rotate(board: Color[], row: number, col: number) {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row > 4 || col > 4) throw new Error('4枚の範囲を選んでください');
  const b = board.slice(), a = row * SIZE + col;
  b[a] = board[a + SIZE]; b[a + 1] = board[a]; b[a + SIZE + 1] = board[a + 1]; b[a + SIZE] = board[a + SIZE + 1];
  return b;
}
export function matches(board: Color[]) {
  const found = new Set<number>();
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const a = r * SIZE + c, v = board[a];
    if (v && v === board[a + 1] && v === board[a + SIZE] && v === board[a + SIZE + 1]) {
      [a, a + 1, a + SIZE, a + SIZE + 1].forEach(i => found.add(i));
    }
  }
  return [...found].sort((a, b) => a - b);
}
function fillQueue(g: Game) {
  while (g.queue.length < 48) g.queue.push(...shuffle(Array.from({ length: 12 }, (_, i) => colors[Math.floor(i / 4)]), g));
}
export function newGame(seed: number, phase: Game['phase'] = 'practice', round = 1): Game {
  const s = (seed >>> 0) || 1;
  const g: Game = { seed: s, rng: s, board: [], queue: [], scores: { red: 0, blue: 0 }, cooldown: { red: 0, blue: 0 }, phase, startsAt: 0, endsAt: 0, round, ready: { red: false, blue: false }, history: [], last: null };
  // Rotational colour symmetry gives both sides equivalent starting opportunities.
  for (let tries = 0; tries < 2000; tries++) {
    const pairs = shuffle(Array.from({ length: 18 }, (_, i) => i < 12), g);
    const b: Color[] = Array(36).fill('gray');
    for (let i = 0; i < 18; i++) if (pairs[i]) {
      b[i] = random(g) < .5 ? 'red' : 'blue'; b[35 - i] = b[i] === 'red' ? 'blue' : 'red';
    }
    if (matches(b).length) continue;
    let red = false, blue = false;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const x = rotate(b, r, c); const m = matches(x);
      red ||= m.some(i => x[i] === 'red'); blue ||= m.some(i => x[i] === 'blue');
    }
    if (red && blue) { g.board = b; break; }
  }
  if (!g.board.length) throw new Error('盤面を作成できませんでした');
  fillQueue(g); return g;
}
export function beginGame(game: Game, now: number): Game {
  const g = structuredClone(game); g.phase = 'playing'; g.startsAt = now + 3000; g.endsAt = g.startsAt + DURATION; return g;
}
export function move(game: Game, player: Player, row: number, col: number, now: number): Game {
  if (player !== 'red' && player !== 'blue') throw new Error('プレイヤーが不正です');
  if (game.phase !== 'practice' && game.phase !== 'playing') throw new Error('対戦が始まっていません');
  if (game.phase === 'playing' && (now < game.startsAt || now >= game.endsAt)) throw new Error('対戦時間外です');
  if (game.phase === 'playing' && now < game.cooldown[player]) throw new Error('次の操作まで少し待ってください');
  const g = structuredClone(game); g.board = rotate(g.board, row, col);
  let red = 0, blue = 0, chains = 0; const cleared = new Set<number>();
  for (;;) {
    const m = matches(g.board); if (!m.length) break;
    if (++chains > 128) throw new Error('連鎖の処理上限です。別の操作をお試しください');
    for (const i of m) { if (g.board[i] === 'red') red++; if (g.board[i] === 'blue') blue++; cleared.add(i); }
    fillQueue(g); for (const i of m) g.board[i] = g.queue.shift()!;
  }
  fillQueue(g); g.scores.red += red; g.scores.blue += blue;
  g.cooldown[player] = now + (g.phase === 'practice' ? 0 : COOLDOWN);
  g.last = { row, col, player, at: now, red, blue, chains, cleared: [...cleared] };
  g.history.push({ player, row, col, at: now, red, blue, chains });
  return g;
}
export function replay(game: Game, count: number): Game {
  let g = newGame(game.seed);
  for (const m of game.history.slice(0, count)) g = move(g, m.player, m.row, m.col, m.at);
  return g;
}
export function view(game: Game, now: number): Game {
  const g = structuredClone(game);
  if (g.phase === 'playing' && now >= g.endsAt) g.phase = 'finished';
  return g;
}
