# Chatter

Real-time group chat. No accounts, no signup, no database — open the page and you are in.

## Run it

Two terminals. `node_modules` are already installed.

```bash
# terminal 1 — backend on :5000
cd "/home/contractor/Koding/Chatter /backend"
npm start

# terminal 2 — frontend on :3000
cd "/home/contractor/Koding/Chatter /frontend"
npm start
```

Then open <http://localhost:3000>. Note the trailing space in the Chatter path.

The backend stores everything in memory. Restarting it clears the channels and messages.

### Tests

```bash
cd "/home/contractor/Koding/Chatter /backend" && npm test
```

25 assertions covering the profanity filter, the token bucket, the strike ladder and the
message gate. No database or server needed.

### Production build

```bash
cd "/home/contractor/Koding/Chatter /frontend" && npm run build   # -> frontend/build
```

## How it works

`frontend/.env` (copy from `.env.example`) points at the backend:

```
REACT_APP_SERVER_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

The browser opens a Socket.IO connection and is handed a random nickname (`SwiftOtter42`)
which it keeps in `localStorage`. Click your name to change it. There is nothing to log into.

### Backend layout

```
backend/src/
  server.js       Express routes + Socket.IO handlers
  store.js        in-memory channels, messages, presence
  gate.js         the one decision point for every outgoing message
  moderation.js   profanity filter with de-obfuscation
  rate-limit.js   token buckets, strike ladder, mutes
backend/test/moderation.test.js
```

### Frontend layout

```
frontend/src/
  App.tsx        the whole UI: sidebar, message list, composer
  App.scss
  nickname.ts    random nickname, persisted locally
  types.ts       shared shapes + endpoints
```

## Message flow

1. The composer emits `message` with `{ channelId, text }`.
2. `gate.check` runs, in order: empty check, length check, mute check, token bucket,
   flood detector, profanity filter.
3. If it passes, the message is stored and broadcast to everyone in the channel.
4. If it fails, only the sender gets a `moderation` event explaining why. Nothing is stored.

### Moderation rules

| Limit | Value |
| --- | --- |
| Message length | 300 characters |
| Burst | 5 messages |
| Refill | 4 messages per minute |
| Flood | 10 messages in 10 seconds |
| Strikes before a mute | 3, within 30 minutes |
| Mute length | 5 minutes |

The profanity filter normalises before matching, so `f u c k`, `f.u.c.k` and `sh1t` are all
caught, while `Scunthorpe`, `bass` and `class` are not.

Values live in `DEFAULTS` in `backend/src/rate-limit.js` and `WORDS` in
`backend/src/moderation.js`.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | liveness |
| `GET` | `/api/channels` | list channels |
| `POST` | `/api/channels` | create `{ title, description }` |
| `DELETE` | `/api/channels/:id` | delete a channel |
| `GET` | `/api/channels/:id/messages` | history + presence |

Socket events, server to client: `hello`, `channels`, `messages`, `message`, `presence`,
`moderation`, `error:message`. Client to server: `nickname`, `channel:join`, `message`.