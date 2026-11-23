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
    <title>Stream Viewer</title>
    <style>
        body { margin: 0; background: #0e0e10; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; color: #fff; font-family: sans-serif; }
        #status { margin-bottom: 8px; font-size: 14px; opacity: 0.8; }
        canvas { max-width: 95vw; max-height: 90vh; border: 1px solid #333; background: #000; }
    </style>
</head>
<body>
    <div id="status">Baglaniyor...</div>
    <canvas id="view"></canvas>
    <script>
        const canvas = document.getElementById('view');
        const ctx = canvas.getContext('2d');
        const status = document.getElementById('status');
        const wsProto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws = new WebSocket(wsProto + location.host);

        ws.binaryType = 'blob';

        ws.onopen = () => { status.innerText = 'Baglandi (Yayin Bekleniyor)'; };
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
