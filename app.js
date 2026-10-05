/* ============================================================
   Chatter — app.js
   No framework. anime.js drives every animation.
   ============================================================ */

(function () {
  'use strict';

  var $ = function (id) {
    return document.getElementById(id);
  };

  var KEY = 'chatter.v2';
  var LIMIT = 600;

  /* Author identity colours. Muted, and all legible on near-black. The only
     saturated colour in the product is who is speaking. */
  var HUES = ['#c98b74', '#8fae94', '#93a2c9', '#c9ab80', '#ab8fb8', '#79b2b6', '#c1929b'];

  var state = {
    me: { name: 'SwiftOtter42', hue: HUES[2] },
    groups: [],
    activeId: null,
    messages: {},
    rendered: {},
    replyTo: null,
    seq: 0,
    typing: false
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

  function hueFor(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return HUES[sum % HUES.length];
  }

  function initials(name) {
    return name.trim().slice(0, 1).toUpperCase() || '?';
  }

  function clockOf(at) {
    return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function dayKey(at) {
    var d = new Date(at);
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  function dayLabel(at) {
    var d = new Date(at);
    var today = new Date();
    var yesterday = new Date(today.getTime() - 86400000);
    if (dayKey(at) === dayKey(today.getTime())) return 'Today';
    if (dayKey(at) === dayKey(yesterday.getTime())) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function slug(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
  }

  function save() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ me: state.me, groups: state.groups, messages: state.messages })
      );
    } catch (err) {
      /* private mode or full, run in memory */
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function active() {
    for (var i = 0; i < state.groups.length; i++) {
      if (state.groups[i].id === state.activeId) return state.groups[i];
    }
    return null;
  }

  function list() {
    return state.messages[state.activeId] || [];
  }

  var toastTimer;

  function toast(text) {
    var node = $('toast');
    node.textContent = text;
    node.hidden = false;
    anime({ targets: node, opacity: [0, 1], translateY: [10, 0], duration: 320, easing: 'easeOutQuad' });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      anime({
        targets: node,
        opacity: [1, 0],
        duration: 260,
        easing: 'easeInQuad',
        complete: function () {
          node.hidden = true;
        }
      });
    }, 2400);
  }

  /* ---------- ash ---------- */

  function buildAsh() {
    var host = $('ash');
    var motes = [];
    var wisps = [];
    var i;

    for (i = 0; i < 26; i++) {
      var mote = el('span', 'mote');
      var size = rand(1.6, 4.6);
      mote.style.width = size + 'px';
      mote.style.height = size + 'px';
      mote.style.left = rand(-2, 100) + '%';
      mote.style.top = rand(-25, 100) + '%';
      host.appendChild(mote);
      motes.push(mote);
    }

    for (i = 0; i < 6; i++) {
      var wisp = el('span', 'wisp');
      var box = rand(320, 680);
      wisp.style.width = box + 'px';
      wisp.style.height = box + 'px';
      wisp.style.left = rand(-15, 85) + '%';
      wisp.style.top = rand(-20, 85) + '%';
      host.appendChild(wisp);
      wisps.push(wisp);
    }

    /* Ambient motion is deliberately slow and low contrast. It should read
       as depth behind the text, never as an effect competing with it. */
    anime({
      targets: motes,
      translateY: function () {
        return rand(50, 180);
      },
      translateX: function () {
        return rand(-50, 50);
      },
      rotate: function () {
        return rand(-140, 140);
      },
      opacity: [
        {
          to: function () {
            return rand(0.03, 0.13);
          },
          duration: function () {
            return rand(3200, 7000);
          },
          easing: 'easeInOutSine'
        },
        {
          to: function () {
            return rand(0.16, 0.42);
          },
          duration: function () {
            return rand(3200, 7000);
          },
          easing: 'easeInOutSine'
        }
      ],
      duration: function () {
        return rand(18000, 28000);
      },
      delay: anime.stagger(rand(400, 2400)),
      loop: true,
      alternate: false,
      easing: 'easeInOutSine'
    });

    anime({
      targets: wisps,
      translateX: function () {
        return rand(-120, 120);
      },
      translateY: function () {
        return rand(-70, 70);
      },
      scale: function () {
        return rand(0.75, 1.4);
      },
      opacity: [
        {
          to: function () {
            return rand(0.05, 0.13);
          },
          duration: function () {
            return rand(5000, 11000);
          },
          easing: 'easeInQuad'
        },
        {
          to: 0,
          duration: function () {
            return rand(5000, 11000);
          },
          easing: 'easeInQuad'
        }
      ],
      duration: function () {
        return rand(24000, 38000);
      },
      delay: anime.stagger(900),
      loop: true,
      easing: 'easeInOutQuad'
    });
  }

  /* ---------- rail ---------- */

  function renderRail() {
    var host = $('railGroups');
    host.innerHTML = '';
    var rows = [];

    state.groups.forEach(function (group) {
      var count = group.people || 1;
      var button = el('button', 'group' + (group.id === state.activeId ? ' is-active' : ''));
      button.type = 'button';
      button.appendChild(el('span', 'group-name', group.name));
      button.appendChild(el('span', 'group-tally', String(count)));
      button.addEventListener('click', function () {
        openGroup(group.id);
      });
      host.appendChild(button);
      rows.push(button);
    });

    anime({
      targets: rows,
      opacity: [0, 1],
      translateX: [-10, 0],
      duration: 460,
      delay: anime.stagger(55),
      easing: 'easeOutQuad'
    });
  }

  function renderHead() {
    var group = active();
    if (!group) return;
    $('roomName').textContent = group.name;
    $('roomAbout').textContent = group.about;
    $('roomTally').textContent = (group.people || 1) + ' here';
  }

  function renderIdentity() {
    $('whoMark').textContent = initials(state.me.name);
    $('whoName').textContent = state.me.name;
    $('whoMark').style.background = state.me.hue;
  }

  /* ---------- thread ---------- */

  function sameSpeaker(a, b) {
    if (!a || !b) return false;
    if (a.mine !== b.mine) return false;
    return (a.mine ? state.me.name : a.name) === (b.mine ? state.me.name : b.name);
  }

  function buildMessage(message, previous, isNew) {
    var mine = !!message.mine;
    var grouped = sameSpeaker(message, previous) && message.at - previous.at < 5 * 60 * 1000;

    var row = el('article', 'msg' + (mine ? ' is-mine' : '') + (grouped ? '' : ' is-first'));
    row.setAttribute('data-id', message.id);

    var mark = el('span', 'msg-mark', initials(mine ? state.me.name : message.name));
    mark.style.background = mine ? state.me.hue : message.hue;
    mark.setAttribute('aria-hidden', 'true');

    var main = el('div', 'msg-main');

    var head = el('div', 'msg-head');
    if (!mine) head.appendChild(el('span', 'msg-name', message.name));
    var time = el('time', 'msg-time', clockOf(message.at));
    time.setAttribute('datetime', new Date(message.at).toISOString());
    head.appendChild(time);

    if (message.quote) {
      var quote = el('blockquote', 'quote');
      quote.appendChild(el('span', 'quote-name', message.quote.name));
      quote.appendChild(el('span', 'quote-text', message.quote.text));
      main.appendChild(quote);
    }

    main.appendChild(el('p', 'msg-text', message.text));
    main.insertBefore(head, main.firstChild);



    /* Order matters: .msg is `34px 1fr`, so the avatar must be the first
       grid child or auto-placement squeezes the body into the gutter. */
    row.appendChild(mark);
    row.appendChild(main);

    if (isNew) {
      anime({
        targets: main,
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 460,
        easing: 'easeOutQuad'
      });
      anime({
        targets: mark,
        opacity: [0, 1],
        scale: [0.86, 1],
        duration: 420,
        easing: 'easeOutBack'
      });
    } else {
      anime.set(main, { opacity: 1, translateY: 0 });
      anime.set(mark, { opacity: 1, scale: 1 });
    }

    return row;
  }

  function renderThread() {
    var host = $('thread');
    var messages = list();
    var seen = state.rendered[state.activeId] || 0;

    host.innerHTML = '';

    if (!messages.length) {
      host.appendChild(el('p', 'thread-empty', 'Nothing here yet. Open with something worth arguing about.'));
      state.rendered[state.activeId] = 0;
      return;
    }

    var lastDay = null;
    var previous = null;

    messages.forEach(function (message, index) {
      var key = dayKey(message.at);
      if (key !== lastDay) {
        host.appendChild(el('p', 'day', dayLabel(message.at)));
        previous = null;
        lastDay = key;
      }
      host.appendChild(buildMessage(message, previous, index >= seen));
      previous = message;
    });

    state.rendered[state.activeId] = messages.length;
    setTimeout(function () {
      host.scrollTo({ top: host.scrollHeight, behavior: 'smooth' });
    }, 120);
  }

  /* ---------- reply ---------- */

  function startReply(message) {
    state.replyTo = {
      id: message.id,
      name: message.mine ? 'You' : message.name,
      text: message.text
    };

    var strip = $('replying');
    $('replyingLabel').textContent = 'Replying to ' + state.replyTo.name;
    $('replyingBody').textContent = state.replyTo.text;
    strip.hidden = false;

    anime({
      targets: strip,
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 300,
      easing: 'easeOutQuad'
    });

    $('input').focus();
  }

  function cancelReply() {
    state.replyTo = null;
    $('replying').hidden = true;
  }

  /* ---------- remote typing ---------- */

  function showTyping(groupId, name, hue) {
    var host = $('thread');
    if (host.querySelector('[data-typing="' + groupId + '"]')) return;

    var node = el('div', 'typing');
    node.setAttribute('data-typing', groupId);

    var pill = el('span', 'typing-pill');
    for (var i = 0; i < 3; i++) pill.appendChild(el('span', 'typing-dot'));

    node.appendChild(pill);
    node.appendChild(el('span', 'typing-who', name + ' is typing'));
    host.appendChild(node);
    host.scrollTop = host.scrollHeight;

    anime({
      targets: node.querySelectorAll('.typing-dot'),
      translateY: [
        { to: -5, duration: 380, easing: 'easeOutQuad' },
        { to: 0, duration: 380, easing: 'easeInQuad' }
      ],
      opacity: [
        { to: 1, duration: 380 },
        { to: 0.4, duration: 380 }
      ],
      duration: 1200,
      delay: anime.stagger(170),
      loop: true,
      easing: 'easeInOutQuad'
    });

    anime({
      targets: node,
      opacity: [0, 1],
      translateY: [6, 0],
      duration: 280,
      easing: 'easeOutQuad'
    });

    clearTimeout(node.__expire);
    node.__expire = setTimeout(function () {
      hideTyping(groupId);
    }, 2800);
  }

  function hideTyping(groupId) {
    var node = $('thread').querySelector('[data-typing="' + groupId + '"]');
    if (!node) return;
    clearTimeout(node.__expire);
    anime.remove(node.querySelectorAll('.typing-dot'));
    anime({
      targets: node,
      opacity: [1, 0],
      duration: 220,
      easing: 'easeInQuad',
      complete: function () {
        node.remove();
      }
    });
  }

  /* ---------- composer ---------- */

  function autoGrow() {
    var input = $('input');
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
  }

  function updateComposer() {
    var input = $('input');
    var left = LIMIT - input.value.length;
    var typing = input.value.trim().length > 0;
    var wasTyping = state.typing;
    state.typing = typing;

    $('count').textContent = String(left);
    $('count').className = 'composer-count' + (left <= 60 ? ' is-low' : '');
    $('send').disabled = !typing;

    var field = $('composerField');

    /* The field reacts to being written in: it lifts, its corners relax, and
       the border brightens. Fires once on the transition into typing, then
       holds, so it never reads as jitter on every keystroke. */
    anime.remove(field);
    if (typing !== wasTyping) {
      anime({
        targets: field,
        translateY: typing ? [0, -2] : [-2, 0],
        borderRadius: typing ? ['14px', '19px'] : ['19px', '14px'],
        duration: typing ? 460 : 300,
        easing: typing ? 'spring(1, 78, 12, 0)' : 'easeOutQuad'
      });
    }

    /* Remaining room, drawn as a wash across the field. */
    var fill = $('composerFill');
    var progress = Math.min(1, input.value.length / LIMIT);
    anime.remove(fill);
    anime({
      targets: fill,
      scaleX: progress,
      opacity: typing ? 1 : 0,
      duration: typing ? 480 : 240,
      easing: 'easeOutQuart'
    });

    /* A hairline draws itself under the words being written. */
    var rule = $('composerRule');
    anime.remove(rule);
    anime({
      targets: rule,
      scaleX: typing ? [0, 1] : [1, 0],
      opacity: typing ? [0, 0.85] : [0.85, 0],
      duration: typing ? 620 : 320,
      easing: 'easeOutQuart'
    });
  }

  function send() {
    var input = $('input');
    var text = input.value.trim();
    if (!text) return;

    var messages = state.messages[state.activeId] || (state.messages[state.activeId] = []);
    var message = {
      id: 'm' + Date.now().toString(36) + state.seq++,
      name: state.me.name,
      hue: state.me.hue,
      text: text,
      at: Date.now(),
      mine: true
    };

    if (state.replyTo) {
      message.quote = { name: state.replyTo.name, text: state.replyTo.text };
    }

    messages.push(message);

    input.value = '';
    autoGrow();
    updateComposer();
    cancelReply();
    hideTyping(state.activeId);
    save();
    renderThread();
  }

  /* ---------- groups ---------- */

  function openGroup(id) {
    state.activeId = id;
    state.rendered[id] = 0;
    cancelReply();
    renderRail();
    renderHead();
    renderThread();

    var rail = $('railGroups');
    var active_ = rail.querySelector('.is-active');
    if (active_) {
      anime({
        targets: active_.querySelector('.group-name'),
        fontSize: ['16px', '19px'],
        duration: 320,
        easing: 'easeOutQuad'
      });
    }
  }

  function createGroup() {
    var name = slug($('groupInput').value);
    if (!name) return;

    var id = 'g' + Date.now().toString(36);
    state.groups.push({ id: id, name: name, about: 'A new argument waiting to happen.', people: 1 });
    state.messages[id] = [];

    save();
    closeSheet('groupVeil');
    openGroup(id);
    toast('Created ' + name);
  }

  /* ---------- sheets ---------- */

  function openSheet(id) {
    var veil = $(id);
    veil.hidden = false;
    anime({
      targets: veil.querySelector('.sheet'),
      opacity: [0, 1],
      scale: [0.965, 1],
      translateY: [10, 0],
      duration: 340,
      easing: 'easeOutQuad'
    });
    var input = veil.querySelector('input');
    input.value = '';
    input.focus();
  }

  function closeSheet(id) {
    $(id).hidden = true;
  }

  function saveName() {
    var value = $('nameInput').value.trim().replace(/\s+/g, ' ');
    if (!value) return;

    var before = state.me.name;
    state.me.name = value;
    state.me.hue = hueFor(value);

    /* Keep already-sent messages attributed to the old name, but re-mark
       your own so the avatar stays in sync with your current name. */
    Object.keys(state.messages).forEach(function (key) {
      state.messages[key].forEach(function (message) {
        if (message.mine) message.name = before;
      });
    });

    save();
    closeSheet('nameVeil');
    renderIdentity();
    state.rendered[state.activeId] = 0;
    renderThread();
    toast('You are now ' + value);
  }

  /* ---------- seed ---------- */

  function seed() {
    var stored = load();
    var now = Date.now();
    var min = 60000;

    if (stored && stored.groups && stored.groups.length) {
      state.me = stored.me || state.me;
      state.groups = stored.groups;
      state.messages = stored.messages || {};
      state.activeId = state.groups[0].id;
      return;
    }

    state.groups = [
      { id: 'anime', name: 'ANIME', about: 'Anime, and the takes we disagree about.', people: 4 },
      { id: 'general', name: 'General', about: 'Anything that is not anime.', people: 3 },
      { id: 'random', name: 'Random', about: 'Late, and probably a bad idea.', people: 2 }
    ];

    /* A real disagreement, so the typography and the quote treatment are
       judged against real content rather than lorem filler. */
    state.messages = {
      anime: [
        { id: 'a1', name: 'Kuromi', hue: HUES[0], text: 'Final episode tonight and I already know it is going to ruin my week.', at: now - 42 * min, mine: false },
        { id: 'a2', name: 'Rin', hue: HUES[1], text: 'You say that every season and every season you are right, so I believe you.', at: now - 39 * min, mine: false },
        { id: 'a3', name: 'Kuromi', hue: HUES[0], text: 'The pacing in the last two episodes was the problem. They gave the flashback a full episode and then rushed the fight.', at: now - 34 * min, mine: false },
        { id: 'a4', name: 'Sora', hue: HUES[3], text: 'The flashback was the best thing in the season, but yes the fight deserved more than what it got.', at: now - 31 * min, mine: false },
        { id: 'a5', name: 'Rin', hue: HUES[1], text: 'I do not think a flashback can be the problem when the alternative was more of the same. They gave us something to argue about for once.', at: now - 12 * min, mine: false }
      ],
      general: [
        { id: 'g1', name: 'Dev_Omar', hue: HUES[4], text: 'Rebuilt the desk this weekend. Cable management is still a lie I tell myself.', at: now - 180 * min, mine: false },
        { id: 'g2', name: 'Lune', hue: HUES[6], text: 'It always is. The pile behind the monitor is the real desk.', at: now - 176 * min, mine: false }
      ],
      random: [
        { id: 'r1', name: 'jack', hue: HUES[5], text: 'Third bowl of cereal. Do not judge me.', at: now - 320 * min, mine: false }
      ]
    };

    state.activeId = 'anime';
  }

  /* ---------- boot ---------- */

  function boot() {
    seed();
    renderIdentity();
    renderRail();
    renderHead();
    renderThread();
    buildAsh();

    /* One orchestrated entrance, then quiet. */
    anime({ targets: '.wordmark', opacity: [0, 1], translateY: [-8, 0], duration: 620, easing: 'easeOutQuad' });
    anime({ targets: '.who', opacity: [0, 1], duration: 520, delay: 90, easing: 'easeOutQuad' });
    anime({ targets: '.room-head', opacity: [0, 1], translateY: [-6, 0], duration: 620, delay: 60, easing: 'easeOutQuad' });
    anime({ targets: '.dock', opacity: [0, 1], translateY: [10, 0], duration: 620, delay: 150, easing: 'easeOutQuad' });

    var input = $('input');

    input.addEventListener('input', function () {
      autoGrow();
      updateComposer();
    });

    $('composer').addEventListener('submit', function (event) {
      event.preventDefault();
      send();
    });

    $('add').addEventListener('click', function () {
      openSheet('groupVeil');
    });

    $('who').addEventListener('click', function () {
      openSheet('nameVeil');
      $('nameInput').value = state.me.name;
      $('nameSave').disabled = false;
    });

    $('groupInput').addEventListener('input', function () {
      $('groupCreate').disabled = !slug(this.value);
    });

    $('nameInput').addEventListener('input', function () {
      $('nameSave').disabled = !this.value.trim();
    });

    $('groupInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') createGroup();
    });

    $('nameInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') saveName();
    });

    $('groupCancel').addEventListener('click', function () {
      closeSheet('groupVeil');
    });

    $('nameCancel').addEventListener('click', function () {
      closeSheet('nameVeil');
    });

    $('groupCreate').addEventListener('click', createGroup);
    $('nameSave').addEventListener('click', saveName);
    $('replyingClear').addEventListener('click', cancelReply);

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!$('groupVeil').hidden) return closeSheet('groupVeil');
      if (!$('nameVeil').hidden) return closeSheet('nameVeil');
      if (state.replyTo) cancelReply();
    });

    $('thread').addEventListener('scroll', function () {
      var host = this;
      if (host.scrollTop + host.clientHeight >= host.scrollHeight - 120) return;
      host.dataset.detached = '1';
    });

    updateComposer();

    /* Handle for a real backend, and for previewing the remote typing
       animation without a socket. */
    window.Chatter = {
      showTyping: showTyping,
      hideTyping: hideTyping,
      state: state,
      receive: function (message) {
        var messages = state.messages[state.activeId] || (state.messages[state.activeId] = []);
        message.id = message.id || 'm' + Date.now().toString(36) + state.seq++;
        message.hue = message.hue || hueFor(message.name || 'anon');
        message.mine = false;
        message.at = message.at || Date.now();
        messages.push(message);
        if (state.activeId === state.activeId) renderThread();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
