const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5173;
const ROOT_DIR = __dirname;
const NO_OPEN = process.argv.includes('--no-open');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8'
};

// Live-reload SSE clients
const sseClients = new Set();
let debounceTimer = null;

try {
    fs.watch(ROOT_DIR, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        if (filename.includes('node_modules') || filename.startsWith('.git')) return;
        if (/\.(html|css|js)$/i.test(filename)) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                for (const client of sseClients) {
                    client.write(`data: reload\n\n`);
                }
            }, 120);
        }
    });
} catch (_) {
    // Fallback jika OS tidak mendukung recursive watch
}

const LIVE_RELOAD_SNIPPET = `
<script>
(function() {
    if (typeof EventSource !== 'undefined') {
        const es = new EventSource('/__disklab_livereload');
        es.onmessage = function(e) {
            if (e.data === 'reload') window.location.reload();
        };
        es.onerror = function() { es.close(); };
    }
})();
</script>
`;

function startServer(port) {
    const server = http.createServer((req, res) => {
        let safeUrl;
        try {
            safeUrl = decodeURIComponent(req.url.split('?')[0]);
        } catch (e) {
            safeUrl = req.url.split('?')[0];
        }

        // Endpoint SSE untuk Live Reload di VS Code
        if (safeUrl === '/__disklab_livereload') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });
            res.write('retry: 1000\n\n');
            sseClients.add(res);
            req.on('close', () => sseClients.delete(res));
            return;
        }

        let filePath = path.join(ROOT_DIR, safeUrl === '/' ? 'index.html' : safeUrl);

        if (!filePath.startsWith(ROOT_DIR)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('403 Forbidden');
            return;
        }

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                if (!path.extname(filePath)) {
                    filePath = path.join(filePath, 'index.html');
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`<!DOCTYPE html><html><body style="background:#070a12;color:#e2e8f0;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#38bdf8">404 — Berkas Tidak Ditemukan</h2><p><code>${safeUrl}</code></p><a href="/" style="color:#10b981">Kembali ke DiskLab</a></div></body></html>`);
                    return;
                }
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            fs.readFile(filePath, (readErr, content) => {
                if (readErr) {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('500 Internal Server Error');
                    return;
                }

                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Access-Control-Allow-Origin': '*'
                });

                if (ext === '.html') {
                    const htmlStr = content.toString('utf-8').replace('</body>', `${LIVE_RELOAD_SNIPPET}</body>`);
                    res.end(htmlStr, 'utf-8');
                } else {
                    res.end(content);
                }
            });
        });
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`  \x1b[33m!\x1b[0m Port ${port} sedang terpakai, mengalihkan ke port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });

    server.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log('');
        console.log('  \x1b[36m\x1b[1mDISKLAB STUDIO v2.0\x1b[0m  \x1b[90m(Live-Reload Aktif)\x1b[0m');
        console.log('  \x1b[90m──────────────────────────────────────────────\x1b[0m');
        console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mLocal URL:\x1b[0m   \x1b[36m${url}/\x1b[0m`);
        console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mMode:\x1b[0m        Development + Auto Refresh`);
        console.log('  \x1b[90mTekan Ctrl + C untuk menghentikan server\x1b[0m');
        console.log('');

        if (!NO_OPEN) {
            if (process.platform === 'win32') {
                exec(`start "" "${url}"`);
            } else if (process.platform === 'darwin') {
                exec(`open "${url}"`);
            } else {
                exec(`xdg-open "${url}"`);
            }
        }
    });
}

startServer(DEFAULT_PORT);
