/* Google login only. Credentials live in memory and expire with the Google token. */
(() => {
  'use strict';
  let token='',expires=0,waiters=[],validator,initializing=false;
  function overlay() {
    let dialog=document.getElementById('reportLogin');if(dialog)return dialog;
    dialog=document.createElement('section');dialog.id='reportLogin';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','reportLoginTitle');
    dialog.style.cssText='position:fixed;inset:0;z-index:30000;background:#f8fafc;display:grid;place-items:center;padding:20px;font:15px/1.6 Inter,system-ui;color:#0f172a';
    const card=document.createElement('div');card.style.cssText='width:min(100%,420px);padding:28px;background:white;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 24px #0f172a0d;text-align:center';
    card.innerHTML='<h1 id="reportLoginTitle" style="font-size:20px;margin:0 0 12px">NTIC 報告記録</h1><p>許可されたGoogleアカウントでログインしてください。<br>Masuk dengan akun Google yang diizinkan.</p><div id="reportGoogleButton" style="display:flex;justify-content:center;min-height:44px"></div><p id="reportLoginMessage" role="status" style="font-size:13px;color:#64748b"></p><a href="privacy.html" style="font-size:12px;color:#64748b">Privasi / Privacy</a>';
    dialog.append(card);document.body.append(dialog);return dialog;
  }
  function message(text){overlay().querySelector('#reportLoginMessage').textContent=text;}
  function lock(){token='';expires=0;const box=overlay();box.hidden=false;box.style.display='grid';document.querySelector('.container')?.setAttribute('inert','');}
  async function credential(response){
    message('ログインを確認しています… / Memeriksa akun…');
    try{
      const user=await validator(response.credential);
      const body=JSON.parse(atob(response.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      token=response.credential;expires=body.exp*1000;
      const box=overlay();box.hidden=true;box.style.display='none';document.querySelector('.container')?.removeAttribute('inert');
      for(const job of waiters.splice(0))job.resolve(token);
      document.getElementById('singleInput')?.focus();
      window.dispatchEvent(new CustomEvent('report-login',{detail:{email:user.email,role:user.role}}));
    }catch(error){token='';expires=0;message(error.message||'ログインできませんでした。 / Akun tidak diizinkan.');}
  }
  function initialize(){
    lock();
    const id=window.REPORT_CONFIG?.googleClientId;
    if(!id){message('Login Google belum diaktifkan. Data laporan tetap terkunci.');return;}
    if(initializing)return;initializing=true;
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onerror=()=>{initializing=false;message('Google login tidak dapat dimuat. Muat ulang halaman.');};
    script.onload=()=>{
      google.accounts.id.initialize({client_id:id,callback:credential,auto_select:false,ux_mode:'popup',itp_support:true});
      google.accounts.id.renderButton(document.getElementById('reportGoogleButton'),{theme:'outline',size:'large',text:'signin_with',shape:'rectangular'});
    };document.head.append(script);
  }
  window.ReportAuth={
    setValidator(fn){validator=fn;},
    token(){if(token&&expires>Date.now()+30000)return Promise.resolve(token);lock();return new Promise((resolve,reject)=>waiters.push({resolve,reject}));},
    invalidate(){lock();message('ログインし直してください。 / Silakan login lagi.');},
    signOut(){lock();google.accounts?.id?.disableAutoSelect();location.reload();}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
