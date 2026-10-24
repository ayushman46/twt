/**
 * Builds the preview harness into the QA scratch dir and serves it with a
 * tiny static server (SPA fallback to index.html, no caching).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { EXT_ROOT, PREVIEW_DIST, VITE_CACHE } from './env.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

/** Production build of the preview harness (dashboard + popup with a fake extension API). */
export function buildPreview({ skip = false, outDir = PREVIEW_DIST, quiet = false } = {}) {
  if (skip && existsSync(join(outDir, 'index.html'))) {
    if (!quiet) console.log(`[qa] using existing preview build: ${outDir}`);
    return { outDir, ms: 0, skipped: true };
  }
  const t0 = Date.now();
  if (!quiet) console.log(`[qa] building preview harness → ${outDir}`);
  execSync(`npx vite build --config vite.preview.config.ts --outDir "${outDir}" --emptyOutDir --logLevel error`, {
    cwd: EXT_ROOT,
    stdio: quiet ? 'pipe' : 'inherit',
    env: { ...process.env, VITE_CACHE_DIR: VITE_CACHE },
  });
  return { outDir, ms: Date.now() - t0, skipped: false };
}

/** Serve `dir` on the first free port in [port, maxPort]. Resolves { url, port, close }. */
export async function serveStatic(dir, port, maxPort = port + 9) {
  const root = resolve(dir);
  const indexHtml = join(root, 'index.html');
  const handler = (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      // The preview harness has no favicon (the real dashboard ships /icon/32.png).
      if (p === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      const file = normalize(join(root, p));
      let target = file.startsWith(root) && existsSync(file) && statSync(file).isFile() ? file : null;
      if (!target) {
        // SPA fallback only for navigations; missing assets must 404 so the suite notices.
        if (!extname(p) || extname(p) === '.html') target = indexHtml;
        else {
          res.writeHead(404, { 'content-type': 'text/plain' });
          res.end('not found');
          return;
        }
      }
      res.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(readFileSync(target));
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  };
  for (let p = port; p <= maxPort; p++) {
    const server = createServer(handler);
    const ok = await new Promise((resolveListen) => {
      server.once('error', () => resolveListen(false));
      server.listen(p, '127.0.0.1', () => resolveListen(true));
    });
    if (ok) {
      server.keepAliveTimeout = 1000;
      return {
        port: p,
        url: `http://127.0.0.1:${p}/`,
        close: () => new Promise((r) => (server.closeAllConnections?.(), server.close(() => r()))),
      };
    }
  }
  throw new Error(`no free port in ${port}-${maxPort}`);
}
