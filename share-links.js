/* Keep the browser address in sync with the visible app view. */
(() => {
  'use strict';
  let applyingAddress = false;
  let routeHandled = false;

  function isOpen(el) {
    return !!el && !el.hidden && el.getAttribute('aria-hidden') !== 'true' && getComputedStyle(el).display !== 'none';
  }

  function visibleRoute() {
    const photoInfo = document.getElementById('photoViewerInfo');
    const photo = typeof viewerPhotos !== 'undefined' && viewerPhotos[viewerIndex];
    const photoId = photo && typeof viewerPhotoFileId === 'function' ? viewerPhotoFileId(photo.url) : '';
    if (photoInfo && photoInfo.getClientRects().length > 0 && photoId) return { view: 'photo', id: photoId };

    const reportOverlay = document.getElementById('packageManagerOverlay');
    if (isOpen(reportOverlay) && typeof packageEntry !== 'undefined' && packageEntry && packageEntry.id) {
      return { view: 'report', id: packageEntry.id };
    }
    if (isOpen(document.getElementById('galleryModalOverlay'))) {
      return { view: 'photos', pageNo: typeof galleryCurrentPage !== 'undefined' ? galleryCurrentPage || 1 : 1 };
    }
    if (isOpen(document.getElementById('reportsModalOverlay'))) {
      return { view: 'reports', pageNo: typeof currentPage !== 'undefined' ? currentPage || 1 : 1 };
    }
    if (isOpen(document.getElementById('todoModalOverlay'))) return { view: 'todo' };
    return { view: 'home' };
  }

  function addressFor(route) {
    const url = new URL(window.location.href);
    ['view', 'pageNo', 'id'].forEach(key => url.searchParams.delete(key));
    if (route.view !== 'home') url.searchParams.set('view', route.view);
    if (route.pageNo && route.pageNo > 1) url.searchParams.set('pageNo', String(route.pageNo));
    if (route.id) url.searchParams.set('id', String(route.id));
    return url.pathname + url.search + url.hash;
  }

  function syncAddress(replace) {
    if (applyingAddress) return;
    const next = addressFor(visibleRoute());
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (next === current) return;
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ nticReportView: true }, '', next);
  }

  function syncSoon(replace) { window.setTimeout(() => syncAddress(!!replace), 0); }

  function hook(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__addressSyncWrapped) return;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      syncSoon(false);
      return result;
    };
    wrapped.__addressSyncWrapped = true;
    window[name] = wrapped;
  }

  async function openReport(id) {
    const result = await menuRpc('getJournalPackage', id);
    if (!result || !result.success || !result.report) return;
    openReportsModal(false);
    packageLoadSequence++;
    packageBusy = false;
    packageEntry = Object.assign({}, result.report);
    if (!packageEntry.id) packageEntry.id = id;
    packagePhotos = result.photos || [];
    packageHistory = result.history || [];
    packageLoaded = true;
    packageManage = true;
    updatePackageLabels();
    updateReportsControls();
    document.getElementById('packageManagerDescription').textContent = packageReportLabel(packageEntry);
    document.getElementById('packageManagerError').textContent = '';
    prepareInlineManager();
    document.getElementById('packageManagerOverlay').hidden = false;
    syncReportsScrollLock();
    renderPackagePhotos();
    renderManagedHistory();
    updateReportsControls();
    setupReportEditor();
  }

  function closeViewsForNavigation() {
    document.querySelectorAll('#todoModalOverlay .gallery-modal-close-btn, #reportsModalOverlay .gallery-modal-close-btn, #galleryModalOverlay .gallery-modal-close-btn, #packageManagerOverlay .gallery-modal-close-btn').forEach(button => button.click());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  async function applyAddressRoute() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const pageNo = Math.max(1, Math.min(9999, Number.parseInt(params.get('pageNo') || '1', 10) || 1));
    const id = params.get('id');
    applyingAddress = true;
    try {
      closeViewsForNavigation();
      if (view === 'report' && id) await openReport(id);
      else if (view === 'photo' && id) {
        const result = await menuRpc('getJournalFocusedPhoto', id);
        if (result && result.success && result.photos && result.photos.length) openPhotoViewer(result.photos, result.index || 0);
      } else if (view === 'reports') {
        openReportsModal(true);
        if (pageNo > 1) { currentPage = pageNo; loadJurnalPage(true); }
      } else if (view === 'photos') {
        openGalleryModal();
        if (pageNo > 1) { galleryCurrentPage = pageNo; loadGalleryPage(pageNo); }
      } else if (view === 'todo') openTodoModal();
      routeHandled = true;
    } catch (error) {
      console.error('Could not open address-linked view:', error);
    } finally {
      window.setTimeout(() => { applyingAddress = false; syncAddress(true); }, 0);
    }
  }

  function installRouteHook() {
    const original = window.applyJurnalPageData;
    if (typeof original === 'function' && !original.__addressRouteWrapped) {
      const wrapped = function(...args) {
        const result = original.apply(this, args);
        if (!routeHandled && new URLSearchParams(window.location.search).has('view')) window.setTimeout(applyAddressRoute, 0);
        return result;
      };
      wrapped.__addressRouteWrapped = true;
      window.applyJurnalPageData = wrapped;
    }
  }

  ['openTodoModal', 'openReportsModal', 'openGalleryModal', 'openPhotoViewer', 'loadJurnalPage', 'loadGalleryPage'].forEach(hook);
  installRouteHook();
  const observer = new MutationObserver(() => syncSoon(false));
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style', 'class', 'aria-hidden'] });
  window.addEventListener('popstate', () => { routeHandled = false; applyAddressRoute(); });
  if (new URLSearchParams(window.location.search).has('view')) window.setTimeout(() => { if (!routeHandled) applyAddressRoute(); }, 1200);
})();
