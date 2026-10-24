import { env } from 'cloudflare:workers';
import { newGame, beginGame, move, view, type Game, type Player } from '../../../../lib/game';
export const dynamic = 'force-dynamic';
type Row = { id: string; state: string; version: number; red_token: string; blue_token: string | null; created_at: number };
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function secret() { return [...crypto.getRandomValues(new Uint8Array(24))].map(x => x.toString(16).padStart(2, '0')).join(''); }
function seed() { return crypto.getRandomValues(new Uint32Array(1))[0] || 1; }
function output(row: Row, role: Player | null, now = Date.now()) {
  return { id: row.id, version: row.version, game: view(JSON.parse(row.state), now), joined: !!row.blue_token, role, serverNow: now };
}
async function getRow(id: string) {
  return env.DB!.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<Row>();
}
export async function GET(req: Request) {
  try {
    const url = new URL(req.url), id = url.pathname.split('/').filter(Boolean)[2];
    if (!id || !/^[A-Z2-9]{6}$/.test(id)) return response({ error: '部屋コードは6文字です' }, 400);
    const row = await getRow(id); if (!row || row.created_at < Date.now() - 86400000) return response({ error: '部屋が見つかりません。作り直してください' }, 404);
    const token = req.headers.get('x-player-token');
    const role = token === row.red_token ? 'red' : token && token === row.blue_token ? 'blue' : null;
    return response(output(row, role));
  } catch (e) { console.error('room read', e); return response({ error: '部屋を読み込めません。しばらくして再試行してください' }, 503); }
}
export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') && new URL(req.url).origin !== req.headers.get('origin')) return response({ error: '別のサイトからは操作できません' }, 403);
    const raw = await req.text(); if (raw.length > 2048) return response({ error: 'リクエストが大きすぎます' }, 413);
    let body; try { body = JSON.parse(raw); } catch { return response({ error: 'リクエストを確認してください' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return response({ error: 'リクエストを確認してください' }, 400);
    const id = new URL(req.url).pathname.split('/').filter(Boolean)[2];
    const now = Date.now();
    if (!id) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', red = secret();
      for (let attempt = 0; attempt < 4; attempt++) {
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        const code = [...bytes].map(n => alphabet[n % alphabet.length]).join('');
        const g = newGame(seed(), 'waiting');
        const result = await env.DB!.prepare('INSERT OR IGNORE INTO rooms (id,state,version,red_token,created_at) VALUES (?,?,0,?,?)').bind(code, JSON.stringify(g), red, now).run();
        if (result.meta.changes) {
          await env.DB!.prepare('DELETE FROM rooms WHERE created_at < ?').bind(now - 86400000).run();
          return response({ ...output((await getRow(code))!, 'red'), token: red }, 201);
        }
      }
      return response({ error: '部屋を作れませんでした。再試行してください' }, 503);
    }
    if (!/^[A-Z2-9]{6}$/.test(id)) return response({ error: '部屋コードを確認してください' }, 400);
    const row = await getRow(id); if (!row || row.created_at < now - 86400000) return response({ error: '部屋が見つかりません' }, 404);
    if (body.action === 'join') {
      if (row.blue_token) return response({ error: 'この部屋は満員です' }, 409);
      const token = secret();
      const result = await env.DB!.prepare('UPDATE rooms SET blue_token=?, version=version+1 WHERE id=? AND blue_token IS NULL AND version=?').bind(token, id, row.version).run();
      if (!result.meta.changes) return response({ error: '他の人が先に参加しました' }, 409);
      return response({ ...output((await getRow(id))!, 'blue'), token });
    }
    const token = req.headers.get('x-player-token');
    const role: Player | null = token === row.red_token ? 'red' : token && token === row.blue_token ? 'blue' : null;
    if (!role) return response({ error: '参加しているプレイヤーだけが操作できます' }, 403);
    if (body.version !== row.version) return response({ ...output(row, role), error: '盤面が更新されました。選び直してください' }, 409);
    let g: Game = view(JSON.parse(row.state), now);
    if (body.action === 'start') {
      if (role !== 'red' || !row.blue_token || g.phase !== 'waiting') return response({ error: '二人がそろってから赤の人が開始してください' }, 400);
      g = beginGame(g, now);
    } else if (body.action === 'move') {
      try { g = move(g, role, body.row, body.col, now); } catch (e) { return response({ error: (e as Error).message }, 400); }
    } else if (body.action === 'rematch') {
      if (g.phase !== 'finished') return response({ error: '対戦が終わってから再戦できます' }, 400);
      g.ready[role] = true;
      if (g.ready.red && g.ready.blue) g = beginGame(newGame(seed(), 'waiting', g.round + 1), now);
    } else return response({ error: '操作を確認してください' }, 400);
    const result = await env.DB!.prepare('UPDATE rooms SET state=?, version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(g), id, row.version).run();
    if (!result.meta.changes) return response({ ...output((await getRow(id))!, role), error: '相手が先に動かしました。選び直してください' }, 409);
    return response(output({ ...row, state: JSON.stringify(g), version: row.version + 1 }, role, now));
  } catch (e) { console.error('room write', e); return response({ error: '通信に失敗しました。もう一度お試しください' }, 503); }
}
