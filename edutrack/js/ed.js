/**
 * ed.js - Ed, your study assistant.
 *
 * Ed answers in two ways:
 *  1. From your own courses and tasks, plus the date and time on your device.
 *     This always works, even offline, and matches the numbers on the other pages.
 *  2. For anything else, such as current news or dates, Ed asks a live-search
 *     service. That service is set up in data.js (ai.endpoint) and runs on a
 *     server, so no secret key is ever stored in this website.
 *
 *  - window.Ed      the engine, used by the Study Chat page
 *  - Ask Ed button  a floating button on every signed-in page that opens a
 *                   quick chat panel. It shares history with Study Chat.
 */
const Ed = (() => {
  const NAME = 'Ed';
  const GENERAL = 'general';
  const PRIORITY = { High: 0, Medium: 1, Low: 2 };

  const STUDY_TIPS = [
    'Work in 25-minute blocks, then take a 5-minute break.',
    'Start with the smallest task. Momentum makes the bigger ones easier.',
    'Explain a topic out loud as if you were teaching it. It shows what you really know.',
    'Turn off notifications while you work on one task.',
    'Write down what "done" looks like before you start. It stops you over-working.'
  ];

  const QUICK_REPLIES = [
    { label: "What's next?", command: '/next', icon: 'bi-lightning' },
    { label: 'Due soon', command: '/soon', icon: 'bi-calendar-event' },
    { label: 'My plan', command: '/plan', icon: 'bi-calendar-check' },
    { label: 'Progress', command: '/progress', icon: 'bi-graph-up' },
    { label: 'Study tip', command: '/tip', icon: 'bi-lightbulb' },
    { label: 'Help', command: '/help', icon: 'bi-question-circle' }
  ];

  // Simple "how do I" answers for the most common actions
  const HOW_TO = [
    { test: /\b(add|create|new)\b.*\btasks?\b/,
      text: 'To add a task, open Tasks and click "+ Add task". Enter a title, choose the course and due date, then save.' },
    { test: /\b(add|create|new)\b.*\bcourses?\b/,
      text: 'To add a course, open Courses and click "+ Add course". Its progress and status update by themselves as you add tasks.' },
    { test: /\b(mark|change|update|reopen)\b.*\b(task|status|done|complete)\b|\bmark (it )?done\b/,
      text: 'On the Tasks page, use the green button on a task card. It moves a task from Start to Mark done, and Reopen brings it back. Courses update straight away.' },
    { test: /\bsort/,
      text: 'On the Courses page, click a column heading to sort A to Z. Click again to reverse it. Inside a course, use the "Sort tasks by" buttons.' },
    { test: /\b(filter|show only)\b/,
      text: 'Use the status buttons at the top of the Courses or Tasks page. The number beside each one shows how many items match.' },
    { test: /\b(calculat\w*|work\w* out)\b/,
      text: "Each task has its own progress: 0% when it is pending, 100% when it is done. A course's progress is the average of its tasks. Setting a course to a percent sets every task to that percent, so the two always match." },
    { test: /\b(delete|remove)\b/,
      text: 'Click Delete on a course or task, then confirm. Deleting a course also deletes its tasks.' }
  ];

  const EMOTION = /\b(stress\w*|overwhelm\w*|anxious|anxiety|worried|tired|exhaust\w*|stuck|burn ?out|panic\w*)\b/;
  const MOTIVATION = /\b(motivat\w*|give up|can'?t do this|cannot do this|lazy)\b/;
  const DATE_TIME = /\b(what (day|date|time) is (it|today)|what is the (date|time|day)|today'?s date|what'?s the (date|time|day)|what time is it|what day is it)\b/;

  /* ---------- Helpers ---------- */

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const firstName = () => EduTrack.getCurrentUser().fullName.split(' ')[0];

  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Whole days from today to a YYYY-MM-DD date (negative means overdue)
  const daysUntil = (due) =>
    Math.round((new Date(`${due}T00:00:00`) - startOfToday()) / 86400000);

  const isOverdue = (task) => task.status !== 'Completed' && daysUntil(task.due) < 0;

  const dueLabel = (due) => EduStore.dueLabel(due);

  const courseByCode = (code) => EduStore.getCourses().find((c) => c.code === code);

  const openTasksFor = (code) => EduStore.getTasks()
    .filter((t) => t.status !== 'Completed' && (!code || t.course === code))
    .sort((a, b) => a.due.localeCompare(b.due) || PRIORITY[a.priority] - PRIORITY[b.priority]);

  const encouragement = (progress) => {
    if (progress >= 100) return 'Fully done. Brilliant work!';
    if (progress >= 70) return 'Nearly there. Keep going!';
    if (progress >= 30) return 'Good momentum. Keep it steady.';
    return 'Small steps count. Start with one task today.';
  };

  const timeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Date and time from the device clock, so they are always the current ones
  const nowText = () => {
    const d = new Date();
    return {
      date: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    };
  };

  /* ---------- Reply texts ---------- */

  const helpText = () =>
    `Here is what I can do, ${firstName()}:\n` +
    '• /next - your most urgent task\n' +
    '• /soon - what is overdue or due in the next 7 days\n' +
    '• /plan - your tasks grouped by when they are due\n' +
    '• /tasks - all your open tasks\n' +
    '• /progress - how far you have got\n' +
    '• /courses - all your courses\n' +
    '• /tip - a quick study tip\n\n' +
    'You can also type a course code, such as IMS501, ask how to do something, such as "how do I add a task?", ' +
    'or ask about today\'s date. For current news or facts, I can look them up online when that is set up.';

  const aboutText = () =>
    `I'm ${NAME}, your study buddy. I work from your own EduTrack courses and tasks, and I know today's date from your device. ` +
    'For current news or facts I can look things up online, when that feature is turned on. Type /help to see my commands.';

  const dateText = () => {
    const { date, time } = nowText();
    return `It is ${date}, ${time} on your device.`;
  };

  const nextText = (open, where) => {
    if (!open.length) return `No open tasks${where}. Enjoy the break, ${firstName()}!`;

    const task = open[0];
    const why = isOverdue(task)
      ? 'It is overdue, so it is the most urgent.'
      : task.status === 'In Progress'
        ? 'You already started it, so finishing it is a good move.'
        : task.priority === 'High'
          ? 'It is high priority, so it is a good place to start.'
          : 'Start there and the rest will feel lighter.';

    return `Your next step is "${task.title}" (${task.course}), ${dueLabel(task.due)}.\n${why}`;
  };

  const soonText = (open, where, days) => {
    const soon = open.filter((t) => daysUntil(t.due) <= days);
    if (!soon.length) return `Nothing overdue or due in the next ${days} days${where}. You are clear for now.`;

    const lines = soon.slice(0, 6).map((t) => `• ${t.title} (${t.course}) - ${dueLabel(t.due)}`);
    const more = soon.length > 6 ? `\n…and ${soon.length - 6} more` : '';
    return `Overdue or due in the next ${days} days${where}:\n${lines.join('\n')}${more}`;
  };

  // Groups open tasks by when they are due, so the week can be planned
  const planText = (open) => {
    if (!open.length) return `Nothing on your plan, ${firstName()}. Enjoy the break!`;

    const groups = [
      { name: 'Overdue', test: (d) => d < 0 },
      { name: 'Due today', test: (d) => d === 0 },
      { name: 'This week', test: (d) => d >= 1 && d <= 7 },
      { name: 'Later', test: (d) => d > 7 }
    ];

    const lines = groups.map((g) => {
      const items = open.filter((t) => g.test(daysUntil(t.due)));
      if (!items.length) return null;
      const shown = items.slice(0, 3).map((t) => `${t.title} (${t.course})`).join(', ');
      const more = items.length > 3 ? ` and ${items.length - 3} more` : '';
      return `${g.name} (${items.length}): ${shown}${more}`;
    }).filter(Boolean);

    return `Your plan, ${firstName()}:\n${lines.join('\n')}`;
  };

  const tasksText = (open, where) => {
    if (!open.length) return `No open tasks${where}. Nice work!`;

    const lines = open.slice(0, 6).map((t) => `• ${t.title} (${t.course}) - ${dueLabel(t.due)}`);
    const more = open.length > 6 ? `\n…and ${open.length - 6} more` : '';
    return `You have ${plural(open.length, 'open task')}${where}:\n${lines.join('\n')}${more}`;
  };

  const progressText = (course) => {
    if (course) {
      return `${course.code} is ${course.progress}% complete (${course.status}), with ${course.doneCount} of ${plural(course.taskCount, 'task')} done.\n${encouragement(course.progress)}`;
    }

    const S = EduStore.summary().courses;
    if (!S.all) return 'You have no courses yet. Add one on the Courses page to get started.';

    const list = EduStore.getCourses();
    const best = [...list].sort((a, b) => b.progress - a.progress)[0];
    const lowest = [...list].sort((a, b) => a.progress - b.progress)[0];

    return `Your average progress across ${plural(S.all, 'course')} is ${S.averageProgress}%, and ${S.completed} ${S.completed === 1 ? 'is' : 'are'} complete.\n` +
      `Strongest: ${best.code} (${best.progress}%). Needs most attention: ${lowest.code} (${lowest.progress}%).\n${encouragement(S.averageProgress)}`;
  };

  const coursesText = () => {
    const list = EduStore.getCourses();
    if (!list.length) return 'You have no courses yet. Add one on the Courses page.';
    return `Your courses:\n${list.map((c) => `• ${c.code} - ${c.title} (${c.progress}%, ${c.status})`).join('\n')}`;
  };

  const courseText = (course) => {
    const next = openTasksFor(course.code)[0];
    const nextLine = next ? `Next task: "${next.title}", ${dueLabel(next.due)}.` : 'No open tasks for this course.';
    return `${course.code}: ${course.title}\n` +
      `Lecturer: ${course.lecturer} · ${course.credits} credits\n` +
      `Progress: ${course.progress}% (${course.status})\n${nextLine}`;
  };

  const greetingText = (open) => {
    const count = open.length
      ? `You have ${plural(open.length, 'open task')}. Type /next to see where to start.`
      : 'No open tasks right now. Nice work!';
    return `${timeGreeting()}, ${firstName()}! ${count}`;
  };

  const fallbackText = (course) =>
    'I am not sure about that one yet. Try /next, /plan or /progress' +
    `${course ? `, or ask about ${course.code}` : ', or type a course code such as IMS501'}.`;

  /* ---------- Answers from the app's own data ---------- */

  // Returns the answer, or null when the question needs live search
  const ruleReply = (raw, channelId = GENERAL) => {
    const original = String(raw).trim();
    const text = original.toLowerCase();
    const course = courseByCode(channelId);
    const where = course ? ` for ${course.code}` : '';
    const open = openTasksFor(course ? course.code : '');

    // Exact commands first, so the quick-reply buttons always do what they say
    if (text === '/help') return helpText();
    if (text === '/next') return nextText(open, where);
    if (text === '/soon') return soonText(open, where, 7);
    if (text === '/plan') return planText(open);
    if (text === '/tasks') return tasksText(open, where);
    if (text === '/progress') return progressText(course);
    if (text === '/courses') return coursesText();
    if (text === '/tip') return pick(STUDY_TIPS);

    if (/\b(help|commands?)\b/.test(text)) return helpText();
    if (DATE_TIME.test(text)) return dateText();

    const howTo = HOW_TO.find((h) => h.test.test(text));
    if (howTo) return howTo.text;

    const codeMatch = original.toUpperCase().match(/\b[A-Z]{2,4}\d{3}\b/);
    if (codeMatch && courseByCode(codeMatch[0])) return courseText(courseByCode(codeMatch[0]));

    if (EMOTION.test(text)) {
      const next = open[0] ? ` Your next step is "${open[0].title}", and it can wait a few minutes.` : '';
      return `That sounds hard, ${firstName()}. Feeling this way is normal, and you do not have to fix everything today.${next} Take a short break, then pick one small thing.`;
    }
    if (MOTIVATION.test(text)) {
      return `You have already made progress, ${firstName()}. Keep going one small step at a time.`;
    }

    if (/\b(what should i do|what next|next|urgent|where do i start)\b/.test(text)) return nextText(open, where);
    if (/\b(plan|my week|this week)\b/.test(text)) return planText(open);
    if (/\b(today|tonight)\b/.test(text)) return soonText(open, where, 0);
    if (/\btomorrow\b/.test(text)) return soonText(open, where, 1);
    if (/\b(soon|upcoming|due)\b/.test(text)) return soonText(open, where, 7);
    if (/\b(tasks?|homework|assignments?|to ?do)\b/.test(text)) return tasksText(open, where);
    if (/\b(progress|how am i doing|how'?m i doing)\b/.test(text)) return progressText(course);
    if (/\bcourses?\b/.test(text)) return coursesText();
    if (/\b(tip|tips|study|focus|revise|revision|concentrate)\b/.test(text)) return pick(STUDY_TIPS);

    if (/^(hi|hello|hey|hiya|yo|good (morning|afternoon|evening))\b/.test(text)) return greetingText(open);
    if (/\bhow are you\b/.test(text)) return `I am doing well, thanks for asking! Ready to help you study, ${firstName()}.`;
    if (/\b(thank|thanks|thx)\b/.test(text)) return `You are welcome, ${firstName()}! Good luck with your work.`;
    if (/\b(who are you|what are you|your name|what can you do)\b/.test(text)) return aboutText();
    if (/\b(bye|goodbye|see you|good night)\b/.test(text)) return `Bye for now, ${firstName()}. Good luck, and see you soon!`;

    return null;
  };

  // Synchronous answer, used where live search is not needed
  const reply = (raw, channelId = GENERAL) =>
    ruleReply(raw, channelId) ?? fallbackText(courseByCode(channelId));

  /* ---------- Live search (optional) ---------- */

  const liveEndpoint = () =>
    (typeof EDUTRACK_DATA !== 'undefined' && EDUTRACK_DATA.ai && EDUTRACK_DATA.ai.endpoint) || '';

  // A short, non-personal summary, so Ed can judge what is due without sending his data
  const studyContext = () => {
    const S = EduStore.summary();
    const { date } = nowText();
    return `Today is ${date}. The student has ${S.courses.all} courses and ${S.tasks.open} open tasks, ` +
      `${S.tasks.overdue} of them overdue. Do not reveal any other personal details.`;
  };

  // Full answer: from the app first, then live search when it is set up
  const ask = async (raw, channelId = GENERAL) => {
    const text = String(raw).trim();
    const local = ruleReply(text, channelId);
    if (local !== null) return local;

    const endpoint = liveEndpoint();
    if (!endpoint) return fallbackText(courseByCode(channelId));

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text.slice(0, 500), context: studyContext() }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.answer ? String(data.answer) : 'I could not find a clear answer. Try asking in a different way.';
    } catch (error) {
      return 'I could not reach live search just now, so I cannot check that. Try again in a moment, or ask me about your courses and tasks.';
    }
  };

  const welcome = (channelId = GENERAL) => {
    const course = courseByCode(channelId);
    return course
      ? `Welcome to #${course.code}, ${firstName()}! Ask me about ${course.title}, its tasks or your progress. Try /tasks or /progress.`
      : `Hi ${firstName()}! I'm ${NAME}, your study buddy. Tap a quick reply below, or type /help to see what I can do.`;
  };

  // One chat bubble, shared by the Study Chat page and the Ask Ed panel
  const bubble = (m) => {
    const mine = m.author === 'user';
    const time = new Date(m.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const label = mine ? '' : `<div class="small fw-semibold text-primary mb-1">${NAME}</div>`;
    return `
      <div class="chat-row ${mine ? 'mine' : 'theirs'}">
        <div class="chat-bubble ${mine ? 'bg-primary text-white' : 'bg-body-tertiary'}">
          ${label}
          <div class="chat-text">${EduTrack.escapeHtml(m.text)}</div>
          <div class="chat-time ${mine ? 'text-white-50' : 'text-muted'}">${time}</div>
        </div>
      </div>`;
  };

  /* ---------- Floating Ask Ed button and panel ---------- */

  const CSS = `
    .ed-fab { position: fixed; right: 1.25rem; bottom: 1.25rem; width: 58px; height: 58px;
      border-radius: 50%; z-index: 1050; display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; box-shadow: 0 0.5rem 1.25rem rgba(79, 70, 229, 0.4); }
    .ed-panel { position: fixed; right: 1.25rem; bottom: 6.25rem; z-index: 1050;
      width: min(370px, calc(100vw - 2rem)); height: min(540px, calc(100vh - 8rem));
      display: flex; flex-direction: column; overflow: hidden; }
    .ed-thread { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column;
      gap: 0.5rem; padding: 0.75rem; }
    .ed-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0.5rem 0.75rem 0; }
    .ed-typing { padding: 0 0.75rem 0.25rem; font-size: 0.8rem; }`;

  const mountWidget = () => {
    // Only for signed-in users, and not on the full Study Chat page
    if (!EduTrack.getSession() || document.getElementById('chat-thread')) return;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    document.body.insertAdjacentHTML('beforeend', `
      <button type="button" class="btn btn-primary ed-fab" id="ed-fab" aria-expanded="false"
              aria-controls="ed-panel" aria-label="Ask Ed, your study assistant" title="Ask Ed">
        <i class="bi bi-robot" aria-hidden="true"></i>
      </button>
      <section class="card ed-panel d-none" id="ed-panel" aria-label="Ask Ed">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-semibold"><i class="bi bi-robot text-primary me-1" aria-hidden="true"></i>${NAME}</div>
            <small class="text-muted">Your study buddy</small>
          </div>
          <div class="d-flex align-items-center gap-2">
            <a href="chat.html" class="btn btn-sm btn-outline-secondary">Full chat</a>
            <button type="button" class="btn-close" id="ed-close" aria-label="Close Ed"></button>
          </div>
        </div>
        <div class="ed-thread" id="ed-thread" role="log" aria-live="polite"></div>
        <div class="ed-typing text-muted d-none" id="ed-typing">${NAME} is typing&hellip;</div>
        <div class="ed-chips" id="ed-chips"></div>
        <form class="card-footer bg-transparent p-2" id="ed-form">
          <div class="input-group">
            <input type="text" class="form-control" id="ed-input" maxlength="300" autocomplete="off"
                   placeholder="Ask Ed anything" aria-label="Message to Ed">
            <button class="btn btn-primary" type="submit" aria-label="Send">
              <i class="bi bi-send" aria-hidden="true"></i>
            </button>
          </div>
        </form>
      </section>`);

    const fab = document.getElementById('ed-fab');
    const panel = document.getElementById('ed-panel');
    const thread = document.getElementById('ed-thread');
    const typing = document.getElementById('ed-typing');
    const chips = document.getElementById('ed-chips');
    const form = document.getElementById('ed-form');
    const input = document.getElementById('ed-input');
    const closeButton = document.getElementById('ed-close');

    const isOpen = () => !panel.classList.contains('d-none');

    const renderThread = () => {
      const messages = EduStore.getMessages().filter((m) => m.channel === GENERAL).slice(-30);
      thread.innerHTML = messages.map(bubble).join('');
      thread.scrollTop = thread.scrollHeight;
    };

    const setOpen = (open) => {
      panel.classList.toggle('d-none', !open);
      fab.setAttribute('aria-expanded', String(open));
      fab.querySelector('i').className = open ? 'bi bi-x-lg' : 'bi bi-robot';
      if (open) {
        renderThread();
        input.focus();
      }
    };

    const send = async (raw) => {
      const text = raw.trim();
      if (!text) return;

      EduStore.addMessage({ channel: GENERAL, author: 'user', text });
      input.value = '';
      typing.innerHTML = liveEndpoint() ? `${NAME} is looking that up&hellip;` : `${NAME} is typing&hellip;`;
      typing.classList.remove('d-none');

      const started = Date.now();
      const answer = await ask(text, GENERAL);
      // Keep a short pause so replies do not appear instantly
      const wait = Math.max(0, 350 - (Date.now() - started));
      setTimeout(() => {
        typing.classList.add('d-none');
        EduStore.addMessage({ channel: GENERAL, author: 'bot', text: answer });
      }, wait);
    };

    if (!EduStore.getMessages().some((m) => m.channel === GENERAL)) {
      EduStore.addMessage({ channel: GENERAL, author: 'bot', text: welcome(GENERAL) });
    }

    chips.innerHTML = QUICK_REPLIES.slice(0, 4).map((q) => `
      <button type="button" class="btn btn-outline-secondary btn-sm" data-command="${q.command}">
        <i class="bi ${q.icon} me-1" aria-hidden="true"></i>${q.label}
      </button>`).join('');

    fab.addEventListener('click', () => setOpen(!isOpen()));
    closeButton.addEventListener('click', () => setOpen(false));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      send(input.value);
    });
    chips.addEventListener('click', (event) => {
      const button = event.target.closest('[data-command]');
      if (button) send(button.dataset.command);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) setOpen(false);
    });
    document.addEventListener('edutrack:data', () => {
      if (isOpen()) renderThread();
    });
  };

  document.addEventListener('DOMContentLoaded', mountWidget);

  return {
    NAME,
    reply,
    ask,
    welcome,
    bubble,
    quickReplies: QUICK_REPLIES
  };
})();

window.Ed = Ed;
