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
    <title>Glass Remote</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07080b; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; height: 100vh; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        
        #nav {
            position: fixed; top: 12px; display: flex; align-items: center; gap: 8px;
            background: rgba(18, 22, 34, 0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            padding: 6px 14px; border-radius: 30px; z-index: 100; font-size: 13px;
        }
        
        .badge { display: flex; align-items: center; gap: 6px; font-weight: 600; font-family: monospace; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #e02424; transition: 0.3s; }
        .dot.live { background: #10b981; box-shadow: 0 0 8px #10b981; }
        
        .sep { width: 1px; height: 18px; background: rgba(255, 255, 255, 0.15); margin: 0 4px; }
        
        button, select, input {
            background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
            color: #cbd5e1; padding: 4px 10px; border-radius: 14px; font-size: 12px; outline: none; cursor: pointer; transition: 0.2s;
        }
        button:hover, select:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }
        input { cursor: text; width: 140px; padding: 4px 8px; }
        input:focus { border-color: #3b82f6; width: 180px; }

        #container { position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
        canvas { max-width: 100vw; max-height: 100vh; object-fit: contain; cursor: crosshair; }
    </style>
</head>
<body tabindex="0">
    <div id="nav">
        <div class="badge"><div id="statusDot" class="dot"></div><span id="statusTxt">BAGLANIYOR</span></div>
        <div class="sep"></div>
        <span id="statFps" style="font-family: monospace; color: #38bdf8;">0 FPS</span>
        <div class="sep"></div>
        <select id="qualitySel" onchange="sendQuality()">
            <option value="720" selected>720p Balanced</option>
            <option value="1080">1080p Ultra</option>
            <option value="540">540p Fast</option>
        </select>
        <button onclick="sendCmd('WIN')">⊞ Win</button>
        <button onclick="sendCmd('TAB')">⇥ Alt+Tab</button>
        <input id="pasteInp" type="text" placeholder="Uzaga yapistir..." onkeydown="if(event.key==='Enter') sendPaste()">
        <button onclick="sendPaste()">Gönder</button>
        <button onclick="toggleFs()">⛶ Tam Ekran</button>
    </div>

    <div id="container">
        <canvas id="view" tabindex="1"></canvas>
    </div>

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

        let rendering = false;
        ws.onmessage = async (e) => {
            if (rendering || !(e.data instanceof Blob)) return;
            rendering = true;
            try {
                const bmp = await createImageBitmap(e.data);
                if (canvas.width !== bmp.width) canvas.width = bmp.width;
                if (canvas.height !== bmp.height) canvas.height = bmp.height;
                ctx.drawImage(bmp, 0, 0);
                bmp.close();
                frameCount++;
            } catch (err) {}
            rendering = false;
        };

        function send(cmd) {
            if (ws.readyState === WebSocket.OPEN) ws.send(cmd);
        }

        function sendCmd(name) { send(name); }
        function sendQuality() {
            const q = document.getElementById('qualitySel').value;
            send('Q:' + q);
        }

        function sendPaste() {
            const inp = document.getElementById('pasteInp');
            if (inp.value) {
                send('T:' + inp.value);
                inp.value = '';
            }
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

        let throttle = false;
        canvas.addEventListener('mousemove', (e) => {
            if (throttle) return;
            throttle = true;
            setTimeout(() => { throttle = false; }, 20);
            const p = pos(e);
            send('M:' + p.x.toFixed(4) + ':' + p.y.toFixed(4));
        });

        canvas.addEventListener('mousedown', (e) => send('D:' + e.button));
        canvas.addEventListener('mouseup', (e) => send('U:' + e.button));
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
