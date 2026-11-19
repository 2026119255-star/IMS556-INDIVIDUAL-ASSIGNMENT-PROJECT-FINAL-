/**
 * chat.js - Study Chat page. Channels (General plus one per course), quick
 * replies, message search and clear. Replies come from Ed (js/ed.js), and
 * the Ask Ed panel on other pages shares the same General history.
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!EduTrack.requireAuth()) return;

  const channelList = document.getElementById('channel-list');
  const thread = document.getElementById('chat-thread');
  const titleEl = document.getElementById('channel-title');
  const subtitleEl = document.getElementById('channel-subtitle');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const searchBox = document.getElementById('chat-search');
  const clearButton = document.getElementById('clear-chat');
  const typing = document.getElementById('typing-indicator');
  const quickBar = document.querySelector('[aria-label="Quick commands"]');

  const { escapeHtml } = EduTrack;
  let activeChannel = 'general';
  let replyTimer = null;

  /* ---------- Channels ---------- */

  const getChannels = () => [
    { id: 'general', name: 'General', title: 'Ask Ed about all your courses' },
    ...EduStore.getCourses().map((c) => ({ id: c.code, name: c.code, title: c.title }))
  ];

  const channelById = (id) => getChannels().find((ch) => ch.id === id);

  const renderChannels = () => {
    if (!channelById(activeChannel)) activeChannel = 'general';

    channelList.innerHTML = getChannels().map((ch) => `
      <button type="button"
              class="list-group-item list-group-item-action ${ch.id === activeChannel ? 'active' : ''}"
              data-channel="${escapeHtml(ch.id)}"
              ${ch.id === activeChannel ? 'aria-current="true"' : ''}>
        <div class="fw-semibold">#${escapeHtml(ch.name)}</div>
        <small class="${ch.id === activeChannel ? 'text-white-50' : 'text-muted'}">${escapeHtml(ch.title)}</small>
      </button>`).join('');

    const channel = channelById(activeChannel);
    titleEl.textContent = `#${channel.name}`;
    subtitleEl.textContent = channel.id === 'general' ? `${Ed.NAME} · your study buddy` : channel.title;
  };

  const renderQuickReplies = () => {
    quickBar.innerHTML = Ed.quickReplies.map((q) => `
      <button type="button" class="btn btn-outline-secondary btn-sm" data-command="${q.command}">
        <i class="bi ${q.icon} me-1" aria-hidden="true"></i>${escapeHtml(q.label)}
      </button>`).join('');
  };

  const ensureWelcome = (channelId) => {
    if (EduStore.getMessages().some((m) => m.channel === channelId)) return;
    EduStore.addMessage({ channel: channelId, author: 'bot', text: Ed.welcome(channelId) });
  };

  /* ---------- Thread ---------- */

  const renderThread = () => {
    const term = searchBox.value.trim().toLowerCase();
    const all = EduStore.getMessages().filter((m) => m.channel === activeChannel);
    const messages = term ? all.filter((m) => m.text.toLowerCase().includes(term)) : all;

    if (!messages.length) {
      thread.innerHTML = `<p class="text-center text-muted my-auto">${term
        ? 'No messages match your search.'
        : `No messages yet. Say hello to ${Ed.NAME}!`}</p>`;
      return;
    }

    let lastDay = '';
    let html = '';

    messages.forEach((m) => {
      const day = new Date(m.time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      if (day !== lastDay) {
        html += `<div class="chat-day"><span>${day}</span></div>`;
        lastDay = day;
      }
      html += Ed.bubble(m);
    });

    thread.innerHTML = html;
    thread.scrollTop = thread.scrollHeight;
  };

  /* ---------- Sending ---------- */

  const sendMessage = async (rawText) => {
    const text = rawText.trim();
    if (!text) return;

    const channel = activeChannel;
    EduStore.addMessage({ channel, author: 'user', text });
    input.value = '';
    input.style.height = 'auto';

    const liveOn = Boolean(typeof EDUTRACK_DATA !== 'undefined' && EDUTRACK_DATA.ai && EDUTRACK_DATA.ai.endpoint);
    typing.innerHTML = liveOn ? `${Ed.NAME} is looking that up&hellip;` : `${Ed.NAME} is typing&hellip;`;
    typing.classList.remove('d-none');

    const started = Date.now();
    const answer = await Ed.ask(text, channel);
    // Keep a short pause so replies do not appear instantly
    const wait = Math.max(0, 350 - (Date.now() - started));
    clearTimeout(replyTimer);
    replyTimer = setTimeout(() => {
      typing.classList.add('d-none');
      EduStore.addMessage({ channel, author: 'bot', text: answer });
    }, wait);
  };

  /* ---------- Events ---------- */

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  // Enter sends; Shift+Enter inserts a new line
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });

  channelList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-channel]');
    if (!button) return;
    activeChannel = button.dataset.channel;
    ensureWelcome(activeChannel);
    renderChannels();
    renderThread();
  });

  quickBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-command]');
    if (button) sendMessage(button.dataset.command);
  });

  searchBox.addEventListener('input', renderThread);

  clearButton.addEventListener('click', async () => {
    const confirmed = await EduTrack.confirmDialog(
      `Clear all messages in #${activeChannel}? This cannot be undone.`,
      'Clear'
    );
    if (confirmed) {
      EduStore.clearChannel(activeChannel);
      ensureWelcome(activeChannel);
      EduTrack.toast('Conversation cleared.');
    }
  });

  document.addEventListener('edutrack:data', () => {
    renderChannels();
    renderThread();
  });

  // Honour ?channel=... links from the menu
  const requestedChannel = new URLSearchParams(window.location.search).get('channel');
  if (requestedChannel && channelById(requestedChannel)) activeChannel = requestedChannel;

  renderQuickReplies();
  ensureWelcome(activeChannel);
  renderChannels();
  renderThread();
});
