/* Google login with session persistence, auto-login, and responsive header controls. */
(() => {
  'use strict';
  const STORAGE_KEY = 'ntic_report_session_v1';
  let token = '', expires = 0, waiters = [], validator, initializing = false, accessTransport, pendingToken = '', pollTimer, checking = false;
  let currentUser = null;

  function saveSession(cred, expMs) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: cred, expires: expMs })); } catch (_) {}
  }
  function loadSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.token && data.expires > Date.now() + 30000) return data;
    } catch (_) {}
    return null;
  }
  function clearSession() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function overlay() {
    let dialog = document.getElementById('reportLogin');
    if (dialog) return dialog;
    dialog = document.createElement('section');
    dialog.id = 'reportLogin';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'reportLoginTitle');
    dialog.style.cssText = 'position:fixed;inset:0;z-index:30000;background:#f8fafc;display:grid;place-items:center;padding:20px;font:15px/1.6 Inter,system-ui;color:#0f172a';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(100%,420px);padding:28px;background:white;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 24px #0f172a0d;text-align:center';
    card.innerHTML = '<h1 id="reportLoginTitle" style="font-size:20px;margin:0 0 12px">NTIC 報告記録</h1><p>Googleアカウントでログインしてください。初めての方はログイン後にアクセスを申請できます。<br>Sign in with Google. New users can request access after signing in.</p><div id="reportGoogleButton" style="display:flex;justify-content:center;min-height:44px"></div><p id="reportLoginMessage" role="status" style="font-size:13px;color:#64748b"></p><button id="reportLoginReload" type="button" hidden style="min-height:44px;margin:0 0 12px;padding:8px 16px">再読み込み / Reload</button><br><a href="privacy.html" style="font-size:12px;color:#64748b">プライバシー / Privacy</a>';
    card.querySelector('#reportLoginReload').onclick = () => location.reload();
    const request = document.createElement('button');
    request.id = 'reportRequestAccess';
    request.type = 'button';
    request.hidden = true;
    request.textContent = 'アクセス申請 / Request access';
    request.style.cssText = 'min-height:44px;padding:10px 18px;margin:8px';
    request.onclick = async () => {
      request.disabled = true;
      try {
        const state = await accessTransport('requestReportAccess', [], pendingToken);
        showPending(state);
        if (state.notificationSent === false) message('申請は保存されましたが、管理者への通知を送信できませんでした。5分後にもう一度申請してください。 / Your request was saved, but the notification could not be sent. Try requesting again in 5 minutes.');
      } catch (error) {
        message('アクセスを申請できませんでした。時間をおいて再度お試しいただくか、管理者にお問い合わせください。 / Could not request access. Try again later or contact the administrator.', true);
      } finally {
        request.disabled = false;
      }
    };
    card.querySelector('#reportLoginMessage').before(request);
    dialog.append(card);
    document.body.append(dialog);
    return dialog;
  }

  function message(text, retry = false) {
    const box = overlay();
    box.querySelector('#reportLoginMessage').textContent = text;
    box.querySelector('#reportLoginReload').hidden = !retry;
  }

  function removeHeaderControls() {
    document.getElementById('reportHeaderActions')?.remove();
    document.getElementById('reportAccessPanel')?.remove();
  }

  function lock() {
    token = '';
    expires = 0;
    pendingToken = '';
    currentUser = null;
    clearSession();
    clearTimeout(pollTimer);
    removeHeaderControls();
    const box = overlay();
    box.querySelector('#reportRequestAccess').hidden = true;
    box.hidden = false;
    box.style.display = 'grid';
    document.querySelector('.container')?.setAttribute('inert', '');
  }

  function showPending(user) {
    const request = overlay().querySelector('#reportRequestAccess');
    request.hidden = user.status === 'rejected';
    message(user.status === 'rejected'
      ? 'アクセスは許可されていません。管理者にお問い合わせください。 / Access has not been granted. Please contact the administrator.'
      : user.status === 'pending'
        ? '管理者の承認を待っています。承認後、自動的にアプリが開きます。 / Awaiting administrator approval. The app will open automatically once approved.'
        : user.email + ' のアクセスはまだ許可されていません。「アクセス申請」を押してください。 / This account is not yet authorized. Select Request access to contact the administrator.');
    clearTimeout(pollTimer);
    if (user.status === 'pending') pollTimer = setTimeout(checkPending, 20000);
  }

  async function checkPending() {
    if (!pendingToken || checking) return;
    if (document.hidden) { pollTimer = setTimeout(checkPending, 20000); return; }
    checking = true;
    try { await credential({ credential: pendingToken }, true); } finally { checking = false; }
  }

  async function credential(response, isSilent = false) {
    if (!isSilent) message('ログインを確認しています… / Verifying your account…');
    try {
      const user = await validator(response.credential);
      if (user.role === 'pending') {
        token = '';
        expires = 0;
        clearSession();
        pendingToken = response.credential;
        showPending(user);
        return;
      }
      pendingToken = '';
      clearTimeout(pollTimer);
      overlay().querySelector('#reportRequestAccess').hidden = true;
      const body = JSON.parse(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      token = response.credential;
      expires = body.exp * 1000;
      currentUser = user;
      saveSession(token, expires);

      const box = overlay();
      box.hidden = true;
      box.style.display = 'none';
      document.querySelector('.container')?.removeAttribute('inert');
      for (const job of waiters.splice(0)) job.resolve(token);
      document.getElementById('singleInput')?.focus();
      window.dispatchEvent(new CustomEvent('report-login', { detail: { email: user.email, role: user.role } }));
      renderHeaderControls(user);
    } catch (error) {
      token = '';
      expires = 0;
      clearSession();
      clearTimeout(pollTimer);
      overlay().querySelector('#reportRequestAccess').hidden = true;
      if (isSilent) {
        message('');
        triggerGooglePrompt();
      } else {
        message('ログインを確認できませんでした。再読み込みして、もう一度ログインしてください。 / Could not verify your sign-in. Reload and sign in again.', true);
      }
    }
  }

  function renderHeaderControls(user) {
    removeHeaderControls();

    const wrap = document.createElement('div');
    wrap.id = 'reportHeaderActions';
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;flex-shrink:0';

    const btnBaseStyle = 'display:inline-flex;align-items:center;justify-content:center;gap:5px;height:38px;min-height:38px;padding:0 11px;border-radius:10px;border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.1);color:#f8fafc;font:600 12.5px/1 Inter,system-ui;cursor:pointer;white-space:nowrap;transition:background-color 0.15s';

    if (user.role === 'admin') {
      const adminBtn = document.createElement('button');
      adminBtn.id = 'reportAccessAdminButton';
      adminBtn.type = 'button';
      adminBtn.title = 'Pengguna / 利用者管理';
      adminBtn.style.cssText = btnBaseStyle;
      adminBtn.innerHTML = '<span style="font-size:14px;line-height:1">👥</span><span class="report-hdr-label">利用者</span>';
      adminBtn.onmouseenter = () => adminBtn.style.background = 'rgba(255,255,255,0.2)';
      adminBtn.onmouseleave = () => adminBtn.style.background = 'rgba(255,255,255,0.1)';
      adminBtn.onclick = openAccessPanel;
      wrap.append(adminBtn);
    }

    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'reportSignOutButton';
    logoutBtn.type = 'button';
    logoutBtn.title = (user.email ? user.email + ' · ' : '') + 'ログアウト / Keluar';
    logoutBtn.style.cssText = btnBaseStyle;
    logoutBtn.innerHTML = '<span style="font-size:14px;line-height:1">🚪</span><span class="report-hdr-label">ログアウト</span>';
    logoutBtn.onmouseenter = () => logoutBtn.style.background = 'rgba(220,38,38,0.75)';
    logoutBtn.onmouseleave = () => logoutBtn.style.background = 'rgba(255,255,255,0.1)';
    logoutBtn.onclick = () => {
      if (confirm('ログアウトしますか？ / Keluar dari akun ini?')) {
        window.ReportAuth.signOut();
      }
    };
    wrap.append(logoutBtn);

    const headerCard = document.querySelector('.header-card');
    const langBtn = document.getElementById('langToggleBtn');
    if (headerCard) {
      if (langBtn) headerCard.insertBefore(wrap, langBtn);
      else headerCard.append(wrap);
    } else {
      wrap.style.cssText = 'position:fixed;top:10px;right:12px;z-index:15000;display:inline-flex;align-items:center;gap:6px;background:#1e293b;padding:4px;border-radius:10px;box-shadow:0 2px 8px #0003';
      document.body.append(wrap);
    }

    syncCompactHeaderLabels();
    if (user.role === 'admin' && new URL(location.href).searchParams.get('access') === '1') {
      openAccessPanel();
    }
  }

  function syncCompactHeaderLabels() {
    const isNarrow = window.innerWidth <= 640;
    document.querySelectorAll('#reportHeaderActions .report-hdr-label').forEach(el => {
      el.style.display = isNarrow ? 'none' : 'inline';
    });
    document.querySelectorAll('#reportHeaderActions button').forEach(btn => {
      btn.style.padding = isNarrow ? '0 10px' : '0 11px';
    });
  }
  window.addEventListener('resize', syncCompactHeaderLabels);

  async function openAccessPanel() {
    let panel = document.getElementById('reportAccessPanel');
    if (panel) return;
    const priorFocus = document.activeElement;
    panel = document.createElement('section');
    panel.id = 'reportAccessPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Pengguna dan permintaan akses');
    panel.style.cssText = 'position:fixed;inset:0;z-index:30001;background:#f8fafc;padding:20px;overflow:auto;font:16px/1.6 system-ui;color:#0f172a';
    const card = document.createElement('div');
    card.style.cssText = 'max-width:760px;margin:auto';
    const heading = document.createElement('h2');
    heading.textContent = 'Pengguna dan permintaan akses';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Tutup';
    close.style.cssText = 'min-height:44px;padding:8px 16px';
    close.onclick = () => { panel.remove(); priorFocus?.focus(); };
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Muat ulang';
    reload.style.cssText = 'min-height:44px;margin:8px;padding:8px 16px';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const list = document.createElement('div');
    card.append(heading, close, reload, status, list);
    panel.append(card);
    document.body.append(panel);
    close.focus();
    panel.onkeydown = e => {
      if (e.key === 'Escape') close.click();
      if (e.key === 'Tab') {
        const buttons = Array.from(panel.querySelectorAll('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    async function refresh() {
      reload.disabled = true;
      status.textContent = 'Memuat…';
      try {
        const data = await accessTransport('listReportAccess', [], await window.ReportAuth.token());
        list.replaceChildren();
        function title(text) { const h = document.createElement('h3'); h.textContent = text; list.append(h); }
        function row(text) {
          const box = document.createElement('div');
          box.style.cssText = 'padding:14px 0;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere';
          const p = document.createElement('p');
          p.style.margin = '0 0 8px';
          p.textContent = text;
          box.append(p);
          list.append(box);
          return box
