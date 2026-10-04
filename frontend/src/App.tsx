import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import socketIOClient, { Socket } from 'socket.io-client';

import { API_URL, ChatMessage, Channel, MAX_LENGTH, ModerationState, ModerationVerdict, SOCKET_URL } from './types';
import { getNickname, setNickname } from './nickname';
import './App.scss';

type Tone = 'info' | 'warn' | 'error';

type Notice = { text: string; tone: Tone } | null;

const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const App: React.FC = () => {
  const socketRef = useRef<Socket | null>(null);

  const [nickname, setNick] = useState(getNickname);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [connected, setConnected] = useState(false);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState(0);

  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [state, setState] = useState<ModerationState>({
    muted: false,
    mutedUntil: null,
    strikes: 0,
    strikeLimit: 3,
    allowance: 5
  });
  const [showChannels, setShowChannels] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  const flash = useCallback((text: string, tone: Tone) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ text, tone });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
  }, []);

  useEffect(() => {
    const socket = socketIOClient(SOCKET_URL, {
      transports: ['websocket'],
      query: { nickname }
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('hello', (payload: { nickname: string; state: ModerationState }) => {
      setState(payload.state);
    });

    socket.on('channels', (list: Channel[]) => {
      setChannels(list);
      setCurrentId(previous => {
        if (previous && list.some(channel => channel._id === previous)) return previous;
        return list.length ? list[0]._id : null;
      });
    });

    socket.on('messages', (payload: { channelId: string; messages: ChatMessage[] }) => {
      if (payload.channelId !== currentIdRef.current) return;
      setMessages(payload.messages);
    });

    socket.on('message', (message: ChatMessage) => {
      setMessages(previous =>
        previous.some(entry => entry._id === message._id) ? previous : previous.concat(message)
      );
    });

    socket.on('presence', (payload: { channelId: string; online: number }) => {
      if (payload.channelId !== currentIdRef.current) return;
      setOnline(payload.online);
    });

    socket.on('moderation', (verdict: ModerationVerdict) => {
      setState(verdict.state);
      if (verdict.allowed) return;

      const text = verdict.message || 'That message was not sent.';
      const tone =
        verdict.reason === 'muted' || verdict.reason === 'flood'
          ? 'error'
          : verdict.reason === 'too_long'
          ? 'info'
          : 'warn';
      flash(text, tone);
    });

    socket.on('error:message', (payload: { message: string }) => flash(payload.message, 'error'));

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [nickname, flash]);

  useEffect(() => {
    if (currentId && socketRef.current) socketRef.current.emit('channel:join', currentId);
  }, [currentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const remaining = MAX_LENGTH - draft.length;
  const canSend = Boolean(currentId) && draft.trim().length > 0 && !state.muted && connected;

  const send = () => {
    const socket = socketRef.current;
    if (!socket || !currentId || !draft.trim()) return;

    socket.emit('message', { channelId: currentId, text: draft });
    setDraft('');
  };

  const openChannel = (id: string) => {
    setCurrentId(id);
    setMessages([]);
    setShowChannels(false);
  };

  const createChannel = async () => {
    if (newTitle.trim().length < 2) return;
    try {
      const response = await axios.post(`${API_URL}/api/channels`, {
        title: newTitle,
        description: 'Created from Chatter.'
      });
      setCreating(false);
      setNewTitle('');
      openChannel(response.data.channel._id);
    } catch (error) {
      flash('Could not create that channel.', 'error');
    }
  };

  const commitName = () => {
    const next = setNickname(draftName || nickname);
    setNick(next);
    setEditingName(false);
    setDraftName('');
  };

  const current = useMemo(
    () => channels.find(channel => channel._id === currentId) || null,
    [channels, currentId]
  );

  return (
    <div className="app">
      <aside className={showChannels ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <span className="brandMark">C</span>
          <span className="brandName">Chatter</span>
        </div>

        <button className="identity" onClick={() => setEditingName(previous => !previous)}>
          <span className="dot" data-connected={connected} />
          {editingName ? (
            <input
              autoFocus
              className="identityInput"
              value={draftName || nickname}
              maxLength={24}
              onChange={event => setDraftName(event.target.value)}
              onBlur={commitName}
              onKeyDown={event => {
                if (event.key === 'Enter') commitName();
                if (event.key === 'Escape') setEditingName(false);
              }}
            />
          ) : (
            <span className="identityName">{nickname}</span>
          )}
        </button>

        <div className="sidebarHead">
          <span>Channels</span>
          <button className="ghost" onClick={() => setCreating(true)} aria-label="New channel">
            +
          </button>
        </div>

        <nav className="channels">
          {channels.map(channel => (
            <button
              key={channel._id}
              className={channel._id === currentId ? 'channel active' : 'channel'}
              onClick={() => openChannel(channel._id)}
            >
              <span className="hash">#</span>
              <span className="channelTitle">{channel.title}</span>
              <span className="channelCount">{channel.members}</span>
            </button>
          ))}
          {!channels.length && <p className="empty">No channels yet.</p>}
        </nav>

        {state.muted && (
          <div className="sidebarFoot muted">
            You are muted{state.mutedUntil ? ' until ' + timeOf(state.mutedUntil) : ''}.
          </div>
        )}
        {!state.muted && state.strikes > 0 && (
          <div className="sidebarFoot warn">
            {state.strikes} of {state.strikeLimit} strikes. Next one mutes you.
          </div>
        )}
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="ghost onlyMobile" onClick={() => setShowChannels(previous => !previous)}>
            ☰
          </button>
          <div className="topbarTitle">
            <h1>{current ? '# ' + current.title : 'Chatter'}</h1>
            {current && <p>{current.description}</p>}
          </div>
          <div className="topbarMeta">
            <span className="pill">{online} online</span>
            {state.allowance <= 1 && !state.muted && <span className="pill warn">slow down</span>}
          </div>
        </header>

        {notice && <div className={'notice ' + notice.tone}>{notice.text}</div>}

        <div className="messages">
          {!messages.length && <p className="empty center">Say something.</p>}
          {messages.map(message => (
            <div className="message" key={message._id}>
              <span className="avatar" style={{ background: message.color }}>
                {message.nickname.slice(0, 1).toUpperCase()}
              </span>
              <div className="body">
                <div className="meta">
                  <span className="name" style={{ color: message.color }}>
                    {message.nickname}
                  </span>
                  <span className="time">{timeOf(message.at)}</span>
                </div>
                <p className="text">{message.text}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <textarea
            className={state.muted ? 'input muted' : 'input'}
            placeholder={state.muted ? 'You are muted.' : 'Message ' + (current ? '#' + current.title : 'Chatter')}
            value={draft}
            maxLength={MAX_LENGTH}
            rows={1}
            disabled={state.muted}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <span className={remaining < 30 ? 'counter low' : 'counter'}>{remaining}</span>
          <button className="send" disabled={!canSend} onClick={send}>
            Send
          </button>
        </div>
      </main>

      {creating && (
        <div className="overlay" onClick={() => setCreating(false)}>
          <div className="dialog" onClick={event => event.stopPropagation()}>
            <h2>New channel</h2>
            <input
              autoFocus
              value={newTitle}
              maxLength={40}
              placeholder="channel-name"
              onChange={event => setNewTitle(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && createChannel()}
            />
            <div className="dialogActions">
              <button className="ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="send" disabled={newTitle.trim().length < 2} onClick={createChannel}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;