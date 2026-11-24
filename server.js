const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instant Remote</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; color: #fff; font-family: -apple-system, monospace; height: 100vh; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; user-select: none; }
        
        #nav {
            position: fixed; top: 10px; display: flex; align-items: center; gap: 8px;
            background: rgba(10, 10, 10, 0.85); backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.12); padding: 4px 12px; border-radius: 20px; z-index: 100; font-size: 12px;
        }
        
        .badge { display: flex; align-items: center; gap: 6px; font-weight: bold; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #e02424; }
        .dot.live { background: #00ff88; box-shadow: 0 0 10px #00ff88; }
        .sep { width: 1px; height: 14px; background: rgba(255, 255, 255, 0.2); }
        
        button, select, input {
            background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.15);
            color: #fff; padding: 3px 8px; border-radius: 10px; font-size: 11px; outline: none; cursor: pointer;
        }
        button:hover { background: rgba(255, 255, 255, 0.25); }
        input { cursor: text; width: 120px; }

        canvas { max-width: 100vw; max-height: 100vh; object-fit: contain; cursor: crosshair; }
    </style>
</head>
<body tabindex="0">
    <div id="nav">
        <div class="badge"><div id="statusDot" class="dot"></div><span id="statusTxt">OFFLINE</span></div>
        <div class="sep"></div>
        <span id="statFps" style="color: #00ff88; font-weight: bold;">0 FPS</span>
        <div class="sep"></div>
        <select id="qualitySel" onchange="sendQuality()">
            <option value="720" selected>Performance 720p</option>
            <option value="1080">1080p Ultra</option>
            <option value="540">540p Lightning</option>
        </select>
        <button onclick="sendCmd('WIN')">Win</button>
        <button onclick="sendCmd('TAB')">Alt+Tab</button>
        <input id="pasteInp" type="text" placeholder="Yapistir..." onkeydown="if(event.key==='Enter') sendPaste()">
        <button onclick="sendPaste()">Gonder</button>
        <button onclick="toggleFs()">⛶</button>
    </div>

    <canvas id="view" tabindex="1"></canvas>

    <script>
        const canvas = document.getElementById('view');
        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        const dot = document.getElementById('statusDot');
        const txt = document.getElementById('statusTxt');
        const fpsTxt = document.getElementById('statFps');
        
        const wsProto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws = new WebSocket(wsProto + location.host);
        ws.binaryType = 'blob';

        let frameCount = 0;
        let lastTime = performance.now();
        setInterval(() => {
            const now = performance.now();
            const fps = Math.round((frameCount * 1000) / (now - lastTime));
            fpsTxt.innerText = fps + ' FPS';
            frameCount = 0;
            lastTime = now;
        }, 1000);

        ws.onopen = () => {
            dot.classList.add('live');
            txt.innerText = 'ONLINE';
            sendQuality();
        };

        ws.onclose = () => {
            dot.classList.remove('live');
            txt.innerText = 'OFFLINE';
        };

        let isDrawing = false;
        ws.onmessage = async (e) => {
            if (isDrawing || !(e.data instanceof Blob)) return;
            isDrawing = true;
            try {
                const bmp = await createImageBitmap(e.data);
                if (canvas.width !== bmp.width) canvas.width = bmp.width;
                if (canvas.height !== bmp.height) canvas.height = bmp.height;
                ctx.drawImage(bmp, 0, 0);
                bmp.close();
                frameCount++;
            } catch (err) {}
            isDrawing = false;
        };

        function send(cmd) { if (ws.readyState === WebSocket.OPEN) ws.send(cmd); }
        function sendCmd(name) { send(name); }
        function sendQuality() { send('Q:' + document.getElementById('qualitySel').value); }
        function sendPaste() {
            const inp = document.getElementById('pasteInp');
            if (inp.value) { send('T:' + inp.value); inp.value = ''; }
        }
        function toggleFs() {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
        }

        function pos(e) {
            const r = canvas.getBoundingClientRect();
            return {
                x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
            };
        }

        let isDown = false;
        let moveTimer = null;

        canvas.addEventListener('mousemove', (e) => {
            if (moveTimer) return;
            moveTimer = setTimeout(() => { moveTimer = null; }, 30);
            const p = pos(e);
            if (isDown) {
                send('D:' + p.x.toFixed(4) + ':' + p.y.toFixed(4) + ':' + e.button);
            } else {
                send('M:' + p.x.toFixed(4) + ':' + p.y.toFixed(4));
            }
        });

        canvas.addEventListener('mousedown', (e) => {
            isDown = true;
            const p = pos(e);
            send('C:' + p.x.toFixed(4) + ':' + p.y.toFixed(4) + ':' + e.button);
        });

        canvas.addEventListener('mouseup', (e) => {
            isDown = false;
            const p = pos(e);
            send('U:' + p.x.toFixed(4) + ':' + p.y.toFixed(4) + ':' + e.button);
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            send('W:' + (e.deltaY > 0 ? 1 : -1));
        }, { passive: false });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT') return;
            send('KD:' + e.keyCode);
        });
        window.addEventListener('keyup', (e) => {
            if (document.activeElement.tagName === 'INPUT') return;
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
