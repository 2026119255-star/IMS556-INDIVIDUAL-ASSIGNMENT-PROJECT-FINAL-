/**
 * common.js - Shared behaviour for every EduTrack page.
 *
 * Navigation design (one system, no competing menus):
 *   - A single three-line hamburger opens one off-canvas panel on every screen size.
 *   - The panel is a multi-level accordion built from one menu definition (buildMenu).
 *   - Menu actions (log out, restore, forget) run through one click handler.
 *
 * Also covers: simulated authentication, route guard, saved sign-in details,
 * theme switching, footer, form validation, toasts and a confirmation dialog.
 */
const EduTrack = (() => {

  const SESSION_KEY = 'edutrack.session';          // signed-in username (localStorage, so new tabs stay signed in)
  const USERS_KEY = 'edutrack.users';              // registered users (localStorage)
  const SAVED_KEY = 'edutrack.savedCredentials';   // auto-saved sign-in details (localStorage)
  const THEME_KEY = 'edutrack.theme';              // 'light' or 'dark' (localStorage)

  /* ---------- Helpers ---------- */

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));

  const formatDate = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });

  const currentPage = () => window.location.pathname.split('/').pop() || 'index.html';

  // Pages that require a signed-in user declare data-protected="true" on <body>
  const isProtectedPage = () => document.body.dataset.protected === 'true';

  /* ---------- Theme (light / dark) ---------- */

  const getTheme = () => document.documentElement.getAttribute('data-bs-theme') || 'light';

  const toggleTheme = () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    localStorage.setItem(THEME_KEY, next);
    document.dispatchEvent(new CustomEvent('edutrack:theme', { detail: next }));
    return next;
  };

  /* ---------- Simulated authentication ---------- */

  const getRegisteredUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || '[]');

  const PROFILE_KEY = 'edutrack.profiles';         // profile and password edits (localStorage)

  const getProfileOverrides = () => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
    } catch {
      return {};
    }
  };

  // Demo and registered users, with any saved profile edits applied on top
  const getAllUsers = () => {
    const overrides = getProfileOverrides();
    return [...EDUTRACK_DATA.auth.demoUsers, ...getRegisteredUsers()].map((u) => ({
      ...u,
      ...(overrides[u.username.toLowerCase()] || {})
    }));
  };

  const updateProfile = (username, changes) => {
    const key = username.toLowerCase();
    const overrides = getProfileOverrides();
    overrides[key] = { ...(overrides[key] || {}), ...changes };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(overrides));
    document.dispatchEvent(new CustomEvent('edutrack:profile'));
  };

  const findUser = (username) =>
    getAllUsers().find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

  const validateCredentials = (username, password) => {
    const user = findUser(username);
    return user && user.password === password ? user : null;
  };

  const registerUser = ({ fullName, username, password }) => {
    const users = getRegisteredUsers();
    users.push({ fullName, username: username.trim(), password });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  };

  const login = (username) => localStorage.setItem(SESSION_KEY, findUser(username).username);
  const logout = () => localStorage.removeItem(SESSION_KEY);
  const getSession = () => localStorage.getItem(SESSION_KEY);

  const getCurrentUser = () => {
    const name = getSession();
    return name ? findUser(name) : null;
  };

  const requireAuth = () => {
    if (!getSession()) {
      window.location.replace('login.html');
      return false;
    }
    return true;
  };

  /* ---------- Auto-saved sign-in details ---------- */

  const getSavedCredentials = () => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY));
    } catch {
      return null;
    }
  };

  const saveCredentials = (username, password) =>
    localStorage.setItem(SAVED_KEY, JSON.stringify({
      username, password, savedAt: new Date().toISOString()
    }));

  const clearSavedCredentials = () => localStorage.removeItem(SAVED_KEY);

  /* ---------- Form validation ---------- */

  const markField = (input, isValid, message = '') => {
    input.classList.toggle('is-invalid', !isValid);
    input.classList.toggle('is-valid', isValid && input.value.trim() !== '');
    const feedback = input.parentElement.querySelector('.invalid-feedback');
    if (feedback && !isValid && message) feedback.textContent = message;
    return isValid;
  };

  const resetValidation = (form) =>
    form.querySelectorAll('.is-valid, .is-invalid')
      .forEach((el) => el.classList.remove('is-valid', 'is-invalid'));

  /* ---------- Feedback: toasts and confirmation ---------- */

  const toast = (message, variant = 'success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      container.style.zIndex = '1100';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${variant} border-0`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto"
                data-bs-dismiss="toast" aria-label="Close"></button>
      </div>`;
    container.appendChild(el);

    const instance = new bootstrap.Toast(el, { delay: 3000 });
    el.addEventListener('hidden.bs.toast', () => el.remove());
    instance.show();
  };

  // Resolves true if confirmed, false if cancelled
  const confirmDialog = (message, confirmLabel = 'Delete') => new Promise((resolve) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'modal fade';
    wrapper.tabIndex = -1;
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5">Please confirm</h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">${escapeHtml(message)}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" data-action="confirm">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrapper);

    const modal = new bootstrap.Modal(wrapper);
    let confirmed = false;

    wrapper.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      confirmed = true;
      modal.hide();
    });
    wrapper.addEventListener('hidden.bs.modal', () => {
      resolve(confirmed);
      wrapper.remove();
    });

    modal.show();
  });

  /* ---------- Navigation: one menu definition ----------
     Every link, group and action comes from buildMenu(). The menu changes
     with sign-in state and always reflects the stored courses. */

  const buildMenu = () => {
    if (!getSession()) {
      return [{ label: 'Sign in', icon: 'bi-box-arrow-in-right', href: 'login.html' }];
    }

    const courses = EduStore.getCourses();
    const noCourses = [{ label: 'No courses yet', href: 'courses.html' }];

    return [
      { label: 'Home', icon: 'bi-house-door', href: 'index.html' },
      {
        label: 'Courses', icon: 'bi-journal-bookmark', children: courses.length
          ? courses.map((c) => ({
              label: `${c.code} · ${c.title}`,
              href: `courses.html?course=${encodeURIComponent(c.code)}`
            }))
          : noCourses
      },
      {
        label: 'Tasks', icon: 'bi-check2-square', children: courses.length
          ? courses.map((c) => ({
              label: `${c.code} tasks`,
              href: `tasks.html?course=${encodeURIComponent(c.code)}`
            }))
          : noCourses.map((l) => ({ ...l, href: 'tasks.html' }))
      },
      {
        label: 'Study chat', icon: 'bi-chat-dots', children: [
          { label: 'General channel', href: 'chat.html?channel=general' },
          ...courses.map((c) => ({ label: `#${c.code}`, href: `chat.html?channel=${encodeURIComponent(c.code)}` }))
        ]
      },
      {
        label: 'Account', icon: 'bi-person-circle', children: [
          { label: 'My profile', icon: 'bi-person-lines-fill', href: 'profile.html' },
          { label: 'Restore sample data', icon: 'bi-arrow-counterclockwise', action: 'restore' },
          { label: 'Forget saved sign-in', icon: 'bi-key', action: 'forget' },
          { label: 'Log out', icon: 'bi-box-arrow-right', action: 'logout', danger: true }
        ]
      }
    ];
  };

  // A link is active when its page matches and its query parameters match the URL
  const isActive = (href) => {
    const [path, query = ''] = href.split('?');
    if (path !== currentPage()) return false;
    const want = new URLSearchParams(query);
    const have = new URLSearchParams(window.location.search);
    for (const [key, value] of want) {
      if (have.get(key) !== value) return false;
    }
    if (!query) return !have.has('status') && !have.has('channel');
    return true;
  };

  // True if any link inside this group (at any depth) is the current page
  const containsActive = (item) =>
    item.children ? item.children.some(containsActive) : Boolean(item.href && isActive(item.href));

  // Recursively renders the menu as nested, collapsible groups
  const menuMarkup = (items, prefix = 'nav') => `
    <ul class="site-menu-list list-unstyled m-0">
      ${items.map((item, index) => {
        const icon = item.icon ? `<i class="bi ${item.icon}" aria-hidden="true"></i>` : '';

        if (!item.children) {
          if (item.action) {
            return `
              <li>
                <button type="button" class="site-menu-link${item.danger ? ' is-danger' : ''}"
                        data-menu-action="${item.action}">${icon}<span>${escapeHtml(item.label)}</span></button>
              </li>`;
          }
          const active = isActive(item.href);
          return `
            <li>
              <a class="site-menu-link${active ? ' is-active' : ''}" href="${item.href}"
                 ${active ? 'aria-current="page"' : ''}>${icon}<span>${escapeHtml(item.label)}</span></a>
            </li>`;
        }

        const id = `${prefix}-${index}`;
        return `
          <li>
            <button type="button" class="site-menu-link site-menu-toggle" data-bs-toggle="collapse"
                    data-bs-target="#${id}" aria-expanded="${containsActive(item)}" aria-controls="${id}">
              ${icon}<span>${escapeHtml(item.label)}</span>
              <i class="bi bi-chevron-down chevron" aria-hidden="true"></i>
            </button>
            <div class="collapse${containsActive(item) ? ' show' : ''}" id="${id}">${menuMarkup(item.children, id)}</div>
          </li>`;
      }).join('')}
    </ul>`;

  const setHamburger = (open) =>
    document.querySelector('.hamburger')?.setAttribute('aria-expanded', String(open));

  const ensureMenuPanel = () => {
    if (document.getElementById('siteMenu')) return;

    const panel = document.createElement('div');
    panel.className = 'offcanvas offcanvas-start site-menu';
    panel.id = 'siteMenu';
    panel.tabIndex = -1;
    panel.setAttribute('aria-labelledby', 'siteMenuTitle');
    panel.innerHTML = `
      <div class="offcanvas-header">
        <div class="d-flex align-items-center gap-2">
          <img src="assets/logo.svg" alt="" width="30" height="30">
          <h2 class="offcanvas-title h6 mb-0" id="siteMenuTitle">EduTrack</h2>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close menu"></button>
      </div>
      <div class="offcanvas-body p-0">
        <nav id="siteMenuBody" aria-label="Main navigation"></nav>
      </div>`;
    document.body.appendChild(panel);

    panel.addEventListener('show.bs.offcanvas', () => setHamburger(true));
    panel.addEventListener('hidden.bs.offcanvas', () => setHamburger(false));
  };

  // One menu definition feeds the hamburger panel
  const renderMenu = () => {
    ensureMenuPanel();

    const items = buildMenu();
    document.getElementById('siteMenuBody').innerHTML = menuMarkup(items, 'nav');

  };

  const hideMenu = () => {
    const panel = document.getElementById('siteMenu');
    if (panel) bootstrap.Offcanvas.getInstance(panel)?.hide();
  };

  /* ---------- Top bar navigation (desktop); phones use the hamburger menu ---------- */

  const dropdownItem = (label, href) => {
    const active = isActive(href);
    return `<li><a class="dropdown-item${active ? ' active' : ''}" href="${href}"
                  ${active ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a></li>`;
  };

  const topDropdown = (label, page, entries) => `
    <div class="dropdown">
      <button class="top-link dropdown-toggle${currentPage() === page ? ' is-active' : ''}" type="button"
              data-bs-toggle="dropdown" aria-expanded="false">${label}</button>
      <ul class="dropdown-menu dropdown-menu-dark top-dropdown">${entries}</ul>
    </div>`;

  const topLinksMarkup = () => {
    // Top bar dropdowns show status views; the hamburger lists the individual courses
    const courseStatuses = [
      ['In progress', 'courses.html?status=In%20Progress'],
      ['Completed', 'courses.html?status=Completed'],
      ['Not started', 'courses.html?status=Not%20Started']
    ].map(([label, href]) => dropdownItem(label, href)).join('');

    const taskStatuses = [
      ['Pending', 'tasks.html?status=Pending'],
      ['In progress', 'tasks.html?status=In%20Progress'],
      ['Completed', 'tasks.html?status=Completed']
    ].map(([label, href]) => dropdownItem(label, href)).join('');

    return `
      <a class="top-link${currentPage() === 'index.html' ? ' is-active' : ''}" href="index.html"
         ${currentPage() === 'index.html' ? 'aria-current="page"' : ''}>Home</a>
      ${topDropdown('Courses', 'courses.html', courseStatuses)}
      ${topDropdown('Tasks', 'tasks.html', taskStatuses)}
      <a class="top-link${currentPage() === 'profile.html' ? ' is-active' : ''}" href="profile.html"
         ${currentPage() === 'profile.html' ? 'aria-current="page"' : ''}>Profile</a>`;
  };

  /* ---------- Top bar ---------- */

  const renderTopbar = () => {
    const host = document.getElementById('topbar');
    if (!host) return;

    const dark = getTheme() === 'dark';
    const user = getCurrentUser();
    const onLoginPage = currentPage() === 'login.html';

    host.innerHTML = `
      <nav class="navbar app-topbar" aria-label="Top bar">
        <div class="container-fluid px-3 px-lg-4 d-flex align-items-center gap-3">

          <button type="button" class="hamburger" data-bs-toggle="offcanvas" data-bs-target="#siteMenu"
                  aria-controls="siteMenu" aria-expanded="false" aria-label="Open main menu">
            <span></span><span></span><span></span>
          </button>

          <a class="navbar-brand d-flex align-items-center gap-2 mb-0" href="index.html">
            <img src="assets/logo.svg" alt="" width="30" height="30">
            <span class="brand-name">EduTrack</span>
          </a>

          ${user ? `<nav class="top-links d-none d-lg-flex align-items-center gap-1" aria-label="Quick navigation">${topLinksMarkup()}</nav>` : ''}

          <div class="ms-auto d-flex align-items-center gap-2">
            <button id="theme-toggle" class="btn btn-theme btn-sm" type="button"
                    aria-label="Switch to ${dark ? 'light' : 'dark'} mode">
              <i class="bi ${dark ? 'bi-sun' : 'bi-moon-stars'}" aria-hidden="true"></i>
              <span class="d-none d-sm-inline ms-1">${dark ? 'Light' : 'Dark'}</span>
            </button>
            ${user
              ? `<a class="user-chip d-none d-md-inline-flex text-decoration-none" href="profile.html">
                   <i class="bi bi-person-circle" aria-hidden="true"></i>${escapeHtml(user.fullName)}
                 </a>`
              + `<button type="button" class="btn btn-outline-light btn-sm" data-menu-action="logout">Log out</button>`
              : (onLoginPage ? '' : '<a class="btn btn-light btn-sm fw-semibold" href="login.html">Sign in</a>')}
          </div>

        </div>
      </nav>`;

    host.classList.add('sticky-top');
  };

  /* ---------- Footer ---------- */

  const renderFooter = () => {
    const footer = document.getElementById('site-footer');
    if (!footer) return;

    footer.innerHTML = `
      <footer class="app-footer mt-auto py-4">
        <div class="container d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 small">
          <span>&copy; ${new Date().getFullYear()} ${EDUTRACK_DATA.site.name} Student Portal. All rights reserved.</span>
        </div>
      </footer>`;
  };

  /* ---------- Menu actions and events ---------- */

  const runMenuAction = async (action) => {
    hideMenu();
    await new Promise((resolve) => setTimeout(resolve, 300)); // let the panel close first

    if (action === 'logout') {
      logout();
      window.location.replace('login.html');
    } else if (action === 'forget') {
      clearSavedCredentials();
      toast('Saved sign-in details removed.');
    } else if (action === 'restore') {
      const ok = await confirmDialog(
        'Restore the original sample courses and tasks? Your changes and chat history will be removed.',
        'Restore'
      );
      if (ok) {
        EduStore.resetAll();
        toast('Sample data restored.');
      }
    }
  };

  const courseKey = () => EduStore.getCourses().map((c) => `${c.id}:${c.code}`).join('|');

  const bindEvents = () => {
    document.addEventListener('click', (event) => {
      if (event.target.closest('#theme-toggle')) {
        toggleTheme();
        renderTopbar();
        return;
      }

      const action = event.target.closest('[data-menu-action]');
      if (action) runMenuAction(action.dataset.menuAction);
    });

    // Profile edits refresh the top bar name
    document.addEventListener('edutrack:profile', renderTopbar);

    // Rebuild the menu only when the course list changes (keeps open groups stable)
    let lastKey = courseKey();
    document.addEventListener('edutrack:data', () => {
      const key = courseKey();
      if (key !== lastKey) {
        lastKey = key;
        renderMenu();
        renderTopbar();
      }
    });
  };

  /* ---------- Initialisation ---------- */

  const init = () => {
    if (isProtectedPage() && !requireAuth()) return;

    renderTopbar();
    renderMenu();
    renderFooter();
    bindEvents();
  };

  document.addEventListener('DOMContentLoaded', init);

  return {
    escapeHtml, formatDate, currentPage,
    getTheme, toggleTheme,
    findUser, validateCredentials, registerUser,
    login, logout, getSession, getCurrentUser, requireAuth,
    getSavedCredentials, saveCredentials, clearSavedCredentials,
    markField, resetValidation,
    toast, confirmDialog, updateProfile
  };
})();
