/**
 * store.js - Data layer for courses, tasks and chat messages.
 *
 * Tasks are the single source of truth. Each task has a percent complete
 * (0 to 100), and its status follows from that percent:
 *   0%        Pending
 *   1 to 99%  In Progress
 *   100%      Completed
 *
 * A course's progress is the average percent of its tasks. Setting a course
 * to a percent sets each of its tasks to that percent, so the course shows
 * exactly the number that was typed in.
 *
 * Every write fires "edutrack:data", and changes made in another open tab
 * fire it too, so all open pages refresh straight away.
 */
const EduStore = (() => {

  const KEYS = {
    courses: 'edutrack.courses',
    tasks: 'edutrack.tasks',
    messages: 'edutrack.messages'
  };

  // Percent used when a task is moved to a status by a button or the edit form
  const STATUS_PERCENT = { Pending: 0, 'In Progress': 50, Completed: 100 };

  const clampPercent = (n) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));
  const statusFromPercent = (p) => (p >= 100 ? 'Completed' : p > 0 ? 'In Progress' : 'Pending');

  // Every task has a percent and a matching status, even older saved data
  const normaliseTask = (t) => {
    const percent = typeof t.percent === 'number'
      ? clampPercent(t.percent)
      : (STATUS_PERCENT[t.status] ?? 0);
    return { ...t, percent, status: statusFromPercent(percent) };
  };

  const read = (key, seed) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? structuredClone(seed) : JSON.parse(raw);
    } catch (error) {
      console.warn(`Could not read ${key}; falling back to sample data.`, error);
      return structuredClone(seed);
    }
  };

  const notify = () => document.dispatchEvent(new CustomEvent('edutrack:data'));

  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    notify();
  };

  const newId = (prefix) =>
    `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const today = () => new Date().toISOString().slice(0, 10);

  const getStoredCourses = () => read(KEYS.courses, EDUTRACK_DATA.courses);
  const getTasks = () => read(KEYS.tasks, EDUTRACK_DATA.tasks).map(normaliseTask);

  /* ---------- Summaries used by every page ---------- */

  // One place that defines done, in progress, to do, progress and status
  const summarise = (mine) => {
    const total = mine.length;
    const sum = mine.reduce((s, t) => s + t.percent, 0);
    const done = mine.filter((t) => t.status === 'Completed').length;
    const started = mine.filter((t) => t.status === 'In Progress').length;
    return {
      taskCount: total,
      doneCount: done,
      inProgressCount: started,
      todoCount: total - done - started,
      progress: Math.round(sum / total),
      status: done === total ? 'Completed' : done + started > 0 ? 'In Progress' : 'Not Started'
    };
  };

  const deriveCourse = (course, tasks) => {
    const mine = tasks.filter((t) => t.course === course.code);
    if (!mine.length) {
      // No tasks: the typed-in percent is kept, and status follows it
      const progress = clampPercent(course.progress);
      const status = progress >= 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started';
      return { ...course, progress, status, taskCount: 0, doneCount: 0, inProgressCount: 0, todoCount: 0, derived: false };
    }
    return { ...course, ...summarise(mine), derived: true };
  };

  /* ---------- Courses ---------- */

  const getCourses = () => {
    const tasks = getTasks();
    return getStoredCourses().map((c) => deriveCourse(c, tasks));
  };

  const addCourse = (data) => {
    const course = { id: newId('c'), lastUpdated: today(), ...data };
    write(KEYS.courses, [...getStoredCourses(), course]);
    return course;
  };

  // Renaming a course code moves its tasks with it
  const updateCourse = (id, data) => {
    const stored = getStoredCourses();
    const old = stored.find((c) => c.id === id);

    if (old && data.code && data.code !== old.code) {
      write(KEYS.tasks, getTasks().map((t) =>
        t.course === old.code ? { ...t, course: data.code } : t));
    }

    write(KEYS.courses, getStoredCourses().map((c) =>
      c.id === id ? { ...c, ...data, lastUpdated: today() } : c));
  };

  // Deleting a course also deletes its tasks
  const deleteCourse = (id) => {
    const course = getStoredCourses().find((c) => c.id === id);
    if (course) {
      write(KEYS.tasks, getTasks().filter((t) => t.course !== course.code));
    }
    write(KEYS.courses, getStoredCourses().filter((c) => c.id !== id));
  };

  /* ---------- Setting a course's percent updates its tasks ---------- */

  // What the course will show after saving a percent. Null if it has no tasks.
  const previewProgress = (courseCode, percent) => {
    const mine = getTasks()
      .filter((t) => t.course === courseCode)
      .map((t) => normaliseTask({ ...t, percent: clampPercent(percent) }));
    return mine.length ? summarise(mine) : null;
  };

  // Saves a percent by setting every task of the course to it
  const applyProgress = (courseCode, percent) => {
    const tasks = getTasks();
    if (!tasks.some((t) => t.course === courseCode)) return false;
    const value = clampPercent(percent);
    write(KEYS.tasks, tasks.map((t) =>
      t.course === courseCode ? normaliseTask({ ...t, percent: value }) : t));
    return true;
  };

  /* ---------- Tasks ---------- */

  const addTask = (data) => {
    const task = normaliseTask({ id: newId('t'), ...data });
    write(KEYS.tasks, [...getTasks(), task]);
    return task;
  };

  // Changing the status sets the matching percent. Saving other fields,
  // such as the title, keeps the current percent.
  const updateTask = (id, data) => write(KEYS.tasks, getTasks().map((t) => {
    if (t.id !== id) return t;
    const change = { ...data };
    if (change.status !== undefined && change.percent === undefined && change.status !== t.status) {
      change.percent = STATUS_PERCENT[change.status];
    }
    return normaliseTask({ ...t, ...change });
  }));

  const deleteTask = (id) =>
    write(KEYS.tasks, getTasks().filter((t) => t.id !== id));

  /* ---------- Plain-English due dates, used on every page ---------- */

  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Whole days from today to a YYYY-MM-DD date (negative means overdue)
  const daysUntil = (due) =>
    Math.round((new Date(`${due}T00:00:00`) - startOfToday()) / 86400000);

  const dueLabel = (due) => {
    const d = daysUntil(due);
    if (d < -1) return `overdue by ${-d} days`;
    if (d === -1) return 'overdue by 1 day';
    if (d === 0) return 'due today';
    if (d === 1) return 'due tomorrow';
    return `due in ${d} days`;
  };

  /* ---------- Chat messages ---------- */

  const getMessages = () => read(KEYS.messages, []);

  const addMessage = ({ channel, author, text }) => {
    const message = { id: newId('m'), channel, author, text, time: new Date().toISOString() };
    write(KEYS.messages, [...getMessages(), message]);
    return message;
  };

  const clearChannel = (channel) =>
    write(KEYS.messages, getMessages().filter((m) => m.channel !== channel));

  /* ---------- Reset ---------- */

  const resetAll = () => {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    notify();
  };

  /* ---------- Live refresh across open tabs ---------- */

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('storage', (event) => {
      if (event.key && Object.values(KEYS).includes(event.key)) notify();
    });
  }

  /* ---------- One summary for every page, so the numbers always match ---------- */

  // Local date as YYYY-MM-DD, so "overdue" is judged by the user's own day
  const todayKey = () => new Date().toLocaleDateString('en-CA');

  // Counts shown on the Dashboard, the Courses page and the Tasks page.
  // Each page labels these the same way, so they can be checked against each other.
  const summary = () => {
    const courses = getCourses();
    const tasks = getTasks();
    const today = todayKey();
    const countIf = (list, test) => list.filter(test).length;

    const pending = countIf(tasks, (t) => t.status === 'Pending');
    const inProgress = countIf(tasks, (t) => t.status === 'In Progress');
    const completed = countIf(tasks, (t) => t.status === 'Completed');

    return {
      courses: {
        all: courses.length,
        inProgress: countIf(courses, (c) => c.status === 'In Progress'),
        completed: countIf(courses, (c) => c.status === 'Completed'),
        notStarted: countIf(courses, (c) => c.status === 'Not Started'),
        averageProgress: courses.length
          ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length)
          : null
      },
      tasks: {
        all: tasks.length,
        pending,
        inProgress,
        completed,
        open: pending + inProgress,
        overdue: countIf(tasks, (t) => t.status !== 'Completed' && t.due < today)
      }
    };
  };

  return {
    getCourses, addCourse, updateCourse, deleteCourse,
    summary,
    previewProgress, applyProgress,
    getTasks, addTask, updateTask, deleteTask,
    STATUS_PERCENT,
    dueLabel,
    getMessages, addMessage, clearChannel,
    resetAll
  };
})();
