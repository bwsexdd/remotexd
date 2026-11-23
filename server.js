const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Stream Control</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #0b0c10; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; color: #66fcf1; font-family: monospace; overflow: hidden; user-select: none; }
        #bar { position: fixed; top: 8px; font-size: 12px; background: rgba(0,0,0,0.6); padding: 4px 12px; border-radius: 4px; border: 1px solid #1f2833; z-index: 10; }
        canvas { max-width: 100vw; max-height: 100vh; cursor: crosshair; object-fit: contain; }
    </style>
</head>
<body tabindex="0">
    <div id="bar">BAGLANIYOR...</div>
    <canvas id="view" tabindex="1"></canvas>
    <script>
        const canvas = document.getElementById('view');
        const ctx = canvas.getContext('2d');
        const bar = document.getElementById('bar');
        const wsProto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws = new WebSocket(wsProto + location.host);

        ws.binaryType = 'blob';

        ws.onopen = () => { bar.innerText = 'ONLINE · 720P · AKTIF'; bar.style.color = '#45f3ff'; };
        ws.onclose = () => { bar.innerText = 'BAGLANTI KESILDI'; bar.style.color = '#ff4d4d'; };

        ws.onmessage = async (e) => {
            if (e.data instanceof Blob) {
                const img = new Image();
                img.onload = () => {
                    if (canvas.width !== img.width) canvas.width = img.width;
                    if (canvas.height !== img.height) canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(img.src);
                };
                img.src = URL.createObjectURL(e.data);
            }
        };

        function send(cmd) {
            if (ws.readyState === WebSocket.OPEN) ws.send(cmd);
        }

        function pos(e) {
            const r = canvas.getBoundingClientRect();
            return {
                x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
            };
        }

        let throttle = false;
        canvas.addEventListener('mousemove', (e) => {
            if (throttle) return;
            throttle = true;
            setTimeout(() => { throttle = false; }, 25);
            const p = pos(e);
            send('M:' + p.x.toFixed(4) + ':' + p.y.toFixed(4));
        });

        canvas.addEventListener('mousedown', (e) => {
            send('D:' + e.button);
        });

        canvas.addEventListener('mouseup', (e) => {
            send('U:' + e.button);
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            send('W:' + (e.deltaY > 0 ? 1 : -1));
        }, { passive: false });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            send('KD:' + e.keyCode);
        });

        window.addEventListener('keyup', (e) => {
            send('KU:' + e.keyCode);
        });
    </script>
</body>
</html>`);
});

wss.on('connection', (ws) => {
    ws.on('message', (msg, isBinary) => {
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(msg, { binary: isBinary });
            }
        });
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log('Relay running on ' + PORT));
