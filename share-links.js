/* Direct links for app views, reports, and individual photos.
 * Uses the existing authenticated RPC and stable report/Drive IDs.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  let routeHandled = false;
  const labels = {
    ja: { page: '🔗 ページリンク', report: '🔗 報告リンク', photo: '🔗 写真リンク', copied: 'コピーしました', failed: 'コピーできませんでした' },
    en: { page: '🔗 Page link', report: '🔗 Report link', photo: '🔗 Photo link', copied: 'Link copied', failed: 'Copy failed' }
  };
  function text(key) { return (typeof currentLang !== 'undefined' && currentLang === 'en' ? labels.en : labels.ja)[key]; }
  function pageUrl(view, extra = {}) {
    const url = new URL(window.location.href);
    url.search = ''; url.hash = ''; url.searchParams.set('view', view);
    Object.entries(extra).forEach(([key, value]) => { if (value !== undefined && value !== null && String(value) !== '') url.searchParams.set(key, String(value)); });
    return url.toString();
  }
  async function copyLink(url, button) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(url);
      else {
        const field = document.createElement('textarea'); field.value = url; field.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.append(field); field.select();
        const copied = document.execCommand('copy'); field.remove(); if (!copied) throw new Error('Clipboard unavailable');
      }
      button.textContent = text('copied'); window.setTimeout(updateLabels, 1800);
    } catch (error) { button.textContent = text('failed'); window.setTimeout(updateLabels, 1800); }
  }
  function makeButton(id, clickHandler) {
    let button = document.getElementById(id); if (button) return button;
    button = document.createElement('button'); button.type = 'button'; button.id = id; button.className = 'photo-page-btn report-share-link'; button.addEventListener('click', clickHandler); return button;
  }
  function placeBeforeClose(selector, id, clickHandler) {
    const header = document.querySelector(selector), close = header && header.querySelector('.gallery-modal-close-btn'); if (!header || !close) return;
    const button = makeButton(id, clickHandler); if (button.parentElement !== header) close.before(button);
  }
  function installShareButtons() {
    placeBeforeClose('#todoModalOverlay .gallery-modal-header', 'shareTodoPage', () => copyLink(pageUrl('todo'), document.getElementById('shareTodoPage')));
    placeBeforeClose('#reportsModalOverlay .gallery-modal-header', 'shareReportsPage', () => copyLink(pageUrl('reports', { pageNo: currentPage || 1 }), document.getElementById('shareReportsPage')));
    placeBeforeClose('#galleryModalOverlay .gallery-modal-header', 'sharePhotosPage', () => copyLink(pageUrl('photos', { pageNo: galleryCurrentPage || 1 }), document.getElementById('sharePhotosPage')));
    placeBeforeClose('#packageManagerOverlay .package-dialog-head', 'shareReport', () => {
      if (typeof packageEntry !== 'undefined' && packageEntry && packageEntry.id) copyLink(pageUrl('report', { id: packageEntry.id }), document.getElementById('shareReport'));
    });
    const photoInfo = document.getElementById('photoViewerInfo');
    if (photoInfo) {
      const button = makeButton('sharePhoto', () => {
        const photo = typeof viewerPhotos !== 'undefined' && viewerPhotos[viewerIndex];
        const id = photo && typeof viewerPhotoFileId === 'function' ? viewerPhotoFileId(photo.url) : '';
        if (id) copyLink(pageUrl('photo', { id }), document.getElementById('sharePhoto'));
      });
      if (button.parentElement !== photoInfo) photoInfo.append(button);
      if (!photoInfo.__shareLinkObserver) {
        photoInfo.__shareLinkObserver = new MutationObserver(() => { if (!document.getElementById('sharePhoto')) installShareButtons(); });
        photoInfo.__shareLinkObserver.observe(photoInfo, { childList: true });
      }
    }
    updateLabels();
  }
  function updateLabels() {
    [['shareTodoPage','page'],['shareReportsPage','page'],['sharePhotosPage','page'],['shareReport','report'],['sharePhoto','photo']].forEach(([id,key]) => {
      const button = document.getElementById(id); if (button) { button.textContent = text(key); button.title = text(key).replace(/^🔗\s*/, ''); }
    });
  }
  async function openReport(id) {
    const result = await menuRpc('getJournalPackage', id); if (!result || !result.success || !result.report) return;
    openReportsModal(false); packageLoadSequence++; packageBusy = false; packageEntry = Object.assign({}, result.report); if (!packageEntry.id) packageEntry.id = id;
    packagePhotos = result.photos || []; packageHistory = result.history || []; packageLoaded = true; packageManage = true; updatePackageLabels(); updateReportsControls();
    document.getElementById('packageManagerDescription').textContent = packageReportLabel(packageEntry); document.getElementById('packageManagerError').textContent = '';
    prepareInlineManager(); document.getElementById('packageManagerOverlay').hidden = false; syncReportsScrollLock(); renderPackagePhotos(); renderManagedHistory(); updateReportsControls(); setupReportEditor();
  }
  async function openSharedView() {
    if (routeHandled || !params.has('view')) return; routeHandled = true;
    const view = params.get('view'), pageNo = Math.max(1, Math.min(9999, Number.parseInt(params.get('pageNo') || '1', 10) || 1));
    try {
      if (view === 'report' && params.get('id')) await openReport(params.get('id'));
      else if (view === 'photo' && params.get('id')) { const result = await menuRpc('getJournalFocusedPhoto', params.get('id')); if (result && result.success && result.photos && result.photos.length) openPhotoViewer(result.photos, result.index || 0); }
      else if (view === 'reports') { openReportsModal(true); if (pageNo > 1) { currentPage = pageNo; loadJurnalPage(true); } }
      else if (view === 'photos') { openGalleryModal(); if (pageNo > 1) { galleryCurrentPage = pageNo; loadGalleryPage(pageNo); } }
      else if (view === 'todo') openTodoModal();
      else if (view === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { console.error('Could not open shared view:', error); }
  }
  function installRoute() {
    const original = window.applyJurnalPageData;
    if (typeof original === 'function' && !original.__shareRouteWrapped) {
      const wrapped = function(...args) { const result = original.apply(this, args); window.setTimeout(openSharedView, 0); return result; };
      wrapped.__shareRouteWrapped = true; window.applyJurnalPageData = wrapped;
    }
  }
  const style = document.createElement('style'); style.textContent = '.report-share-link{white-space:nowrap;flex:0 0 auto;margin-inline-start:6px}#sharePhoto{margin-top:8px}'; document.head.append(style);
  installShareButtons(); installRoute(); window.addEventListener('report-language-change', updateLabels);
})();
