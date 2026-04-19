// ============================================================
// auth.js — Shared authentication module
// Handles: login check, session token, single-device enforcement,
//          12-hour expiry, profile dropdown, logout
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
// Replace with your Google Apps Script Web App URL
const AUTH_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyyEj3YdS_u1goBRL12xM56_EY8_I9qtWx44v1Y3CR5joUhGcfLDe50er0URV6USFgcSA/exec',
  SESSION_KEY: 'gis_session',
  SESSION_DURATION_MS: 12 * 60 * 60 * 1000, // 12 hours
  CHECK_INTERVAL_MS: 60 * 1000,              // poll every 60s for single-session enforcement
};

// ── HELPERS ─────────────────────────────────────────────────
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_CONFIG.SESSION_KEY)); }
  catch { return null; }
}
function setSession(data) {
  sessionStorage.setItem(AUTH_CONFIG.SESSION_KEY, JSON.stringify(data));
}
function clearSession() {
  sessionStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
}
function isSessionValid(session) {
  if (!session || !session.token || !session.expiry) return false;
  return Date.now() < session.expiry;
}

// ── REDIRECT TO LOGIN ────────────────────────────────────────
function redirectToLogin() {
  clearSession();
  const current = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `login.html?redirect=${current}`;
}

// ── VERIFY SESSION WITH SERVER ───────────────────────────────
async function verifySession(session) {
  try {
    const res = await fetch(`${AUTH_CONFIG.APPS_SCRIPT_URL}?action=verify&token=${encodeURIComponent(session.token)}&username=${encodeURIComponent(session.username)}`);
    const data = await res.json();
    return data.valid === true;
  } catch {
    // On network error, trust local session (offline graceful)
    return true;
  }
}

// ── LOGOUT ───────────────────────────────────────────────────
async function logout(redirect = true) {
  const session = getSession();
  if (session && session.token) {
    try {
      await fetch(`${AUTH_CONFIG.APPS_SCRIPT_URL}?action=logout&token=${encodeURIComponent(session.token)}&username=${encodeURIComponent(session.username)}`);
    } catch {}
  }
  clearSession();
  if (redirect) redirectToLogin();
}

// ── INJECT PROFILE WIDGET INTO HEADER ───────────────────────
function injectProfileWidget(username) {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  const widget = document.createElement('div');
  widget.className = 'profile-widget';
  widget.innerHTML = `
    <button class="profile-btn" id="profileBtn" title="${username}">
      <div class="profile-avatar">${username.charAt(0).toUpperCase()}</div>
      <span class="profile-name">${username}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="profile-dropdown" id="profileDropdown">
      <div class="profile-dropdown-header">
        <div class="profile-avatar-lg">${username.charAt(0).toUpperCase()}</div>
        <div>
          <div class="profile-dropdown-name">${username}</div>
          <div class="profile-dropdown-sub">Active session</div>
        </div>
      </div>
      <div class="profile-dropdown-divider"></div>
      <button class="profile-dropdown-item logout-item" onclick="logout()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sign out
      </button>
    </div>
  `;
  // Insert before theme button
  const themeBtn = headerRight.querySelector('.theme-btn');
  if (themeBtn) headerRight.insertBefore(widget, themeBtn);
  else headerRight.appendChild(widget);

  // Toggle dropdown
  document.getElementById('profileBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('profileDropdown').classList.toggle('open');
  });
  document.addEventListener('click', () => {
    const dd = document.getElementById('profileDropdown');
    if (dd) dd.classList.remove('open');
  });
}

// ── INJECT PROFILE STYLES ────────────────────────────────────
function injectProfileStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .profile-widget{position:relative;}
    .profile-btn{display:flex;align-items:center;gap:7px;background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:6px;padding:4px 10px 4px 6px;cursor:pointer;color:var(--text-muted);font-family:'Sora',sans-serif;font-size:.75rem;transition:all .15s;}
    .profile-btn:hover{border-color:var(--accent);color:var(--text);}
    .profile-avatar{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#1a6fe6,#58a6ff);color:#fff;font-size:.65rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Sora',sans-serif;}
    .profile-name{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .profile-dropdown{position:absolute;top:calc(100% + 8px);right:0;background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:10px;min-width:200px;box-shadow:0 16px 40px rgba(0,0,0,.35);opacity:0;transform:translateY(-6px) scale(.97);pointer-events:none;transition:opacity .15s,transform .15s;z-index:999;}
    .profile-dropdown.open{opacity:1;transform:none;pointer-events:auto;}
    .profile-dropdown-header{display:flex;align-items:center;gap:10px;padding:14px 14px 12px;}
    .profile-avatar-lg{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#1a6fe6,#58a6ff);color:#fff;font-size:.9rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Sora',sans-serif;}
    .profile-dropdown-name{font-size:.82rem;font-weight:600;color:var(--text);}
    .profile-dropdown-sub{font-size:.7rem;color:var(--text-dim);margin-top:1px;}
    .profile-dropdown-divider{height:1px;background:var(--panel-border);margin:0;}
    .profile-dropdown-item{display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;background:none;border:none;cursor:pointer;color:var(--text-muted);font-family:'Sora',sans-serif;font-size:.78rem;transition:background .12s,color .12s;border-radius:0 0 10px 10px;}
    .profile-dropdown-item:hover{background:var(--hover);}
    .logout-item:hover{color:var(--accent3) !important;}
  `;
  document.head.appendChild(style);
}

// ── MAIN AUTH GUARD ──────────────────────────────────────────
async function requireAuth() {
  const session = getSession();

  if (!isSessionValid(session)) {
    redirectToLogin();
    return;
  }

  // Verify with server (single-session check)
  const valid = await verifySession(session);
  if (!valid) {
    redirectToLogin();
    return;
  }

  // Inject profile UI
  injectProfileStyles();
  // Wait for DOM ready if needed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => injectProfileWidget(session.username));
  } else {
    injectProfileWidget(session.username);
  }

  // Periodic single-session polling
  setInterval(async () => {
    const s = getSession();
    if (!isSessionValid(s)) { redirectToLogin(); return; }
    const ok = await verifySession(s);
    if (!ok) {
      alert('You have been signed out because your account was accessed from another device or window.');
      redirectToLogin();
    }
  }, AUTH_CONFIG.CHECK_INTERVAL_MS);
}