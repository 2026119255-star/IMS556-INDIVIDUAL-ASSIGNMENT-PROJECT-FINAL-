/**
 * profile.js - View and edit the signed-in user's details and password.
 * Edits are stored through EduTrack.updateProfile; the top bar and
 * summary card refresh automatically.
 */
document.addEventListener('DOMContentLoaded', () => {
  if (!EduTrack.requireAuth()) return;

  const { markField, resetValidation } = EduTrack;

  const profileForm = document.getElementById('profile-form');
  const passwordForm = document.getElementById('password-form');
  const fields = {
    fullName: document.getElementById('field-fullname'),
    email: document.getElementById('field-email'),
    programme: document.getElementById('field-programme')
  };
  const pw = {
    current: document.getElementById('pw-current'),
    next: document.getElementById('pw-new'),
    confirm: document.getElementById('pw-confirm')
  };

  const initials = (name) =>
    name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  // Summary card: refreshed on every change
  const renderCard = () => {
    const user = EduTrack.getCurrentUser();
    document.getElementById('profile-initials').textContent = initials(user.fullName);
    document.getElementById('profile-name').textContent = user.fullName;
    document.getElementById('profile-username').textContent = `@${user.username}`;
    document.getElementById('profile-email').textContent = user.email || 'Not set';
    document.getElementById('profile-programme').textContent = user.programme || 'Not set';
  };

  // Form fields: filled once on load and after each save
  const fillForm = () => {
    const user = EduTrack.getCurrentUser();
    fields.fullName.value = user.fullName;
    fields.email.value = user.email || '';
    fields.programme.value = user.programme || '';
  };

  /* ---------- Personal details ---------- */

  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = fields.email.value.trim();
    const checks = [
      markField(fields.fullName, fields.fullName.value.trim().length >= 2,
        'Please enter your full name (at least 2 characters).'),
      markField(fields.email, email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        'Please enter a valid email address.'),
      markField(fields.programme, fields.programme.value.trim().length >= 2,
        'Please enter your programme.')
    ];

    if (checks.includes(false)) {
      EduTrack.toast('Please correct the highlighted fields.', 'warning');
      return;
    }

    const user = EduTrack.getCurrentUser();
    EduTrack.updateProfile(user.username, {
      fullName: fields.fullName.value.trim(),
      email,
      programme: fields.programme.value.trim()
    });

    resetValidation(profileForm);
    EduTrack.toast('Profile updated.');
  });

  /* ---------- Password ---------- */

  passwordForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const user = EduTrack.getCurrentUser();
    const currentOk = markField(pw.current,
      pw.current.value !== '' && EduTrack.validateCredentials(user.username, pw.current.value) !== null,
      pw.current.value === '' ? 'Please enter your current password.' : 'Your current password is incorrect.');

    const lengthOk = markField(pw.next, pw.next.value.length >= 6, 'Use at least 6 characters.');
    const differentOk = markField(pw.next, pw.next.value !== pw.current.value,
      'Choose a password different from the current one.');
    const confirmOk = markField(pw.confirm, pw.confirm.value !== '' && pw.confirm.value === pw.next.value,
      'Passwords do not match.');

    if (![currentOk, lengthOk, differentOk, confirmOk].every(Boolean)) {
      EduTrack.toast('Please correct the highlighted fields.', 'warning');
      return;
    }

    EduTrack.updateProfile(user.username, { password: pw.next.value });

    // Keep auto-saved sign-in details in step with the new password
    const saved = EduTrack.getSavedCredentials();
    if (saved && saved.username.toLowerCase() === user.username.toLowerCase()) {
      EduTrack.saveCredentials(saved.username, pw.next.value);
    }

    passwordForm.reset();
    resetValidation(passwordForm);
    EduTrack.toast('Password changed.');
  });

  document.addEventListener('edutrack:profile', () => {
    renderCard();
  });

  fillForm();
  renderCard();
});
