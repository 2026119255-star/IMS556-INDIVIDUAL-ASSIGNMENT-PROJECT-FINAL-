/**
 * tasks.js - Task cards with live status filters, one-click status changes,
 * overdue marking and full add / edit / delete. Filters are kept in the URL,
 * so refreshing or sharing the link keeps the same view.
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!EduTrack.requireAuth()) return;

  const grid = document.getElementById('task-grid');
  const note = document.getElementById('task-filter-note');
  const filterButtons = document.querySelectorAll('[data-filter]');
  const addButton = document.getElementById('add-task-btn');

  const form = document.getElementById('task-form');
  const modal = new bootstrap.Modal(document.getElementById('task-modal'));
  const modalTitle = document.getElementById('task-modal-title');
  const submitButton = document.getElementById('task-submit');
  const fields = {
    title: document.getElementById('task-title'),
    course: document.getElementById('task-course'),
    due: document.getElementById('task-due'),
    priority: document.getElementById('task-priority'),
    status: document.getElementById('task-status')
  };

  const { escapeHtml, markField, resetValidation, formatDate } = EduTrack;
  const priorityColour = { High: 'danger', Medium: 'warning', Low: 'secondary' };
  const statusColour = { Pending: 'secondary', 'In Progress': 'info', Completed: 'success' };

  const FILTERS = ['all', 'Pending', 'In Progress', 'Completed'];
  const NEXT_STATUS = { Pending: 'In Progress', 'In Progress': 'Completed', Completed: 'Pending' };
  const ACTION_LABEL = { Pending: 'Start', 'In Progress': 'Mark done', Completed: 'Reopen' };
  const EMPTY_TEXT = {
    all: 'No tasks yet. Click Add task to create your first one.',
    Pending: 'No pending tasks. You are up to date.',
    'In Progress': 'Nothing in progress. Click Start on a task to see it here.',
    Completed: 'No completed tasks yet. Mark a task done and it will appear here.'
  };

  // Match ?status= links regardless of letter case
  const matchFilter = (value) =>
    FILTERS.find((f) => f.toLowerCase() === (value || 'all').toLowerCase()) || 'all';

  const params = new URLSearchParams(window.location.search);
  let currentFilter = matchFilter(params.get('status'));
  let currentCourse = params.get('course') || '';
  let editingId = null;

  // Local date as YYYY-MM-DD, used to flag overdue tasks
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /* ---------- Filters ---------- */

  const syncFilterButtons = () => {
    const S = EduStore.summary().tasks;
    const countOf = (f) => ({ all: S.all, Pending: S.pending, 'In Progress': S.inProgress, Completed: S.completed }[f]);

    filterButtons.forEach((b) => {
      const f = b.dataset.filter;
      const active = f === currentFilter;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
      b.textContent = `${f === 'all' ? 'All' : f} (${countOf(f)})`;
    });
  };

  // Keep the filter in the address bar so a refresh keeps the same view
  const syncUrl = () => {
    const p = new URLSearchParams();
    if (currentFilter !== 'all') p.set('status', currentFilter);
    if (currentCourse) p.set('course', currentCourse);
    const query = p.toString();
    history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  };

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter;
      render();
    });
  });

  /* ---------- Cards ---------- */

  const cardHtml = (t, today) => {
    const overdue = t.status !== 'Completed' && t.due < today;
    const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const label = t.status === 'Completed' ? 'Finished' : capitalise(EduStore.dueLabel(t.due));
    const dueText = overdue
      ? `<span class="text-danger fw-semibold">${escapeHtml(label)}</span> &middot; ${formatDate(t.due)}`
      : `${escapeHtml(label)} &middot; ${formatDate(t.due)}`;

    return `
      <div class="col-md-6 col-xl-4">
        <article class="card task-card h-100 shadow-sm ${overdue ? 'border-danger' : ''}">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge text-bg-light border text-dark">${escapeHtml(t.course)}</span>
              <span class="badge text-bg-${priorityColour[t.priority]}">${escapeHtml(t.priority)}</span>
            </div>
            <h3 class="h6 card-title">${escapeHtml(t.title)}</h3>
            <p class="small text-muted mb-3">${dueText}</p>
            <div class="mt-auto">
              <div class="d-flex justify-content-between small mb-1">
                <span class="text-body-secondary">Progress</span><span class="fw-semibold">${t.percent}%</span>
              </div>
              <div class="progress mb-2" style="height: 0.5rem;" role="progressbar" aria-label="Progress for ${escapeHtml(t.title)}"
                   aria-valuenow="${t.percent}" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar" style="width: ${t.percent}%"></div>
              </div>
              <span class="badge text-bg-${statusColour[t.status]}">${escapeHtml(t.status)}</span>
            </div>
          </div>
          <div class="card-footer bg-transparent d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-sm btn-success" data-action="advance"
                    data-id="${t.id}" aria-label="${ACTION_LABEL[t.status]}: ${escapeHtml(t.title)}">${ACTION_LABEL[t.status]}</button>
            <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit"
                    data-id="${t.id}" aria-label="Edit task ${escapeHtml(t.title)}">Edit</button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete"
                    data-id="${t.id}" aria-label="Delete task ${escapeHtml(t.title)}">Delete</button>
          </div>
        </article>
      </div>`;
  };

  /* ---------- Read and display ---------- */

  const render = () => {
    const today = localToday();
    const list = EduStore.getTasks()
      .filter((t) => (currentFilter === 'all' || t.status === currentFilter) &&
                     (!currentCourse || t.course === currentCourse))
      .sort((a, b) => a.due.localeCompare(b.due));

    const S = EduStore.summary().tasks;
    note.innerHTML = currentCourse
      ? `Showing tasks for <strong>${escapeHtml(currentCourse)}</strong>. <a href="tasks.html">Show all courses</a>`
      : `${S.open} open \u00b7 ${S.overdue} overdue \u00b7 ${S.completed} completed`;

    const emptyText = currentCourse
      ? `No ${currentFilter === 'all' ? '' : `${currentFilter.toLowerCase()} `}tasks for ${currentCourse}.`
      : EMPTY_TEXT[currentFilter];

    grid.innerHTML = list.length
      ? list.map((t) => cardHtml(t, today)).join('')
      : `<div class="col-12"><p class="text-muted">${escapeHtml(emptyText)}</p></div>`;

    syncFilterButtons();
    syncUrl();
  };

  /* ---------- Add / edit form ---------- */

  const populateCourses = () => {
    const courses = EduStore.getCourses();
    fields.course.innerHTML = courses.length
      ? courses.map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.code)} - ${escapeHtml(c.title)}</option>`).join('')
      : '<option value="">Add a course first</option>';
  };

  const openForm = (task = null) => {
    form.reset();
    resetValidation(form);
    populateCourses();
    editingId = task ? task.id : null;

    modalTitle.textContent = task ? 'Edit task' : 'Add task';
    submitButton.textContent = task ? 'Save changes' : 'Add task';

    if (task) {
      fields.title.value = task.title;
      fields.course.value = task.course;
      fields.due.value = task.due;
      fields.priority.value = task.priority;
      fields.status.value = task.status;
    } else {
      fields.due.value = localToday();
    }

    modal.show();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const title = fields.title.value.trim();
    const checks = [
      markField(fields.title, title.length >= 3, 'Please enter a title (at least 3 characters).'),
      markField(fields.course, fields.course.value !== '', 'Please choose a course.'),
      markField(fields.due, /^\d{4}-\d{2}-\d{2}$/.test(fields.due.value), 'Please choose a due date.')
    ];

    if (checks.includes(false)) {
      EduTrack.toast('Please correct the highlighted fields.', 'warning');
      return;
    }

    const data = {
      title,
      course: fields.course.value,
      due: fields.due.value,
      priority: fields.priority.value,
      status: fields.status.value
    };

    if (editingId) {
      EduStore.updateTask(editingId, data);
      EduTrack.toast('Task updated.');
    } else {
      EduStore.addTask(data);
      EduTrack.toast('Task added.');
    }
    modal.hide();
  });

  /* ---------- Card actions ---------- */

  grid.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const task = EduStore.getTasks().find((t) => t.id === button.dataset.id);
    if (!task) return;

    if (button.dataset.action === 'advance') {
      const next = NEXT_STATUS[task.status];
      EduStore.updateTask(task.id, { status: next });
      const course = EduStore.getCourses().find((c) => c.code === task.course);
      const suffix = course ? ` ${course.code} is now ${course.progress}% complete.` : '';
      EduTrack.toast(`"${task.title}" is now ${next}.${suffix}`);
    } else if (button.dataset.action === 'edit') {
      openForm(task);
    } else if (button.dataset.action === 'delete') {
      const confirmed = await EduTrack.confirmDialog(`Delete the task "${task.title}"? This cannot be undone.`);
      if (confirmed) {
        EduStore.deleteTask(task.id);
        EduTrack.toast('Task deleted.', 'danger');
      }
    }
  });

  addButton.addEventListener('click', () => openForm());
  document.addEventListener('edutrack:data', render);

  render();
});
