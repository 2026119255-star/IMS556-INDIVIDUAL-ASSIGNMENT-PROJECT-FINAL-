/**
 * auth.js - Sign-in, auto-save of credentials, and registration for login.html.
 */
document.addEventListener('DOMContentLoaded', () => {

  if (EduTrack.getSession()) {
    window.location.replace('index.html');
    return;
  }

  const alertBox = document.getElementById('alert-box');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const heading = document.getElementById('form-heading');
  const toggleText = document.getElementById('toggle-text');
  const toggleButton = document.getElementById('toggle-mode');

  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const rememberBox = document.getElementById('remember-me');
  const autosaveStatus = document.getElementById('autosave-status');
  const forgetButton = document.getElementById('forget-saved');

  const { markField, resetValidation } = EduTrack;

  /* ---------- Feedback ---------- */

  const showAlert = (message, type = 'danger') => {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
  };

  const hideAlert = () => alertBox.classList.add('d-none');

  const timeOf = (date = new Date()) =>
    date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  /* ---------- Auto-save of username and password ---------- */

  // Restore previously saved details
  const saved = EduTrack.getSavedCredentials();
  if (saved) {
    loginUsername.value = saved.username;
    loginPassword.value = saved.password;
    rememberBox.checked = true;
    autosaveStatus.textContent = `Saved details loaded (saved ${timeOf(new Date(saved.savedAt))}).`;
  }

  let autosaveTimer = null;

  // Debounced: saves 500 ms after the user stops typing
  const scheduleAutosave = () => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (!rememberBox.checked) {
        autosaveStatus.textContent = 'Auto-save is off.';
        return;
      }
      EduTrack.saveCredentials(loginUsername.value.trim(), loginPassword.value);
      autosaveStatus.textContent = `Auto-saved at ${timeOf()}.`;
    }, 500);
  };

  loginUsername.addEventListener('input', scheduleAutosave);
  loginPassword.addEventListener('input', scheduleAutosave);

  rememberBox.addEventListener('change', () => {
    if (rememberBox.checked) {
      EduTrack.saveCredentials(loginUsername.value.trim(), loginPassword.value);
      autosaveStatus.textContent = `Auto-save is on (saved at ${timeOf()}).`;
    } else {
      EduTrack.clearSavedCredentials();
      autosaveStatus.textContent = 'Auto-save is off. Saved details removed.';
    }
  });

  forgetButton.addEventListener('click', () => {
    EduTrack.clearSavedCredentials();
    loginUsername.value = '';
    loginPassword.value = '';
    rememberBox.checked = false;
    resetValidation(loginForm);
    autosaveStatus.textContent = 'Saved details forgotten.';
  });

  /* ---------- Switch between sign in and register ---------- */

  const setMode = (mode) => {
    const isLogin = mode === 'login';
    loginForm.classList.toggle('d-none', !isLogin);
    registerForm.classList.toggle('d-none', isLogin);
    heading.textContent = isLogin ? 'Sign in to your account' : 'Create a new account';
    toggleText.textContent = isLogin ? "Don't have an account?" : 'Already registered?';
    toggleButton.textContent = isLogin ? 'Create one' : 'Sign in';
    hideAlert();
  };

  toggleButton.addEventListener('click', () => {
    const showingLogin = !loginForm.classList.contains('d-none');
    setMode(showingLogin ? 'register' : 'login');
  });

  /* ---------- Sign in ---------- */

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    hideAlert();

    const fieldsValid = [
      markField(loginUsername, loginUsername.value.trim() !== '', 'Please enter your username.'),
      markField(loginPassword, loginPassword.value !== '', 'Please enter your password.')
    ].every(Boolean);

    if (!fieldsValid) {
      showAlert('Please fill in both fields to sign in.', 'warning');
      return;
    }

    const user = EduTrack.validateCredentials(loginUsername.value, loginPassword.value);

    if (!user) {
      markField(loginUsername, false, 'Check your username.');
      markField(loginPassword, false, 'Check your password.');
      showAlert('Invalid username or password. Please try again.', 'danger');
      loginPassword.value = '';
      loginPassword.focus();
      return;
    }

    // Keep or clear saved details according to the auto-save choice
    if (rememberBox.checked) {
      EduTrack.saveCredentials(user.username, loginPassword.value || user.password);
    } else {
      EduTrack.clearSavedCredentials();
    }

    EduTrack.login(user.username);
    window.location.href = 'index.html';
  });

  /* ---------- Register ---------- */

  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    hideAlert();

    const name = document.getElementById('reg-name');
    const username = document.getElementById('reg-username');
    const password = document.getElementById('reg-password');
    const confirm = document.getElementById('reg-confirm');

    const valid = {
      name: markField(name, name.value.trim().length >= 2, 'Please enter your full name (at least 2 characters).'),
      username: markField(username, /^[A-Za-z0-9_]{3,20}$/.test(username.value.trim()),
        'Use 3 to 20 letters, numbers or underscores.'),
      password: markField(password, password.value.length >= 6, 'Password must be at least 6 characters.'),
      confirm: markField(confirm, confirm.value !== '' && confirm.value === password.value,
        'Passwords do not match.')
    };

    if (valid.username && EduTrack.findUser(username.value)) {
      valid.username = markField(username, false, 'That username is already taken.');
    }

    if (Object.values(valid).includes(false)) {
      showAlert('Please correct the highlighted fields.', 'warning');
      return;
    }

    EduTrack.registerUser({
      fullName: name.value.trim(),
      username: username.value.trim(),
      password: password.value
    });

    loginUsername.value = username.value.trim();
    registerForm.reset();
    resetValidation(registerForm);
    setMode('login');
    showAlert('Account created successfully. Please sign in.', 'success');
  });
});
