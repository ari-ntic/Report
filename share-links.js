/* Keep the address bar in sync with the visible view and report filters. */
(() => {
  'use strict';
  let applyingAddress = false;
  let routeHandled = false;
  let routeApplying = false;

  const FILTER_KEYS = ['company', 'category', 'urgency', 'search'];
  const MANAGED_KEYS = ['view', 'pageNo', 'id', ...FILTER_KEYS];

  function isOpen(el) {
    return !!el && !el.hidden && el.getAttribute('aria-hidden') !== 'true' && getComputedStyle(el).display !== 'none';
  }

  function cleanFilter(value) {
    const text = String(value == null ? '' : value).trim();
    return !text || text === 'ALL' ? '' : text;
  }

  function readFilters() {
    const company = cleanFilter(document.getElementById('filterCompany')?.value);
    const category = cleanFilter(document.getElementById('filterCategory')?.value);
    const searchBox = document.getElementById('filterSearch');
    const search = String(searchBox ? searchBox.value : (typeof currentSearchTerm !== 'undefined' ? currentSearchTerm : '')).trim();
    const urgency = cleanFilter(typeof currentUrgencyFilter !== 'undefined' ? currentUrgencyFilter : '');
    return { company, category, urgency, search };
  }

  function visibleRoute() {
    const photoInfo = document.getElementById('photoViewerInfo');
    const photo = typeof viewerPhotos !== 'undefined' && viewerPhotos[viewerIndex];
    const photoId = photo && typeof viewerPhotoFileId === 'function' ? viewerPhotoFileId(photo.url) : '';
    if (photoInfo && photoInfo.getClientRects().length > 0 && photoId) return { view: 'photo', id: photoId };

    const reportOverlay = document.getElementById('packageManagerOverlay');
    if (isOpen(reportOverlay) && typeof packageEntry !== 'undefined' && packageEntry && packageEntry.id) {
      return Object.assign({ view: 'report', id: packageEntry.id, pageNo: typeof currentPage !== 'undefined' ? currentPage || 1 : 1 }, readFilters());
    }
    if (isOpen(document.getElementById('galleryModalOverlay'))) {
      return { view: 'photos', pageNo: typeof galleryCurrentPage !== 'undefined' ? galleryCurrentPage || 1 : 1 };
    }
    if (isOpen(document.getElementById('reportsModalOverlay'))) {
      return Object.assign({ view: 'reports', pageNo: typeof currentPage !== 'undefined' ? currentPage || 1 : 1 }, readFilters());
    }
    if (isOpen(document.getElementById('todoModalOverlay'))) return { view: 'todo' };
    return { view: 'home' };
  }

  function addressFor(route) {
    const url = new URL(window.location.href);
    MANAGED_KEYS.forEach(key => url.searchParams.delete(key));
    if (route.view !== 'home') url.searchParams.set('view', route.view);
    if (route.pageNo && route.pageNo > 1) url.searchParams.set('pageNo', String(route.pageNo));
    if (route.id) url.searchParams.set('id', String(route.id));
    if (route.view === 'reports' || route.view === 'report') {
      FILTER_KEYS.forEach(key => {
        const value = cleanFilter(route[key]);
        if (value) url.searchParams.set(key, value);
      });
    }
    return url.pathname + url.search + url.hash;
  }

  function syncAddress(replace) {
    const loginOverlay = document.getElementById('reportLogin');    if (applyingAddress || isOpen(loginOverlay)) return;
    const next = addressFor(visibleRoute());
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (next === current) return;
    window.history[replace ? 'replaceState' : 'pushState']({ nticReportView: true }, '', next);
  }

  function syncSoon(replace) { window.setTimeout(() => syncAddress(!!replace), 0); }

  function hook(name, replace) {
    const original = window[name];
    if (typeof original !== 'function' || original.__addressSyncWrapped) return;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      syncSoon(!!replace);
      return result;
    };
    wrapped.__addressSyncWrapped = true;
    window[name] = wrapped;
  }

  function setSelectValue(id, value) {
    const select = document.getElementById(id);
    if (!select) return;
    const wanted = value || 'ALL';
    if (![...select.options].some(option => option.value === wanted)) {
      select.add(new Option(wanted, wanted));
    }
    select.value = wanted;
  }

  function applyFilters(params) {
    const company = params.get('company') || '';
    const category = params.get('category') || '';
    const urgency = params.get('urgency') || 'ALL';
    const search = params.get('search') || '';
    setSelectValue('filterCompany', company);
    setSelectValue('filterCategory', category);
    const searchBox = document.getElementById('filterSearch');
    if (searchBox) searchBox.value = search;
    if (typeof currentSearchTerm !== 'undefined') currentSearchTerm = search;
    if (typeof setQuickPill === 'function') setQuickPill(urgency);
    else if (typeof currentUrgencyFilter !== 'undefined') currentUrgencyFilter = urgency;
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
    if (routeApplying) return;
    routeApplying = true;
    routeHandled = true;
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const pageNo = Math.max(1, Math.min(9999, Number.parseInt(params.get('pageNo') || '1', 10) || 1));
    const id = params.get('id');
    applyingAddress = true;
    try {
      closeViewsForNavigation();
      if (view === 'report' && id) {
        applyFilters(params);
        if (pageNo > 1 && typeof currentPage !== 'undefined') currentPage = pageNo;
        await openReport(id);
      } else if (view === 'photo' && id) {
        const result = await menuRpc('getJournalFocusedPhoto', id);
        if (result && result.success && result.photos && result.photos.length) openPhotoViewer(result.photos, result.index || 0);
      } else if (view === 'reports') {
        applyFilters(params);
        openReportsModal(false);
        if (typeof currentPage !== 'undefined') currentPage = pageNo;
        loadJurnalPage(true);
      } else if (view === 'photos') {
        openGalleryModal();
        if (pageNo > 1) { galleryCurrentPage = pageNo; loadGalleryPage(pageNo); }
      } else if (view === 'todo') openTodoModal();
    } catch (error) {
      console.error('Could not open address-linked view:', error);
    } finally {
      window.setTimeout(() => {
        applyingAddress = false;
        routeApplying = false;
        syncAddress(true);
      }, 0);
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

  ['openTodoModal', 'openReportsModal', 'openGalleryModal', 'openPhotoViewer', 'loadJurnalPage', 'loadGalleryPage'].forEach(name => hook(name, false));
  ['closePackageManager', 'closeReportsModal', 'closeGalleryModal', 'closeTodoModal', 'closePhotoViewer'].forEach(name => hook(name, true));
  ['onFilterChanged', 'filterByTrainee', 'filterByCompany', 'filterByCategory', 'setQuickPill'].forEach(name => hook(name, true));
  installRouteHook();

  ['filterCompany', 'filterCategory'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => syncSoon(true));
  });
  const searchBox = document.getElementById('filterSearch');
  if (searchBox) {
    searchBox.addEventListener('input', () => syncSoon(true));
    searchBox.addEventListener('change', () => syncSoon(true));
  }

  const observer = new MutationObserver(() => syncSoon(false));
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style', 'class', 'aria-hidden'] });
  window.addEventListener('report-login', () => { if (new URLSearchParams(window.location.search).has('view')) { routeHandled = false; routeApplying = false; window.setTimeout(applyAddressRoute, 0); } }); window.addEventListener('popstate', () => { routeHandled = false; routeApplying = false; applyAddressRoute(); });
  if (new URLSearchParams(window.location.search).has('view')) window.setTimeout(() => { const loginOverlay = document.getElementById('reportLogin'); if (!routeHandled && !isOpen(loginOverlay)) applyAddressRoute(); }, 1200);
})();
