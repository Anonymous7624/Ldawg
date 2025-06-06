const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const players = {};

function broadcast(data, exceptId) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.id !== exceptId) {
      client.send(msg);
    }
  });
}

wss.on('connection', ws => {
  ws.on('message', msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      return;
    }

    switch (data.type) {
      case 'join':
        ws.id = data.id;
        players[ws.id] = {
          nickname: data.nickname,
          color: data.color,
          position: data.position
        };
        Object.entries(players).forEach(([pid, p]) => {
          if (pid !== ws.id) {
            ws.send(JSON.stringify({
              type: 'join',
              id: pid,
              nickname: p.nickname,
              color: p.color,
              position: p.position
            }));
          }
        });
        broadcast(data, ws.id);
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now(), players: Object.keys(players).length }));
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp, players: Object.keys(players).length }));
        break;
      case 'update':
      case 'shoot':
      case 'kill':
      case 'chat':
        broadcast(data, data.id);
        break;
    }
  });

  ws.on('close', () => {
    if (ws.id && players[ws.id]) {
      delete players[ws.id];
      broadcast({ type: 'leave', id: ws.id });
    }
  });
});

app.use(express.static(path.join(__dirname)));

server.listen(8080, () => {
  console.log('Server listening on http://localhost:8080');
});
