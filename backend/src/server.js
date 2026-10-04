require('dotenv').config();

const http = require('http');
const cors = require('cors');
const express = require('express');

const store = require('./store');
const gate = require('./gate');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: true },
  pingTimeout: 20000
});

app.use(cors());
app.use(express.json({ limit: '8kb' }));

const resolveNickname = candidate => {
  const value = String(candidate || '').trim().replace(/\s+/g, ' ');
  if (value.length < 2 || value.length > 24) return store.nickname();
  return value;
};

app.get('/api/health', (req, res) => {
  res.json({ ok: true, channels: store.channels.size, uptime: Math.round(process.uptime()) });
});

app.get('/api/channels', (req, res) => {
  res.json({ channels: store.listChannels() });
});

app.post('/api/channels', (req, res) => {
  const created = store.createChannel(req.body.title, req.body.description);
  if (!created) return res.status(400).json({ error: true, message: 'Title must be 2-40 characters.' });
  io.emit('channels', store.listChannels());
  return res.json({ channel: created });
});

app.delete('/api/channels/:id', (req, res) => {
  const removed = store.deleteChannel(req.params.id);
  if (!removed) return res.status(404).json({ error: true, message: 'Channel not found.' });
  io.emit('channels', store.listChannels());
  return res.json({ deleted: true });
});

app.get('/api/channels/:id/messages', (req, res) => {
  const channel = store.getChannel(req.params.id);
  if (!channel) return res.status(404).json({ error: true, message: 'Channel not found.' });
  return res.json({
    messages: store.messagesFor(channel.id),
    members: channel.members,
    online: store.onlineCount(channel.id)
  });
});

app.use((error, req, res, next) => {
  console.log('[ERROR]', error);
  res.status(500).json({ error: true, message: 'Something broke on the server.' });
});

// Socket layer
io.on('connection', socket => {
  const identity = socket.id;
  const profile = { nickname: resolveNickname(socket.handshake.query.nickname), color: pickColor() };

  store.sockets.set(identity, { socketId: identity, nickname: profile.nickname, channelId: null });

  socket.emit('hello', { nickname: profile.nickname, color: profile.color, state: gate.stateOf(identity) });
  socket.emit('channels', store.listChannels());

  socket.on('nickname', requested => {
    profile.nickname = resolveNickname(requested);
    socket.emit('hello', { nickname: profile.nickname, color: profile.color, state: gate.stateOf(identity) });
    const record = store.sockets.get(identity);
    if (record) record.nickname = profile.nickname;
  });

  socket.on('channel:join', channelId => {
    const channel = store.getChannel(channelId);
    if (!channel) return socket.emit('error:message', { message: 'That channel does not exist.' });

    store.joinChannel(channel.id, profile.nickname);
    const record = store.sockets.get(identity);
    if (record) record.channelId = channel.id;

    socket.join(channel.id);
    socket.emit('messages', { channelId: channel.id, messages: store.messagesFor(channel.id) });
    socket.emit('presence', { channelId: channel.id, online: store.onlineCount(channel.id) });
    io.emit('channels', store.listChannels());
  });

  socket.on('message', payload => {
    const text = payload && payload.text;
    const channelId = payload && payload.channelId;
    const channel = store.getChannel(channelId);

    if (!channel) return socket.emit('error:message', { message: 'Join a channel first.' });

    const verdict = gate.check({ identity, text });
    socket.emit('moderation', {
      allowed: verdict.allowed,
      reason: verdict.reason || null,
      message: verdict.message || null,
      strikes: verdict.strikes,
      remaining: verdict.remaining,
      mutedUntil: verdict.mutedUntil || null,
      allowance: verdict.allowance,
      state: gate.stateOf(identity)
    });

    if (!verdict.allowed) return undefined;

    const record = store.addMessage(channel.id, {
      text: verdict.text,
      nickname: profile.nickname,
      color: profile.color
    });

    io.to(channel.id).emit('message', record);
    io.emit('channels', store.listChannels());
    return undefined;
  });

  socket.on('disconnect', () => {
    const record = store.sockets.get(identity);
    if (record && record.channelId) {
      store.leave(record.channelId, profile.nickname);
      io.to(record.channelId).emit('presence', {
        channelId: record.channelId,
        online: store.onlineCount(record.channelId)
      });
      io.emit('channels', store.listChannels());
    }
    store.sockets.delete(identity);
  });
});

const PALETTE = ['#5b8def', '#e0607e', '#3fae7f', '#d99a2b', '#8b6cd9', '#2fa4b8', '#d2694a', '#5a9e4f'];

function pickColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

const port = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(port, () => {
    console.log('Chatter backend on http://localhost:' + port);
  });
}

module.exports = { app, io, server, store, gate };