/* Google login only. Credentials live in memory and expire with the Google token. */
(() => {
  'use strict';
  let token='',expires=0,waiters=[],validator,initializing=false,accessTransport,pendingToken='',pollTimer,checking=false,accountOutsideHandler;
  function overlay() {
    let dialog=document.getElementById('reportLogin');if(dialog)return dialog;
    dialog=document.createElement('section');dialog.id='reportLogin';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','reportLoginTitle');
    dialog.style.cssText='position:fixed;inset:0;z-index:30000;background:#f8fafc;display:grid;place-items:center;padding:20px;font:15px/1.6 Inter,system-ui;color:#0f172a';
    const card=document.createElement('div');card.style.cssText='width:min(100%,420px);padding:28px;background:white;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 24px #0f172a0d;text-align:center';
    card.innerHTML='<h1 id="reportLoginTitle" style="font-size:20px;margin:0 0 12px">NTIC 報告記録</h1><p>Googleアカウントでログインしてください。初めての方はログイン後にアクセスを申請できます。<br>Sign in with Google. New users can request access after signing in.</p><div id="reportGoogleButton" style="display:flex;justify-content:center;min-height:44px"></div><p id="reportLoginMessage" role="status" style="font-size:13px;color:#64748b"></p><button id="reportLoginReload" type="button" hidden style="min-height:44px;margin:0 0 12px;padding:8px 16px">再読み込み / Reload</button><br><a href="privacy.html" style="font-size:12px;color:#64748b">プライバシー / Privacy</a>';
    card.querySelector('#reportLoginReload').onclick=()=>location.reload();
    const request=document.createElement('button');request.id='reportRequestAccess';request.type='button';request.hidden=true;request.textContent='アクセス申請 / Request access';request.style.cssText='min-height:44px;padding:10px 18px;margin:8px';
    request.onclick=async()=>{request.disabled=true;try{const state=await accessTransport('requestReportAccess',[],pendingToken);showPending(state);if(state.notificationSent===false)message('申請は保存されましたが、管理者への通知を送信できませんでした。5分後にもう一度申請してください。 / Your request was saved, but the notification could not be sent. Try requesting again in 5 minutes.');}catch(error){message('アクセスを申請できませんでした。時間をおいて再度お試しいただくか、管理者にお問い合わせください。 / Could not request access. Try again later or contact the administrator.',true);}finally{request.disabled=false;}};
    card.querySelector('#reportLoginMessage').before(request);
    dialog.append(card);document.body.append(dialog);return dialog;
  }
  function message(text,retry=false){const box=overlay();box.querySelector('#reportLoginMessage').textContent=text;box.querySelector('#reportLoginReload').hidden=!retry;}
  function lock(){token='';expires=0;pendingToken='';clearTimeout(pollTimer);document.getElementById('reportAccountMenu')?.remove();if(accountOutsideHandler){document.removeEventListener('click',accountOutsideHandler);accountOutsideHandler=null;}document.getElementById('reportAccessAdminButton')?.remove();document.getElementById('reportAccessPanel')?.remove();const box=overlay();box.querySelector('#reportRequestAccess').hidden=true;box.hidden=false;box.style.display='grid';document.querySelector('.container')?.setAttribute('inert','');}
  function showPending(user){
    const request=overlay().querySelector('#reportRequestAccess');request.hidden=user.status==='rejected';
    const googleButton=overlay().querySelector('#reportGoogleButton');if(googleButton)googleButton.hidden=user.status==='pending';
    message(user.status==='rejected'?'アクセスは許可されていません。管理者にお問い合わせください。 / Access has not been granted. Please contact the administrator.':user.status==='pending'?'管理者の承認を待っています。承認後、自動的にアプリが開きます。 / Awaiting administrator approval. The app will open automatically once approved.':user.email+' のアクセスはまだ許可されていません。「アクセス申請」を押してください。 / This account is not yet authorized. Select Request access to contact the administrator.');
    clearTimeout(pollTimer);if(user.status==='pending')pollTimer=setTimeout(checkPending,20000);
  }
  async function checkPending(){
    if(!pendingToken||checking)return;
    if(document.hidden){pollTimer=setTimeout(checkPending,20000);return;}
    checking=true;
    try{await credential({credential:pendingToken});}finally{checking=false;}
  }
  async function credential(response){
    message('ログインを確認しています… / Verifying your account…');
    try{
      const user=await validator(response.credential);
      if(user.role==='pending'){token='';expires=0;pendingToken=response.credential;showPending(user);return;}
      pendingToken='';clearTimeout(pollTimer);overlay().querySelector('#reportRequestAccess').hidden=true;
      const body=JSON.parse(atob(response.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      token=response.credential;expires=body.exp*1000;
      const box=overlay();box.hidden=true;box.style.display='none';document.querySelector('.container')?.removeAttribute('inert');
      for(const job of waiters.splice(0))job.resolve(token);
      document.getElementById('singleInput')?.focus();
      window.dispatchEvent(new CustomEvent('report-login',{detail:{email:user.email,role:user.role}}));
      accountMenu(user);
    }catch(error){token='';expires=0;clearTimeout(pollTimer);overlay().querySelector('#reportRequestAccess').hidden=true;message('ログインを確認できませんでした。再読み込みして、もう一度ログインしてください。 / Could not verify your sign-in. Reload and sign in again.',true);}
  }
  function accountMenu(user){
    document.getElementById('reportAccountMenu')?.remove();
    const host=document.querySelector('.header-card');if(!host)return;
    const wrap=document.createElement('div');wrap.id='reportAccountMenu';wrap.style.cssText='position:relative;flex:0 0 auto;z-index:15001';
    const trigger=document.createElement('button');trigger.type='button';trigger.id='reportAccountMenuButton';trigger.className='report-account-trigger';trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');
    trigger.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>';
    const triggerLabel=document.createElement('span');triggerLabel.id='reportAccountMenuLabel';triggerLabel.textContent=typeof currentLang!=='undefined'&&currentLang==='en'?'Menu':'メニュー';
    trigger.setAttribute('aria-label',typeof currentLang!=='undefined'&&currentLang==='en'?'Menu':'メニュー');
    trigger.append(triggerLabel);
    const menu=document.createElement('div');menu.hidden=true;menu.setAttribute('role','menu');menu.style.cssText='position:absolute;right:0;top:calc(100% + 8px);width:min(280px,calc(100vw - 32px));padding:10px;background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 8px 28px #0002;color:#0f172a';
    function item(label,action){const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=label;button.style.cssText='display:block;width:100%;min-height:44px;text-align:left;padding:9px 12px;border:0;border-radius:8px;background:#fff;color:#0f172a;font:inherit;cursor:pointer';button.onmouseenter=()=>button.style.background='#f1f5f9';button.onmouseleave=()=>button.style.background='#fff';button.onclick=()=>{close();action();};menu.append(button);return button;}
    if(user.role==='admin')item('Pengguna / 利用者',openAccessPanel);
    item('ログアウト / Log out',()=>window.ReportAuth.signOut());
    function close(){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(accountOutsideHandler){document.removeEventListener('click',accountOutsideHandler);accountOutsideHandler=null;}}
    trigger.onclick=()=>{const opening=menu.hidden;menu.hidden=!opening;trigger.setAttribute('aria-expanded',String(opening));if(opening){accountOutsideHandler=event=>{if(!wrap.contains(event.target))close();};setTimeout(()=>document.addEventListener('click',accountOutsideHandler),0);}};
    wrap.append(trigger,menu);const actions=document.getElementById('headerActions')||host;actions.append(wrap);
    window.dispatchEvent(new Event('resize'));
    if(user.role==='admin'&&new URL(location.href).searchParams.get('access')==='1')openAccessPanel();
  }
  async function openAccessPanel(){
    let panel=document.getElementById('reportAccessPanel');if(panel)return;
    const priorFocus=document.activeElement;
    panel=document.createElement('section');panel.id='reportAccessPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Pengguna dan permintaan akses');panel.style.cssText='position:fixed;inset:0;z-index:30001;background:#f8fafc;padding:20px;overflow:auto;font:16px/1.6 system-ui;color:#0f172a';
    const card=document.createElement('div');card.style.cssText='max-width:760px;margin:auto';
    const heading=document.createElement('h2');heading.textContent='Pengguna dan permintaan akses';
    const close=document.createElement('button');close.type='button';close.textContent='Tutup';close.style.cssText='min-height:44px;padding:8px 16px';close.onclick=()=>{panel.remove();priorFocus?.focus();};
    const reload=document.createElement('button');reload.type='button';reload.textContent='Muat ulang';reload.style.cssText='min-height:44px;margin:8px;padding:8px 16px';
    const status=document.createElement('p');status.setAttribute('role','status');const list=document.createElement('div');
    card.append(heading,close,reload,status,list);panel.append(card);document.body.append(panel);close.focus();
    panel.onkeydown=e=>{if(e.key==='Escape')close.click();if(e.key==='Tab'){const buttons=Array.from(panel.querySelectorAll('button:not(:disabled)'));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    async function refresh(){
      reload.disabled=true;status.textContent='Memuat…';
      try{
        const data=await accessTransport('listReportAccess',[],await window.ReportAuth.token());list.replaceChildren();
        function title(text){const h=document.createElement('h3');h.textContent=text;list.append(h);}
        function row(text){const box=document.createElement('div');box.style.cssText='padding:14px 0;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere';const p=document.createElement('p');p.style.margin='0 0 8px';p.textContent=text;box.append(p);list.append(box);return box;}
        function action(box,label,method,args,question){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='min-height:44px;padding:8px 16px;margin-right:8px';b.onclick=async()=>{if(question&&!confirm(question))return;box.querySelectorAll('button').forEach(x=>x.disabled=true);try{await accessTransport(method,args,await window.ReportAuth.token());await refresh();}catch(error){status.textContent=error.message;box.querySelectorAll('button').forEach(x=>x.disabled=false);}};box.append(b);}
        const requests=data.requests.filter(x=>x.status==='pending');title('Menunggu persetujuan ('+requests.length+')');
        if(!requests.length)row('Tidak ada permintaan baru.');
        for(const request of requests){const box=row((request.name?request.name+' — ':'')+request.email);action(box,'Izinkan','decideReportAccess',[request.email,request.id,'approve'],'Izinkan '+request.email+' membaca dan menggunakan laporan sebagai member?');action(box,'Tolak','decideReportAccess',[request.email,request.id,'reject']);}
        title('Sudah diizinkan');for(const user of data.users){const box=row(user.email+' · '+user.role);if(user.role==='member')action(box,'Cabut akses','revokeReportAccess',[user.email],'Cabut akses '+user.email+'?');}
        status.textContent='Pengguna baru yang kamu izinkan mendapat akses member.';
      }catch(error){status.textContent=error.message;}finally{reload.disabled=false;}
    }
    reload.onclick=refresh;await refresh();
  }
  function initialize(){
    lock();
    const id=window.REPORT_CONFIG?.googleClientId;
    if(!id){message('Googleログインはまだ設定されていません。管理者にお問い合わせください。 / Google sign-in is not configured. Please contact the administrator.',true);return;}
    if(initializing)return;initializing=true;
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onerror=()=>{initializing=false;message('Googleログインを読み込めませんでした。再読み込みしてください。 / Could not load Google sign-in. Please reload the page.',true);};
    script.onload=()=>{
      google.accounts.id.initialize({client_id:id,callback:credential,auto_select:true,ux_mode:'popup',itp_support:true,use_fedcm_for_button:true,button_auto_select:true});
      google.accounts.id.renderButton(document.getElementById('reportGoogleButton'),{theme:'outline',size:'medium',text:'signin_with',shape:'rectangular',width:200});
      google.accounts.id.prompt();
    };document.head.append(script);
  }
  window.ReportAuth={
    setValidator(fn){validator=fn;},
    setAccessTransport(fn){accessTransport=fn;},
    token(){if(token&&expires>Date.now()+30000)return Promise.resolve(token);lock();return new Promise((resolve,reject)=>waiters.push({resolve,reject}));},
    invalidate(){lock();message('ログインし直してください。 / Please sign in again.');},
    signOut(){google.accounts?.id?.disableAutoSelect();lock();location.reload();}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
