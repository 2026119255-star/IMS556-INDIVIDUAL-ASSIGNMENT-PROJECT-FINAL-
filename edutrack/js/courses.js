/**
 * courses.js - Course list with live status filters, search, sortable
 * columns, course details with sortable tasks, and add / edit / delete.
 *
 * Progress and status come from the course's tasks. In the edit form, the
 * percent and status can be set directly. A preview shows what the tasks
 * will become before saving, and saving updates the tasks to match.
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!EduTrack.requireAuth()) return;

  const rows = document.getElementById('course-rows');
  const search = document.getElementById('course-search');
  const pills = document.querySelectorAll('.course-pill');
  const counter = document.getElementById('course-count');
  const addButton = document.getElementById('add-course-btn');

  const detail = {
    panel: document.getElementById('course-detail'),
    code: document.getElementById('detail-code'),
    title: document.getElementById('detail-title'),
    meta: document.getElementById('detail-meta'),
    status: document.getElementById('detail-status'),
    progress: document.getElementById('detail-progress'),
    bar: document.getElementById('detail-bar'),
    tasks: document.getElementById('detail-tasks')
  };

  const form = document.getElementById('course-form');
  const modal = new bootstrap.Modal(document.getElementById('course-modal'));
  const modalTitle = document.getElementById('course-modal-title');
  const submitButton = document.getElementById('course-submit');
  const fields = {
    code: document.getElementById('course-code'),
    title: document.getElementById('course-title'),
    lecturer: document.getElementById('course-lecturer'),
    credits: document.getElementById('course-credits'),
    progress: document.getElementById('course-progress'),
    status: document.getElementById('course-status-input'),
    tags: document.getElementById('course-tags')
  };

  const { escapeHtml, formatDate, markField, resetValidation } = EduTrack;
  const statusColour = { Completed: 'success', 'In Progress': 'info', 'Not Started': 'secondary' };
  const priorityColour = { High: 'danger', Medium: 'warning', Low: 'secondary' };
  const taskStatusColour = { Pending: 'secondary', 'In Progress': 'info', Completed: 'success' };
  const priorityRank = { High: 0, Medium: 1, Low: 2 };
  const taskStatusRank = { Pending: 0, 'In Progress': 1, Completed: 2 };

  const STATUSES = ['all', 'In Progress', 'Completed', 'Not Started'];
  const EMPTY_TEXT = {
    all: 'No courses yet. Click Add course to start.',
    'In Progress': 'No courses in progress. Start a task to move a course here.',
    Completed: 'No completed courses yet. Finish every task in a course to complete it.',
    'Not Started': 'Every course has started. Nice work!'
  };

  let editingId = null;
  let editingCourse = null;
  let percentTouched = false; // true once the user changes the percent or status
  let currentStatus = 'all';
  let selectedCode = '';
  let courseSort = { key: null, dir: 'asc' };
  let taskSort = { key: 'due', dir: 'asc' };
  const taskSortLabels = { title: 'Title', due: 'Due date', priority: 'Priority', status: 'Status' };

  // Match ?status= links regardless of letter case
  const matchStatus = (value) =>
    STATUSES.find((s) => s.toLowerCase() === (value || 'all').toLowerCase()) || 'all';

  const params = new URLSearchParams(window.location.search);
  currentStatus = matchStatus(params.get('status'));
  if (params.get('course')) selectedCode = params.get('course');

  /* ---------- Helpers ---------- */

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const compareText = (a, b) =>
    String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true });

  // Same numbers the Tasks page shows: done, in progress, to do
  const breakdownText = (c) =>
    `${c.doneCount} completed \u00b7 ${c.inProgressCount} in progress \u00b7 ${c.todoCount} pending`;

  const statusFor = (percent) => (percent >= 100 ? 'Completed' : percent > 0 ? 'In Progress' : 'Not Started');

  // Keep the filter and selected course in the address bar
  const syncUrl = () => {
    const p = new URLSearchParams();
    if (currentStatus !== 'all') p.set('status', currentStatus);
    if (selectedCode) p.set('course', selectedCode);
    const query = p.toString();
    history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  };

  /* ---------- Status filters ---------- */

  const updatePills = (courses) => {
    pills.forEach((pill) => {
      const status = pill.dataset.status;
      const key = { all: 'all', 'In Progress': 'inProgress', Completed: 'completed', 'Not Started': 'notStarted' }[status];
      const count = EduStore.summary().courses[key];
      const active = status === currentStatus;
      pill.querySelector('.count').textContent = count;
      pill.classList.toggle('active', active);
      pill.setAttribute('aria-pressed', String(active));
    });
  };

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      currentStatus = pill.dataset.status;
      render();
    });
  });

  /* ---------- Sortable column headers ---------- */

  const sortableColumns = [
    { key: 'code', numeric: false },
    { key: 'title', numeric: false },
    { key: 'lecturer', numeric: false },
    { key: 'credits', numeric: true },
    { key: 'progress', numeric: true },
    { key: 'status', numeric: false }
  ];

  const headerButtons = [];
  document.querySelectorAll('table thead th').forEach((th, index) => {
    const column = sortableColumns[index];
    if (!column) return; // Actions column is not sortable

    const label = th.textContent.trim();
    th.innerHTML = `
      <button type="button" class="btn btn-link p-0 text-body text-decoration-none fw-semibold d-inline-flex align-items-center gap-1 sort-btn"
              aria-label="Sort by ${escapeHtml(label)}">
        ${escapeHtml(label)} <i class="bi sort-icon" aria-hidden="true"></i>
      </button>`;

    const button = th.querySelector('.sort-btn');
    headerButtons.push({ th, button, key: column.key, numeric: column.numeric });

    button.addEventListener('click', () => {
      if (courseSort.key === column.key) {
        courseSort.dir = courseSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        courseSort = { key: column.key, dir: 'asc' };
      }
      render();
    });
  });

  const updateHeaders = () => {
    headerButtons.forEach(({ th, button, key, numeric }) => {
      const active = courseSort.key === key;
      const asc = courseSort.dir === 'asc';
      const icon = button.querySelector('.sort-icon');

      if (!active) {
        icon.className = 'bi bi-arrow-down-up sort-icon opacity-50';
      } else if (numeric) {
        icon.className = `bi ${asc ? 'bi-sort-numeric-down' : 'bi-sort-numeric-up'} sort-icon`;
      } else {
        icon.className = `bi ${asc ? 'bi-sort-alpha-down' : 'bi-sort-alpha-up'} sort-icon`;
      }
      th.setAttribute('aria-sort', active ? (asc ? 'ascending' : 'descending') : 'none');
    });
  };

  const applyCourseSort = (list) => {
    if (!courseSort.key) return list;
    const factor = courseSort.dir === 'asc' ? 1 : -1;
    const key = courseSort.key;

    return [...list].sort((a, b) => {
      const result = typeof a[key] === 'number'
        ? a[key] - b[key]
        : compareText(a[key], b[key]);
      return factor * result || compareText(a.code, b.code);
    });
  };

  /* ---------- Course details with sortable tasks ---------- */

  const detailBreakdown = document.createElement('p');
  detailBreakdown.className = 'small text-body-secondary mb-3';
  detail.progress.insertAdjacentElement('afterend', detailBreakdown);

  detail.tasks.insertAdjacentHTML('beforebegin', `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2" id="detail-sort" role="group" aria-label="Sort tasks">
      <span class="small text-body-secondary me-1">Sort tasks by:</span>
      ${Object.entries(taskSortLabels).map(([key, label]) => `
        <button type="button" class="btn btn-sm btn-outline-secondary" data-task-sort="${key}">${label}</button>`).join('')}
    </div>`);

  const taskSortBar = document.getElementById('detail-sort');

  const updateTaskSortButtons = () => {
    taskSortBar.querySelectorAll('[data-task-sort]').forEach((button) => {
      const key = button.dataset.taskSort;
      const active = taskSort.key === key;
      const arrow = active ? (taskSort.dir === 'asc' ? ' \u2191' : ' \u2193') : '';
      button.textContent = taskSortLabels[key] + arrow;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  taskSortBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-task-sort]');
    if (!button) return;
    const key = button.dataset.taskSort;
    if (taskSort.key === key) {
      taskSort.dir = taskSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      taskSort = { key, dir: 'asc' };
    }
    updateTaskSortButtons();
    renderDetailTasks();
  });

  const taskValue = {
    title: (t) => t.title.toLowerCase(),
    due: (t) => t.due,
    priority: (t) => priorityRank[t.priority] ?? 9,
    status: (t) => taskStatusRank[t.status] ?? 9
  };

  const compareTasks = (a, b, key) => {
    const va = taskValue[key](a);
    const vb = taskValue[key](b);
    return typeof va === 'number' ? va - vb : compareText(va, vb);
  };

  let detailCourse = null;

  const renderDetailTasks = () => {
    if (!detailCourse) return;

    const tasks = EduStore.getTasks()
      .filter((t) => t.course === detailCourse.code)
      .sort((a, b) => {
        const factor = taskSort.dir === 'asc' ? 1 : -1;
        return factor * compareTasks(a, b, taskSort.key) || a.due.localeCompare(b.due);
      });

    detail.tasks.innerHTML = tasks.length
      ? tasks.map((t) => `
          <li class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <span class="fw-semibold">${escapeHtml(t.title)}</span>
              <div class="small text-body-secondary">Due ${formatDate(t.due)}</div>
            </div>
            <span>
              <span class="badge text-bg-${priorityColour[t.priority]} me-1">${escapeHtml(t.priority)}</span>
              <span class="badge text-bg-${taskStatusColour[t.status]}">${escapeHtml(t.status)}</span>
            </span>
          </li>`).join('')
      : '<li class="list-group-item text-body-secondary">No tasks for this course yet. Add one on the Tasks page.</li>';
  };

  const renderDetail = (courses) => {
    const course = courses.find((c) => c.code === selectedCode);
    detailCourse = course || null;
    detail.panel.classList.toggle('d-none', !course);
    if (!course) return;

    detail.code.textContent = course.code;
    detail.title.textContent = course.title;
    detail.meta.textContent = `${course.lecturer} \u00b7 ${course.credits} credits`;
    detail.status.className = `badge text-bg-${statusColour[course.status]}`;
    detail.status.textContent = course.status;
    detail.progress.setAttribute('aria-valuenow', String(course.progress));
    detail.progress.setAttribute('aria-label', `${course.code} progress`);
    detail.bar.style.width = `${course.progress}%`;
    detail.bar.textContent = `${course.progress}%`;
    detailBreakdown.textContent = course.derived
      ? `Tasks: ${breakdownText(course)}.`
      : 'Progress is set manually for this course, because it has no tasks yet.';

    updateTaskSortButtons();
    renderDetailTasks();
  };

  /* ---------- Read and display ---------- */

  const render = () => {
    const term = search.value.trim().toLowerCase();
    const courses = EduStore.getCourses();

    if (selectedCode && !courses.some((c) => c.code === selectedCode)) selectedCode = '';

    const visible = applyCourseSort(courses.filter((c) =>
      (currentStatus === 'all' || c.status === currentStatus) &&
      (!selectedCode || c.code === selectedCode) &&
      `${c.code} ${c.title} ${c.tags.join(' ')}`.toLowerCase().includes(term)
    ));

    const T = EduStore.summary().tasks;
    counter.textContent = `Showing ${visible.length} of ${plural(courses.length, 'course')} \u00b7 All tasks: ${T.completed} completed, ${T.inProgress} in progress, ${T.pending} pending`;
    updatePills(courses);
    updateHeaders();
    renderDetail(courses);
    syncUrl();

    const emptyText = term
      ? 'No courses match your search.'
      : EMPTY_TEXT[currentStatus];

    rows.innerHTML = visible.length
      ? visible.map((c) => `
          <tr>
            <td class="fw-semibold" data-label="Code">${escapeHtml(c.code)}</td>
            <td data-label="Course">${escapeHtml(c.title)}</td>
            <td class="d-none d-md-table-cell" data-label="Lecturer">${escapeHtml(c.lecturer)}</td>
            <td class="text-center d-none d-sm-table-cell" data-label="Credits">${c.credits}</td>
            <td style="min-width: 160px;" data-label="Progress">
              <div class="progress" role="progressbar" aria-label="${escapeHtml(c.code)} progress"
                   aria-valuenow="${c.progress}" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar" style="width: ${c.progress}%">${c.progress}%</div>
              </div>
              <div class="small text-body-secondary mt-1">${c.derived
                ? breakdownText(c)
                : 'Set manually'}</div>
            </td>
            <td data-label="Status"><span class="badge text-bg-${statusColour[c.status]}">${escapeHtml(c.status)}</span></td>
            <td class="text-end text-nowrap" data-label="Actions">
              <button type="button" class="btn btn-sm btn-outline-primary me-1" data-action="edit"
                      data-id="${c.id}" aria-label="Edit ${escapeHtml(c.code)}">Edit</button>
              <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete"
                      data-id="${c.id}" aria-label="Delete ${escapeHtml(c.code)}">Delete</button>
            </td>
          </tr>`).join('')
      : `<tr><td colspan="7" class="text-center text-body-secondary py-4">${escapeHtml(emptyText)}</td></tr>`;
  };

  /* ---------- Add / edit form ---------- */

  // Shows what the percent and status will do to the tasks, before saving
  const previewBox = document.createElement('div');
  previewBox.className = 'alert alert-info border-0 small mb-0 mt-2';
  previewBox.setAttribute('role', 'status');
  fields.status.closest('.col-md-6').appendChild(previewBox);

  const updatePreview = () => {
    const percent = Number(fields.progress.value);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      previewBox.textContent = 'Enter a whole number from 0 to 100.';
      return;
    }

    const preview = editingCourse && editingCourse.derived
      ? EduStore.previewProgress(editingCourse.code, percent)
      : null;

    if (preview) {
      previewBox.innerHTML = `Saving sets all ${plural(preview.taskCount, 'task')} to <strong>${percent}%</strong>, ` +
        `so the course shows exactly ${percent}%.<br>Status: <strong>${escapeHtml(preview.status)}</strong>. ` +
        'The Tasks page updates to match.';
    } else {
      previewBox.innerHTML = `<strong>${escapeHtml(statusFor(percent))}</strong> at ${percent}%.<br>` +
        'This course has no tasks yet, so the percent is kept as typed.';
    }
  };

  // Typing a percent sets the status to match
  fields.progress.addEventListener('input', () => {
    percentTouched = true;
    const percent = Number(fields.progress.value);
    if (Number.isInteger(percent) && percent >= 0 && percent <= 100) {
      fields.status.value = statusFor(percent);
    }
    updatePreview();
  });

  // Choosing a status sets the percent to match
  fields.status.addEventListener('change', () => {
    percentTouched = true;
    const chosen = fields.status.value;
    const current = Number(fields.progress.value);
    if (chosen === 'Completed') {
      fields.progress.value = 100;
    } else if (chosen === 'Not Started') {
      fields.progress.value = 0;
    } else if (!(current >= 1 && current <= 99)) {
      fields.progress.value = 50;
    }
    updatePreview();
  });

  const openForm = (course = null) => {
    form.reset();
    resetValidation(form);
    editingId = course ? course.id : null;
    editingCourse = course;
    percentTouched = false;

    modalTitle.textContent = course ? 'Edit course' : 'Add course';
    submitButton.textContent = course ? 'Save changes' : 'Add course';

    if (course) {
      fields.code.value = course.code;
      fields.title.value = course.title;
      fields.lecturer.value = course.lecturer;
      fields.credits.value = course.credits;
      fields.progress.value = course.progress;
      fields.status.value = course.status;
      fields.tags.value = course.tags.join(', ');
    } else {
      fields.credits.value = 3;
      fields.progress.value = 0;
      fields.status.value = 'Not Started';
    }

    updatePreview();
    modal.show();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const courses = EduStore.getCourses();
    const code = fields.code.value.trim().toUpperCase();
    const title = fields.title.value.trim();
    const lecturer = fields.lecturer.value.trim();
    const credits = Number(fields.credits.value);
    const progress = Number(fields.progress.value);
    const duplicate = courses.some((c) => c.code === code && c.id !== editingId);

    const checks = [
      markField(fields.code, !duplicate && /^[A-Z0-9-]{2,12}$/.test(code),
        duplicate ? 'That course code already exists.' : 'Use 2 to 12 letters, numbers or hyphens.'),
      markField(fields.title, title.length >= 3, 'Please enter a title (at least 3 characters).'),
      markField(fields.lecturer, lecturer.length >= 2, "Please enter the lecturer's name."),
      markField(fields.credits, Number.isInteger(credits) && credits >= 1 && credits <= 6,
        'Credits must be a whole number from 1 to 6.'),
      markField(fields.progress, Number.isInteger(progress) && progress >= 0 && progress <= 100,
        'Progress must be a whole number between 0 and 100.')
    ];

    if (checks.includes(false)) {
      EduTrack.toast('Please correct the highlighted fields.', 'warning');
      return;
    }

    const data = {
      code, title, lecturer, credits, progress,
      status: statusFor(progress),
      tags: fields.tags.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    };

    if (editingId) {
      const before = editingCourse;
      // Renames move the tasks first, so the percent below applies to the new code
      EduStore.updateCourse(editingId, data);

      // Only change the tasks when the user set the percent or status in this form
      if (before && before.derived && percentTouched) {
        EduStore.applyProgress(code, progress);
      }

      const saved = EduStore.getCourses().find((c) => c.code === code);
      const summary = saved && saved.derived
        ? ` ${saved.doneCount} of ${plural(saved.taskCount, 'task')} done, ${saved.progress}%.`
        : '';
      EduTrack.toast(`${code} saved.${summary}`);
    } else {
      EduStore.addCourse(data);
      EduTrack.toast(`${code} added.`);
    }
    modal.hide();
  });

  /* ---------- Edit and delete ---------- */

  rows.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const course = EduStore.getCourses().find((c) => c.id === button.dataset.id);
    if (!course) return;

    if (button.dataset.action === 'edit') {
      openForm(course);
    } else if (button.dataset.action === 'delete') {
      const taskNote = course.taskCount
        ? ` Its ${plural(course.taskCount, 'task')} will also be deleted.`
        : '';
      const confirmed = await EduTrack.confirmDialog(
        `Delete ${course.code} (${course.title})?${taskNote} This cannot be undone.`
      );
      if (confirmed) {
        if (selectedCode === course.code) selectedCode = '';
        EduStore.deleteCourse(course.id);
        EduTrack.toast(`${course.code} deleted.`, 'danger');
      }
    }
  });

  addButton.addEventListener('click', () => openForm());
  search.addEventListener('input', render);
  document.addEventListener('edutrack:data', render);

  render();
});
