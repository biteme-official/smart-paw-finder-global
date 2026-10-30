import type { ServerResponse } from 'http';
import type { Connect } from 'vite';
import {
  SHEET_TTL_SECONDS, isDuplicate, isSheetId, validateSheet, type SheetMeta, type SheetRecipientRow, type StoredSheet,
} from '../api/shipping-sheets';

// Local dev stand-in for api/shipping-sheets.ts: sheets are kept in memory (lost on restart),
// so local tests never write recipients' data to the shared KV.
const sheets = new Map<string, StoredSheet>();

function readBody(req: Connect.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function checkAdminAuth(req: Connect.IncomingMessage): boolean {
  if (!process.env.B2B_ADMIN_PASSWORD) return false;
  return ((req.headers['x-admin-key'] as string) || '') === process.env.B2B_ADMIN_PASSWORD;
}

function liveSheets(): SheetMeta[] {
  const cutoff = Date.now() - SHEET_TTL_SECONDS * 1000;
  for (const [id, s] of sheets) if (Date.parse(s.meta.savedAt) < cutoff) sheets.delete(id);
  return [...sheets.values()].map((s) => s.meta).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function shippingSheetsProxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/api/shipping-sheets') return next();
    // Same as api/shipping-sheets.ts: B2B site only.
    if (process.env.SITE_MODE === 'b2c') return json(res, 404, { error: 'Not found' });
    if (!checkAdminAuth(req)) return json(res, 401, { error: 'Unauthorized' });
    const action = url.searchParams.get('action');
    const id = url.searchParams.get('id');
    try {
      if (action === 'list' && req.method === 'GET') return json(res, 200, { sheets: liveSheets() });
      if (action === 'recipients' && req.method === 'GET') {
        const rows: SheetRecipientRow[] = liveSheets().flatMap((m) =>
          (sheets.get(m.id)?.recipients ?? []).map((r) => ({ ...r, sheetId: m.id, shipDate: m.shipDate })));
        return json(res, 200, { recipients: rows });
      }
      if (action === 'file' && req.method === 'GET') {
        if (!isSheetId(id)) return json(res, 400, { error: 'Invalid id.' });
        const s = sheets.get(id);
        if (!s) return json(res, 404, { error: 'Sheet not found (deleted or expired).' });
        return json(res, 200, { fileName: s.meta.fileName, file: s.file });
      }
      if (action === 'save' && req.method === 'POST') {
        const checked = validateSheet(JSON.parse(await readBody(req)));
        if ('error' in checked) return json(res, 400, { error: checked.error });
        const duplicate = isDuplicate(checked.meta, liveSheets());
        sheets.set(checked.meta.id, checked);
        return json(res, 200, { sheet: checked.meta, duplicate });
      }
      if (action === 'delete' && req.method === 'POST') {
        if (!isSheetId(id)) return json(res, 400, { error: 'Invalid id.' });
        sheets.delete(id);
        return json(res, 200, { ok: true });
      }
      return json(res, 400, { error: 'Invalid action' });
    } catch (e) {
      console.error('[Shipping sheets proxy] Error:', e);
      return json(res, 500, { error: 'Internal server error' });
    }
  };
}
