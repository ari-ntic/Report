
/*
 * NTIC REPORT LOGIN
 * Google Authentication
 * Re-registration support for revoked users
 */

(() => {
  'use strict';

  let token = '';
  let expires = 0;
  let waiters = [];
  let validator;
  let accessTransport;
  let initializing = false;
  let pendingToken = '';
  let pollTimer;
  let checking = false;

  const REQUESTABLE = [
    'unregistered',
    'revoked',
    'rejected',
    'inactive',
    'deleted',
    'not_found',
    'not_registered',
    'none'
  ];

  function getStatus(user) {
    const status = String(user?.status || '').toLowerCase();

    if (status) return status;
    if (user?.role === 'pending') return 'unregistered';
    if (!user?.role) return 'unregistered';

    return 'approved';
  }

  function isAuthorized(user) {
    if (!user) return false;

    const role = user.role;
    const status = getStatus(user);

    return (
      (role === 'admin' || role === 'member') &&
      !REQUESTABLE.includes(status) &&
      status !== 'pending'
    );
  }

  function overlay() {
    let dialog = document.getElementById('reportLogin');

    if (dialog) return dialog;

    dialog = document.createElement('section');
    dialog.id = 'reportLogin';

    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'reportLoginTitle');

    dialog.style.cssText = `
      position:fixed;
      inset:0;
      z-index:30000;
      background:#f8fafc;
      display:grid;
      place-items:center;
      padding:20px;
      font:15px/1.6 Inter,system-ui;
      color:#0f172a;
    `;

    const card = document.createElement('div');

    card.style.cssText = `
      width:min(100%,420px);
      padding:28px;
      background:white;
      border:1px solid #e2e8f0;
      border-radius:14px;
      box-shadow:0 8px 24px #0f172a0d;
      text-align:center;
    `;

    card.innerHTML = `
      <h1 id="reportLoginTitle"
          style="font-size:20px;margin:0 0 12px">
        NTIC 報告記録
      </h1>

      <p>
        Googleアカウントでログインしてください。
        <br>
        Sign in with Google.
      </p>

      <div id="reportGoogleButton"
           style="display:flex;justify-content:center;min-height:44px">
      </div>

      <p id="reportLoginMessage"
         role="status"
         style="font-size:13px;color:#64748b">
      </p>

      <button id="reportLoginReload"
              type="button"
              hidden
              style="min-height:44px;margin:0 0 12px;padding:8px 16px">
        再読み込み / Reload
      </button>

      <br>

      <a href="privacy.html"
         style="font-size:12px;color:#64748b">
        プライバシー / Privacy
      </a>
    `;

    card.querySelector('#reportLoginReload').onclick =
      () => location.reload();

    const request = document.createElement('button');

    request.id = 'reportRequestAccess';
    request.type = 'button';
    request.hidden = true;
    request.textContent = 'アクセス申請 / Request access';

    request.style.cssText = `
      min-height:44px;
      padding:10px 18px;
      margin:8px;
    `;

    request.onclick = async () => {
      if (!pendingToken || typeof accessTransport !== 'function') {
        message(
          'Login terlebih dahulu atau hubungi admin.',
          true
        );
        return;
      }

      request.disabled = true;

      try {
        const state = await accessTransport(
          'requestReportAccess',
          [],
          pendingToken
        );

        showPending(state || {
          role: 'pending',
          status: 'pending'
        });

        if (state?.notificationSent === false) {
          message(
            'Permintaan sudah tersimpan, tetapi notifikasi admin gagal dikirim. ' +
            'Hubungi admin untuk pemeriksaan.'
          );
        }

      } catch (error) {
        console.error('Request access error:', error);

        message(
          'Gagal mengajukan akses. ' +
          'Coba lagi atau hubungi administrator.',
          true
        );
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

  function lock() {
    token = '';
    expires = 0;
    pendingToken = '';

    clearTimeout(pollTimer);

    document.getElementById('reportAccessAdminButton')?.remove();
    document.getElementById('reportAccessPanel')?.remove();

    const box = overlay();

    box.querySelector('#reportRequestAccess').hidden = true;
    box.hidden = false;
    box.style.display = 'grid';

    document.querySelector('.container')?.setAttribute('inert', '');
  }

  function showPending(user = {}) {
    const request = overlay().querySelector('#reportRequestAccess');

    const status = getStatus(user);
    const email = user.email || 'Akun ini';

    request.hidden = !REQUESTABLE.includes(status);
    request.disabled = false;

    clearTimeout(pollTimer);

    if (status === 'pending') {
      message(
        '管理者の承認を待っています。 / ' +
        'Menunggu persetujuan administrator. ' +
        'Aplikasi akan terbuka setelah disetujui.'
      );

      pollTimer = setTimeout(checkPending, 20000);
      return;
    }

    if (status === 'revoked' || status === 'deleted') {
      message(
        email +
        ' — Akses sebelumnya telah dicabut. ' +
        'Klik Request access untuk mendaftar ulang.'
      );
      return;
    }

    if (status === 'rejected') {
      message(
        'Permintaan sebelumnya ditolak. ' +
        'Klik Request access untuk mengajukan ulang.'
      );
      return;
    }

    message(
      email +
      ' — Akun belum mempunyai akses. ' +
      'Klik Request access untuk meminta persetujuan admin.'
    );
  }

  async function checkPending() {
    if (!pendingToken || checking) return;

    if (document.hidden) {
      pollTimer = setTimeout(checkPending, 20000);
      return;
    }

    checking = true;

    try {
      await credential({
        credential: pendingToken
      });
    } finally {
      checking = false;
    }
  }

  function parseGoogleToken(credentialValue) {
    const parts = credentialValue.split('.');

    if (parts.length !== 3) {
      throw new Error('Invalid Google credential');
    }

    const base64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    return JSON.parse(atob(base64));
  }

  async function credential(response) {
    message(
      'ログインを確認しています… / Verifying your account…'
    );

    try {
      if (typeof validator !== 'function') {
        throw new Error('Authentication validator missing');
      }

      const user = await validator(response.credential);

      // Only validator/server can authorize access.
      if (!isAuthorized(user)) {
        token = '';
        expires = 0;
        pendingToken = response.credential;

        showPending(user);
        return;
      }

      const body = parseGoogleToken(response.credential);

      if (!body.exp || body.exp * 1000 <= Date.now()) {
        throw new Error('Google token expired');
      }

      pendingToken = '';
      clearTimeout(pollTimer);

      overlay().querySelector('#reportRequestAccess').hidden = true;

      token = response.credential;
      expires = body.exp * 1000;

      const box = overlay();

      box.hidden = true;
      box.style.display = 'none';

      document.querySelector('.container')?.removeAttribute('inert');

      for (const job of waiters.splice(0)) {
        job.resolve(token);
      }

      document.getElementById('singleInput')?.focus();

      window.dispatchEvent(
        new CustomEvent('report-login', {
          detail: {
            email: user.email,
            role: user.role
          }
        })
      );

      if (user.role === 'admin') {
        adminButton();
      }

    } catch (error) {
      console.error('Login error:', error);

      token = '';
      expires = 0;
      pendingToken = '';

      clearTimeout(pollTimer);

      overlay().querySelector('#reportRequestAccess').hidden = true;

      message(
        'ログインを確認できませんでした。 / ' +
        'Login gagal diverifikasi. Silakan login ulang.',
        true
      );
    }
  }

  function adminButton() {
    if (document.getElementById('reportAccessAdminButton')) {
      return;
    }

    const button = document.createElement('button');

    button.id = 'reportAccessAdminButton';
    button.type = 'button';
    button.textContent = 'Pengguna / 利用者';

    button.style.cssText = `
      position:fixed;
      bottom:14px;
      right:16px;
      z-index:15000;
      min-height:44px;
      padding:10px 16px;
      border-radius:8px;
      border:1px solid #cbd5e1;
      background:#fff;
      color:#0f172a;
      box-shadow:0 2px 8px #0002;
    `;

    button.onclick = openAccessPanel;

    document.body.append(button);

    if (new URL(location.href).searchParams.get('access') === '1') {
      openAccessPanel();
    }
  }

  async function openAccessPanel() {
    if (document.getElementById('reportAccessPanel')) {
      return;
    }

    const priorFocus = document.activeElement;

    const panel = document.createElement('section');

    panel.id = 'reportAccessPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute(
      'aria-label',
      'Pengguna dan permintaan akses'
    );

    panel.style.cssText = `
      position:fixed;
      inset:0;
      z-index:30001;
      background:#f8fafc;
      padding:20px;
      overflow:auto;
      font:16px/1.6 system-ui;
      color:#0f172a;
    `;

    const card = document.createElement('div');
    card.style.cssText = 'max-width:760px;margin:auto';

    const heading = document.createElement('h2');
    heading.textContent = 'Pengguna dan permintaan akses';

    const close = document.createElement('button');

    close.type = 'button';
    close.textContent = 'Tutup';
    close.style.cssText =
      'min-height:44px;padding:8px 16px';

    close.onclick = () => {
      panel.remove();
      priorFocus?.focus();
    };

    const reload = document.createElement('button');

    reload.type = 'button';
    reload.textContent = 'Muat ulang';

    reload.style.cssText =
      'min-height:44px;margin:8px;padding:8px 16px';

    const status = document.createElement('p');
    status.setAttribute('role', 'status');

    const list = document.createElement('div');

    card.append(heading, close, reload, status, list);
    panel.append(card);
    document.body.append(panel);

    close.focus();

    panel.onkeydown = e => {
      if (e.key === 'Escape') {
        close.click();
      }

      if (e.key === 'Tab') {
        const buttons = Array.from(
          panel.querySelectorAll('button:not(:disabled)')
        );

        const first = buttons[0];
        const last = buttons.at(-1);

        if (!first || !last) return;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    async function refresh() {
      reload.disabled = true;
      status.textContent = 'Memuat…';

      try {
        const data = await accessTransport(
          'listReportAccess',
          [],
          await window.ReportAuth.token()
        );

        list.replaceChildren();

        function title(text) {
          const h = document.createElement('h3');
          h.textContent = text;
          list.append(h);
        }

        function row(text) {
          const box = document.createElement('div');

          box.style.cssText = `
            padding:14px 0;
            border-bottom:1px solid #e2e8f0;
            overflow-wrap:anywhere;
          `;

          const p = document.createElement('p');

          p.style.margin = '0 0 8px';
          p.textContent = text;

          box.append(p);
          list.append(box);

          return box;
        }

        function action(box, label, method, args, question) {
          const b = document.createElement('button');

          b.type = 'button';
          b.textContent = label;

          b.style.cssText = `
            min-height:44px;
            padding:8px 16px;
            margin-right:8px;
          `;

          b.onclick = async () => {
            if (question && !confirm(question)) return;

            box.querySelectorAll('button').forEach(
              x => x.disabled = true
            );

            try {
              await accessTransport(
                method,
                args,
                await window.ReportAuth.token()
              );

              await refresh();

            } catch (error) {
              status.textContent = error.message;

              box.querySelectorAll('button').forEach(
                x => x.disabled = false
              );
            }
          };

          box.append(b);
        }

        const requests = (data.requests || []).filter(
          x => x.status === 'pending'
        );

        title('Menunggu persetujuan (' + requests.length + ')');

        if (!requests.length) {
          row('Tidak ada permintaan baru.');
        }

        for (const request of requests) {
          const box = row(
            (request.name ? request.name + ' — ' : '') +
            request.email
          );

          action(
            box,
            'Izinkan',
            'decideReportAccess',
            [request.email, request.id, 'approve'],
            'Izinkan ' + request.email + ' sebagai member?'
          );

          action(
            box,
            'Tolak',
            'decideReportAccess',
            [request.email, request.id, 'reject']
          );
        }

        title('Sudah diizinkan');

        for (const user of data.users || []) {
          const box = row(user.email + ' · ' + user.role);

          if (user.role === 'member') {
            action(
              box,
              'Cabut akses',
              'revokeReportAccess',
              [user.email],
              'Cabut akses ' + user.email + '?'
            );
          }
        }

        status.textContent =
          'Admin dapat menyetujui permintaan baru dan permintaan ulang.';

      } catch (error) {
        status.textContent = error.message;
      } finally {
        reload.disabled = false;
      }
    }

    reload.onclick = refresh;

    await refresh();
  }

  function initialize() {
    lock();

    const id = window.REPORT_CONFIG?.googleClientId;

    if (!id) {
      message(
        'Google Login belum dikonfigurasi. Hubungi admin.',
        true
      );
      return;
    }

    if (initializing) return;

    initializing = true;

    const script = document.createElement('script');

    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;

    script.onerror = () => {
      initializing = false;

      message(
        'Gagal memuat Google Login. Reload halaman.',
        true
      );
    };

    script.onload = () => {
      google.accounts.id.initialize({
        client_id: id,
        callback: credential,
        auto_select: false,
        ux_mode: 'popup',
        itp_support: true
      });

      google.accounts.id.renderButton(
        document.getElementById('reportGoogleButton'),
        {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular'
        }
      );
    };

    document.head.append(script);
  }

  window.ReportAuth = {
    setValidator(fn) {
      validator = fn;
    },

    setAccessTransport(fn) {
      accessTransport = fn;
    },

    token() {
      if (token && expires > Date.now() + 30000) {
        return Promise.resolve(token);
      }

      lock();

      return new Promise((resolve, reject) => {
        waiters.push({ resolve, reject });
      });
    },

    invalidate() {
      lock();
      message(
        'Login ulang diperlukan. / ログインし直してください。'
      );
    },

    signOut() {
      lock();
      window.google?.accounts?.id?.disableAutoSelect();
      location.reload();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
