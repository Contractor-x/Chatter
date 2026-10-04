/* ============================================================
   Chatter — app.js
   No framework. anime.js drives every animation.
   ============================================================ */

(function () {
  'use strict';

  var $ = function (id) {
    return document.getElementById(id);
  };

  var PALETTE = ['#5b8cff', '#e8607f', '#3fb98a', '#d99a2b', '#a06bf0', '#3fb2d9'];

  var state = {
    me: { nickname: 'SwiftOtter42', color: '#5b8cff' },
    groups: [],
    activeId: null,
    messages: {},
    rendered: {},
    typing: {},
    typingTimers: {}
  };

  /* ---------- helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clockOf(at) {
    return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function slug(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);
  }

  function save() {
    try {
      localStorage.setItem(
        'chatter.v1',
        JSON.stringify({ groups: state.groups, messages: state.messages })
      );
    } catch (err) {
      /* storage unavailable, run in memory only */
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem('chatter.v1');
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function active() {
    return state.groups.filter(function (g) {
      return g.id === state.activeId;
    })[0];
  }

  function banner(text, kind) {
    var node = $('banner');
    if (!text) {
      node.hidden = true;
      return;
    }
    node.textContent = text;
    node.className = 'banner ' + (kind || 'warn');
    node.hidden = false;
  }

  /* ---------- 1. ash + smoke ---------- */

  function buildAsh() {
    var host = $('ash');
    var motes = [];
    var wisps = [];
    var i;

    for (i = 0; i < 34; i++) {
      var mote = el('span', 'mote');
      var size = rand(2, 6);
      mote.style.width = size + 'px';
      mote.style.height = size + 'px';
      mote.style.left = rand(-2, 100) + '%';
      mote.style.top = rand(-30, 100) + '%';
      host.appendChild(mote);
      motes.push(mote);
    }

    for (i = 0; i < 7; i++) {
      var wisp = el('span', 'wisp');
      var box = rand(260, 620);
      wisp.style.width = box + 'px';
      wisp.style.height = box + 'px';
      wisp.style.left = rand(-15, 85) + '%';
      wisp.style.top = rand(-20, 80) + '%';
      host.appendChild(wisp);
      wisps.push(wisp);
    }

    anime({
      targets: motes,
      translateY: function () {
        return rand(60, 220);
      },
      translateX: function () {
        return rand(-70, 70);
      },
      rotate: function () {
        return rand(-180, 180);
      },
      opacity: [
        {
          to: function () {
            return rand(0.05, 0.22);
          },
          duration: function () {
            return rand(2200, 5200);
          },
          easing: 'easeInOutSine'
        },
        {
          to: function () {
            return rand(0.3, 0.75);
          },
          duration: function () {
            return rand(2200, 5200);
          },
          easing: 'easeInOutSine'
        }
      ],
      duration: function () {
        return rand(7000, 15000);
      },
      delay: anime.stagger(rand(0, 900)),
      loop: true,
      alternate: true,
      easing: 'easeInOutSine'
    });

    anime({
      targets: wisps,
      translateX: function () {
        return rand(-160, 160);
      },
      translateY: function () {
        return rand(-90, 90);
      },
      scale: function () {
        return rand(0.7, 1.5);
      },
      opacity: [
        { to: function () { return rand(0.06, 0.17); }, duration: function () { return rand(4000, 9000); }, easing: 'easeInQuad' },
        { to: 0, duration: function () { return rand(4000, 9000); }, easing: 'easeInQuad' }
      ],
      duration: function () {
        return rand(9000, 19000);
      },
      delay: anime.stagger(700),
      loop: true,
      easing: 'easeInOutQuad'
    });
  }

  /* ---------- 2. sidebar ---------- */

  function renderSidebar() {
    var host = $('groups');
    host.innerHTML = '';
    var items = [];

    state.groups.forEach(function (group) {
      var button = el('button', 'group' + (group.id === state.activeId ? ' is-active' : ''));
      button.type = 'button';
      button.setAttribute('data-id', group.id);

      button.appendChild(el('span', 'group-hash', '#'));
      button.appendChild(el('span', 'group-name', group.name));
      button.appendChild(el('span', 'group-count', String(group.people || 1)));

      button.addEventListener('click', function () {
        selectGroup(group.id);
      });

      host.appendChild(button);
      items.push(button);
    });

    anime({
      targets: items,
      opacity: [0, 1],
      translateX: [-16, 0],
      duration: 520,
      delay: anime.stagger(70),
      easing: 'easeOutQuad'
    });
  }

  function selectGroup(id) {
    state.activeId = id;
    state.rendered[id] = 0;
    renderSidebar();
    renderHeader();
    renderMessages();
    banner('');
  }

  function renderHeader() {
    var group = active();
    if (!group) return;
    $('chatTitle').textContent = group.name;
    $('chatDescription').textContent = group.description;
    $('pillOnline').textContent = (group.people || 1) + ' online';
  }

  /* ---------- 3. messages ---------- */

  function isGrouped(list, index) {
    if (index === 0) return false;
    var a = list[index];
    var b = list[index - 1];
    if (a.nickname !== b.nickname) return false;
    if (a.mine !== b.mine) return false;
    return a.at - b.at < 5 * 60 * 1000;
  }

  function renderMessages() {
    var host = $('messages');
    var list = state.messages[state.activeId] || [];
    var already = state.rendered[state.activeId] || 0;

    host.innerHTML = '';

    if (!list.length) {
      host.appendChild(el('p', 'empty', 'No messages yet. Say something.'));
      state.rendered[state.activeId] = 0;
      return;
    }

    var added = [];
    list.forEach(function (message, index) {
      var grouped = isGrouped(list, index);
      var mine = !!message.mine;

      var row = el('div', 'msg ' + (mine ? 'mine' : 'theirs') + (grouped ? ' grouped' : ''));

      if (!mine) {
        var avatar = el('span', 'avatar', grouped ? '' : message.nickname.slice(0, 1).toUpperCase());
        avatar.style.background = message.color || '#5b8cff';
        row.appendChild(avatar);
      }

      var stack = el('div', 'msg-stack');
      if (!mine && !grouped) {
        var sender = el('span', 'msg-sender', message.nickname);
        sender.style.color = message.color || '#5b8cff';
        stack.appendChild(sender);
      }

      var bubble = el('div', 'bubble', message.text);
      stack.appendChild(bubble);
      stack.appendChild(el('span', 'msg-time', clockOf(message.at)));

      row.appendChild(stack);
      host.appendChild(row);

      added.push({
        row: row,
        bubble: bubble,
        time: stack.querySelector('.msg-time'),
        mine: mine,
        isNew: index >= already
      });
    });

    state.rendered[state.activeId] = list.length;

    var last = added.length - 1;
    added.forEach(function (item, index) {
      var avatarNode = item.mine ? null : item.row.querySelector('.avatar');

      if (!item.isNew) {
        // Already seen once. Place it in its resting state without replaying.
        anime.set(item.bubble, { translateY: 0, scale: 1, opacity: 1 });
        anime.set(item.time, { opacity: 0.62, translateX: 0 });
        if (avatarNode) anime.set(avatarNode, { opacity: 1, scale: 1, rotate: 0 });
        return;
      }

      var delay = Math.max(0, index - last) * 60 + 30;

      anime({
        targets: item.bubble,
        translateY: [14, 0],
        scale: [0.86, 1],
        opacity: [0, 1],
        duration: 620,
        delay: delay,
        easing: 'spring(1, 90, 12, 0)'
      });

      anime({
        targets: item.time,
        opacity: [0, 0.62],
        translateX: item.mine ? [8, 0] : [-8, 0],
        duration: 520,
        delay: delay + 90,
        easing: 'easeOutQuad'
      });

      if (avatarNode) {
        anime.set(avatarNode, { opacity: 0, scale: 0.7 });
        anime({
          targets: avatarNode,
          opacity: [0, 1],
          scale: [0.7, 1],
          rotate: [-25, 0],
          duration: 560,
          delay: delay + 40,
          easing: 'easeOutBack'
        });
      }
    });

    host.scrollTop = host.scrollHeight;
  }

  /* ---------- 4. remote typing indicator ---------- */

  function showTyping(groupId, nickname, color) {
    // Base this on the DOM, not on state: re-rendering the list wipes the node
    // but must not leave state claiming it is still there.
    var existing = $('messages').querySelector('[data-typing="' + groupId + '"]');

    if (!existing) {
      var host = $('messages');

      var node = el('div', 'typing');
      node.setAttribute('data-typing', groupId);

      var row = el('div', 'typing-row');
      var halo = el('span', 'typing-halo');
      var bubble = el('span', 'typing-bubble');
      bubble.appendChild(el('span', 'typing-dot'));
      bubble.appendChild(el('span', 'typing-dot'));
      bubble.appendChild(el('span', 'typing-dot'));
      row.appendChild(halo);
      row.appendChild(bubble);

      node.appendChild(row);
      node.appendChild(el('span', 'typing-who', nickname + ' is typing'));

      var emptyNote = host.querySelector('.empty');
      host.insertBefore(node, emptyNote || null);

      var dots = bubble.querySelectorAll('.typing-dot');

      anime({
        targets: dots,
        translateY: [
          { to: -7, duration: 340, easing: 'easeOutQuad' },
          { to: 0, duration: 340, easing: 'easeInQuad' }
        ],
        scale: [
          { to: 1.3, duration: 340, easing: 'easeOutQuad' },
          { to: 1, duration: 340, easing: 'easeInQuad' }
        ],
        opacity: [
          { to: 1, duration: 340 },
          { to: 0.42, duration: 340 }
        ],
        duration: 1100,
        delay: anime.stagger(160),
        loop: true,
        easing: 'easeInOutQuad'
      });

      anime({
        targets: halo,
        opacity: [0.18, 0.5, 0.18],
        scaleX: [0.86, 1.08, 0.86],
        duration: 1600,
        loop: true,
        easing: 'easeInOutSine'
      });

      host.scrollTop = host.scrollHeight;
      anime({ targets: bubble, scale: [0.8, 1], opacity: [0, 1], duration: 420, easing: 'easeOutBack' });
    }

    state.typing[groupId] = nickname;

    clearTimeout(state.typingTimers[groupId]);
    state.typingTimers[groupId] = setTimeout(function () {
      hideTyping(groupId);
    }, 2600);
  }

  function hideTyping(groupId) {
    var node = $('messages').querySelector('[data-typing="' + groupId + '"]');
    if (node) {
      anime.remove(node.querySelectorAll('.typing-dot'));
      anime.remove(node.querySelector('.typing-halo'));
      anime({
        targets: node,
        opacity: [1, 0],
        translateY: [0, 8],
        duration: 260,
        easing: 'easeInQuad',
        complete: function () {
          node.remove();
        }
      });
    }
    delete state.typing[groupId];
    clearTimeout(state.typingTimers[groupId]);
  }

  /* ---------- 5. local typing animation ---------- */

  function buildSparks() {
    var host = $('sparks');
    var pips = [];
    for (var i = 0; i < 9; i++) {
      var pip = el('span', 'spark');
      var angle = (360 / 9) * i * (Math.PI / 180);
      pip.style.left = 'calc(50% + ' + Math.cos(angle) * 30 + 'px)';
      pip.style.top = 'calc(50% + ' + Math.sin(angle) * 30 + 'px)';
      host.appendChild(pip);
      pips.push(pip);
    }

    anime({
      targets: pips,
      opacity: [0.12, 0.34, 0.12],
      scale: [0.7, 1, 0.7],
      duration: 2400,
      delay: anime.stagger(90),
      loop: true,
      easing: 'easeInOutSine'
    });
  }

  function setLocalTyping(on) {
    var field = $('composerField');
    var ring = $('composerRing');
    var caret = $('composerCaret');

    field.classList.toggle('is-active', on);

    if (!on) {
      anime.set(ring, { opacity: 0, scale: 0.86 });
      anime.set(caret, { opacity: 0.25 });
      return;
    }

    anime({
      targets: ring,
      opacity: [0, 1],
      scale: [0.86, 1],
      duration: 420,
      easing: 'easeOutQuad'
    });

    if (!caret.__live) {
      caret.__live = anime({
        targets: caret,
        opacity: [0.25, 1, 0.25],
        duration: 1200,
        loop: true,
        easing: 'easeInOutQuad'
      });
    }
  }

  /* ---------- 6. send ---------- */

  function send() {
    var input = $('input');
    var text = input.value.trim();
    if (!text) return;

    var list = state.messages[state.activeId] || (state.messages[state.activeId] = []);
    list.push({
      nickname: state.me.nickname,
      color: state.me.color,
      text: text,
      at: Date.now(),
      mine: true
    });

    input.value = '';
    autoGrow();
    updateComposer();
    save();
    hideTyping(state.activeId);
    renderMessages();
    schedulePeers();
  }

  /* ---------- 7. simulated peers (stands in for a backend) ---------- */

  function peerCast(group) {
    var casts = {
      ANIME: ['Kuromi', 'SoraChan', 'Rin', 'Yato', 'Momo'],
      General: ['PixelWitch', 'Dev_Omar', 'Lune'],
      Random: ['j4ck', 'Nyxie', 'Tomato']
    };
    var generic = ['PixelWitch', 'Dev_Omar', 'Lune', 'j4ck', 'Nyxie', 'Tomato', 'Kuromi', 'Rin'];
    return casts[group.name] || generic;
  }

  function schedulePeers() {
    var group = active();
    if (!group) return;

    clearTimeout(group.__peerTimer);
    group.__peerTimer = setTimeout(function () {
      var cast = peerCast(group);
      var who = pick(cast);
      var list = state.messages[state.activeId] || (state.messages[state.activeId] = []);

      showTyping(state.activeId, who, pick(PALETTE));

      setTimeout(function () {
        hideTyping(state.activeId);
        list.push({
          nickname: who,
          color: pick(PALETTE),
          text: pick([
            'the last episode broke me',
            'no way that ending was legal',
            'who else is rewatching tonight?',
            'that soundtrack goes so hard',
            'i was not ready for that fight scene',
            'ok the art in this one is unreal',
            'imagine if they adapted this live action',
            'still thinking about it honestly'
          ]),
          at: Date.now(),
          mine: false
        });
        save();
        if (state.activeId === group.id) renderMessages();
        schedulePeers();
      }, rand(2200, 4200));
    }, rand(6000, 12000));
  }

  /* ---------- 8. add group ---------- */

  function openDialog() {
    var overlay = $('overlay');
    var input = $('groupName');
    overlay.hidden = false;
    input.value = '';
    $('createGroup').disabled = true;

    anime({
      targets: overlay.querySelector('.dialog'),
      scale: [0.9, 1],
      translateY: [14, 0],
      opacity: [0, 1],
      duration: 420,
      easing: 'easeOutBack'
    });

    input.focus();
  }

  function closeDialog() {
    $('overlay').hidden = true;
  }

  function createGroup() {
    var input = $('groupName');
    var name = slug(input.value);
    if (!name) return;

    var id = 'g' + Date.now().toString(36);
    state.groups.push({ id: id, name: name, description: 'Fresh group.', people: 1 });
    state.messages[id] = [];

    save();
    closeDialog();
    selectGroup(id);
  }

  /* ---------- 9. composer plumbing ---------- */

  function autoGrow() {
    var input = $('input');
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 132) + 'px';
  }

  function updateComposer() {
    var input = $('input');
    var remaining = 300 - input.value.length;

    $('count').textContent = String(remaining);
    $('count').className = 'composer-count' + (remaining <= 40 ? ' low' : '');
    $('send').disabled = input.value.trim().length === 0;
    setLocalTyping(input.value.trim().length > 0);
  }

  /* ---------- 10. seed + boot ---------- */

  function seed() {
    var now = Date.now();
    var stored = load();

    if (stored && stored.groups && stored.groups.length) {
      state.groups = stored.groups;
      state.messages = stored.messages || {};
      state.activeId = state.groups[0].id;
      return;
    }

    state.groups = [
      { id: 'anime', name: 'ANIME', description: 'Anime talk, nothing more.', people: 5 },
      { id: 'general', name: 'General', description: 'Anything goes.', people: 3 },
      { id: 'random', name: 'Random', description: 'Late night thoughts.', people: 3 }
    ];

    state.messages = {
      anime: [
        { nickname: 'SoraChan', color: '#e8607f', text: 'new season drops in an hour', at: now - 900000, mine: false },
        { nickname: 'Kuromi', color: '#3fb98a', text: 'i am not emotionally prepared', at: now - 840000, mine: false },
        { nickname: 'SwiftOtter42', color: '#5b8cff', text: 'same, that last arc destroyed me', at: now - 780000, mine: true },
        { nickname: 'Rin', color: '#d99a2b', text: 'the studio outdid themselves with the backgrounds', at: now - 420000, mine: false },
        { nickname: 'SoraChan', color: '#e8607f', text: 'watching together tonight?', at: now - 120000, mine: false }
      ],
      general: [
        { nickname: 'PixelWitch', color: '#a06bf0', text: 'anyone else rebuilding their setup', at: now - 1800000, mine: false },
        { nickname: 'SwiftOtter42', color: '#5b8cff', text: 'cleaning it this weekend', at: now - 1700000, mine: true }
      ],
      random: [
        { nickname: 'j4ck', color: '#3fb2d9', text: '3am and eating cereal again', at: now - 7200000, mine: false }
      ]
    };

    state.activeId = 'anime';
  }

  function boot() {
    seed();

    $('identityAvatar').textContent = state.me.nickname.slice(0, 1).toUpperCase();
    $('identityName').textContent = state.me.nickname;
    $('identityAvatar').style.background = state.me.color;
    $('identityDot').classList.add('online');

    buildAsh();
    buildSparks();
    renderSidebar();
    renderHeader();
    renderMessages();

    anime({
      targets: document.querySelector('.chat-header'),
      opacity: [0, 1],
      translateY: [-12, 0],
      duration: 560,
      easing: 'easeOutQuad'
    });

    anime({
      targets: document.querySelector('.sidebar'),
      opacity: [0, 1],
      translateX: [-18, 0],
      duration: 620,
      easing: 'easeOutQuad'
    });

    var input = $('input');
    input.addEventListener('input', function () {
      autoGrow();
      updateComposer();
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });

    $('send').addEventListener('click', send);
    $('addGroup').addEventListener('click', openDialog);
    $('cancelGroup').addEventListener('click', closeDialog);
    $('createGroup').addEventListener('click', createGroup);

    $('groupName').addEventListener('input', function () {
      $('createGroup').disabled = slug(this.value).length === 0;
    });

    $('groupName').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') createGroup();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !$('overlay').hidden) closeDialog();
    });

    updateComposer();
    schedulePeers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
