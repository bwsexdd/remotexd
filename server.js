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
    <title>Remote Control</title>
    <style>
        body { margin: 0; background: #0e0e10; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; color: #fff; font-family: sans-serif; overflow: hidden; }
        #status { margin-bottom: 6px; font-size: 13px; opacity: 0.8; }
        canvas { max-width: 95vw; max-height: 90vh; border: 1px solid #444; background: #000; cursor: crosshair; }
    </style>
</head>
<body tabindex="0">
    <div id="status">Baglaniyor...</div>
    <canvas id="view" tabindex="1"></canvas>
    <script>
        const canvas = document.getElementById('view');
        const ctx = canvas.getContext('2d');
        const status = document.getElementById('status');
        const wsProto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws = new WebSocket(wsProto + location.host);

        ws.binaryType = 'blob';

        ws.onopen = () => { status.innerText = 'Baglandi · Kontrol Aktif'; };
        ws.onclose = () => { status.innerText = 'Baglanti Kesildi'; };

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

        function sendInput(msg) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        }

        function getCoords(e) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
        }

        let moveTimeout = null;
        canvas.addEventListener('mousemove', (e) => {
            if (moveTimeout) return;
            moveTimeout = setTimeout(() => { moveTimeout = null; }, 30);
            const { x, y } = getCoords(e);
            sendInput('M:' + x.toFixed(4) + ':' + y.toFixed(4));
        });

        canvas.addEventListener('mousedown', (e) => {
            const btn = e.button === 2 ? 2 : 1;
            sendInput('D:' + btn);
        });

        canvas.addEventListener('mouseup', (e) => {
            const btn = e.button === 2 ? 2 : 1;
            sendInput('U:' + btn);
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            sendInput('KD:' + e.keyCode);
        });

        window.addEventListener('keyup', (e) => {
            sendInput('KU:' + e.keyCode);
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
server.listen(PORT, () => console.log('Listening on ' + PORT));
