/**
 * dashboard.js - Summary cards and two clear charts:
 *  - Course progress: horizontal bars, sorted highest to lowest, coloured by
 *    status. Tooltips show the course title and its open task count.
 *  - Task breakdown: two-ring doughnut (inner = status, outer = priority)
 *    with counts in the legend and the open-task total in the centre.
 * Re-renders whenever data changes or the theme is switched.
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!EduTrack.requireAuth()) return;

  const welcome = document.getElementById('welcome-name');
  const statCards = document.getElementById('stat-cards');
  const deadlineList = document.getElementById('deadline-list');
  const progressCanvas = document.getElementById('progressChart');
  const statusCanvas = document.getElementById('statusChart');

  const priorityColour = { High: 'danger', Medium: 'warning', Low: 'secondary' };
  const statusOrder = ['Pending', 'In Progress', 'Completed'];
  const priorityOrder = ['High', 'Medium', 'Low'];
  const statusFill = { Pending: '#f59e0b', 'In Progress': '#06b6d4', Completed: '#10b981' };
  const courseFill = { Completed: '#10b981', 'In Progress': '#06b6d4', 'Not Started': '#94a3b8' };
  const priorityFill = { High: '#ef4444', Medium: '#f59e0b', Low: '#94a3b8' };

  let charts = [];

  // Open-task total shown in the centre of the doughnut
  const centreLabel = {
    id: 'centreLabel',
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const x = (chartArea.left + chartArea.right) / 2;
      const y = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 26px Inter, system-ui, sans-serif';
      ctx.fillStyle = chart.options.color;
      ctx.fillText(String(chart.$openTasks ?? 0), x, y - 8);
      ctx.font = '500 12px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('open tasks', x, y + 14);
      ctx.restore();
    }
  };

  const drawCharts = (courses, tasks) => {
    charts.forEach((chart) => chart.destroy());

    const dark = EduTrack.getTheme() === 'dark';
    const text = dark ? '#cbd5e1' : '#475569';
    const grid = dark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.08)';
    Chart.defaults.color = text;

    // Progress: highest first, so the order is easy to scan
    const sorted = [...courses].sort((a, b) => b.progress - a.progress);
    const openFor = (code) => tasks.filter((t) => t.course === code && t.status !== 'Completed').length;

    const progressChart = new Chart(progressCanvas, {
      type: 'bar',
      data: {
        labels: sorted.map((c) => c.code),
        datasets: [{
          label: 'Progress',
          data: sorted.map((c) => c.progress),
          backgroundColor: sorted.map((c) => courseFill[c.status] || '#4f46e5'),
          borderRadius: 6,
          barThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => sorted[items[0].dataIndex].title,
              label: (ctx) => {
                const c = sorted[ctx.dataIndex];
                return [
                  ` ${c.progress}% complete`,
                  ` Status: ${c.status}`,
                  ` Open tasks: ${openFor(c.code)}`
                ];
              }
            }
          }
        },
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: grid }, ticks: { callback: (v) => `${v}%` } },
          y: { grid: { display: false } }
        }
      }
    });

    const statusCounts = statusOrder.map((s) => tasks.filter((t) => t.status === s).length);
    const priorityCounts = priorityOrder.map((p) => tasks.filter((t) => t.priority === p).length);
    const openTasks = tasks.filter((t) => t.status !== 'Completed').length;

    const statusChart = new Chart(statusCanvas, {
      type: 'doughnut',
      data: {
        labels: statusOrder.map((s, i) => `${s} (${statusCounts[i]})`),
        datasets: [
          {
            label: 'Status',
            data: statusCounts,
            backgroundColor: statusOrder.map((s) => statusFill[s]),
            borderWidth: 0
          },
          {
            label: 'Priority',
            data: priorityCounts,
            backgroundColor: priorityOrder.map((p) => priorityFill[p]),
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '45%',
        color: text,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const names = ctx.datasetIndex === 0 ? statusOrder : priorityOrder;
                return ` ${ctx.dataset.label}: ${names[ctx.dataIndex]} (${ctx.parsed} task${ctx.parsed === 1 ? '' : 's'})`;
              }
            }
          }
        }
      },
      plugins: [centreLabel]
    });

    statusChart.$openTasks = openTasks;
    statusChart.update('none');

    charts = [progressChart, statusChart];
  };

  const render = () => {
    const user = EduTrack.getCurrentUser();
    const courses = EduStore.getCourses();
    const tasks = EduStore.getTasks();

    welcome.textContent = user.fullName.split(' ')[0];

    const openTasks = tasks.filter((t) => t.status !== 'Completed');
    const completedCount = tasks.length - openTasks.length;
    const avgProgress = courses.length
      ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length)
      : 0;

    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
    const overdueCount = openTasks.filter((t) => t.due < todayStr).length;

    const S = EduStore.summary();
    const stats = [
      {
        label: 'Courses', value: S.courses.all, variant: 'primary',
        note: `${S.courses.inProgress} in progress \u00b7 ${S.courses.completed} completed \u00b7 ${S.courses.notStarted} not started`
      },
      {
        label: 'Tasks open', value: S.tasks.open, variant: 'warning',
        note: `${S.tasks.overdue} overdue \u00b7 ${S.tasks.inProgress} in progress \u00b7 ${S.tasks.pending} pending`
      },
      {
        label: 'Tasks completed', value: S.tasks.completed, variant: 'success',
        note: `of ${S.tasks.all} tasks`
      },
      {
        label: 'Average progress', value: S.courses.averageProgress === null ? '\u2013' : `${S.courses.averageProgress}%`,
        variant: 'info', note: 'across all courses'
      }
    ];

    statCards.innerHTML = stats.map((s) => `
      <div class="col-6 col-lg-3">
        <div class="card stat-card text-bg-${s.variant} h-100 shadow-sm">
          <div class="card-body">
            <p class="stat-label mb-1">${s.label}</p>
            <p class="stat-value mb-0">${s.value}</p>
            ${s.note ? `<p class="small mb-0 mt-1">${s.note}</p>` : ''}
          </div>
        </div>
      </div>`).join('');

    const upcoming = [...openTasks].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);

    deadlineList.innerHTML = upcoming.length
      ? upcoming.map((t) => `
          <li class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <strong>${EduTrack.escapeHtml(t.title)}</strong>
              <div class="small ${t.due < todayStr ? 'text-danger' : 'text-muted'}">${EduTrack.escapeHtml(t.course)} &middot; ${EduStore.dueLabel(t.due)}</div>
            </div>
            <span class="badge text-bg-${priorityColour[t.priority]}">${t.priority} priority</span>
          </li>`).join('')
      : courses.length
        ? '<li class="list-group-item">No open tasks. Great work!</li>'
        : '<li class="list-group-item">You have no courses yet. <a href="courses.html">Add your first course</a> to get started.</li>';

    drawCharts(courses, tasks);
  };

  document.addEventListener('edutrack:data', render);
  document.addEventListener('edutrack:theme', render);
  render();
});
