(() => {
  'use strict';

  const originalSetupReportEditor = setupReportEditor;

  setupReportEditor = function() {
    originalSetupReportEditor();

    if (!reportEditorState || !document.getElementById('editorPhotos')) return;

    reportEditorState.newPhotos = reportEditorState.newPhotos || [];

    const box = document.getElementById('editorPhotos');
    const field = box.parentElement;

    let tools = document.getElementById('editorPhotoUploadTools');
    if (tools) tools.remove();

    tools = document.createElement('div');
    tools.id = 'editorPhotoUploadTools';
    tools.style.cssText =
      'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'revision-small-button';
    addButton.textContent = editorLabel('＋ 写真を追加', '＋ Add photos');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.hidden = true;

    const count = document.createElement('span');
    count.id = 'editorPhotoCount';
    count.style.cssText = 'font-size:12px;color:#64748b';

    addButton.onclick = () => input.click();

    input.onchange = async () => {
      const state = reportEditorState;
      const files = Array.from(input.files || []);
      input.value = '';

      if (!files.length || !state) return;

      const used =
        state.photos.length +
        state.removedPhotos.length +
        state.newPhotos.length;
      const slots = Math.max(0, 5 - used);

      if (!slots) {
        document.getElementById('packageManagerError').textContent =
          editorLabel(
            '写真は1件につき最大5枚です。',
            'A report can have up to 5 photos.'
          );
        return;
      }

      if (files.length > slots) {
        document.getElementById('packageManagerError').textContent =
          editorLabel(
            '追加できる写真はあと' + slots + '枚です。',
            'You can add ' + slots + ' more photo(s).'
          );
      } else {
        document.getElementById('packageManagerError').textContent = '';
      }

      addButton.disabled = true;

      try {
        for (const file of files.slice(0, slots)) {
          if (state !== reportEditorState) return;

          const compressed = await compressImageFile(file);

          state.newPhotos.push({
            base64: compressed.base64,
            mimeType: compressed.mimeType,
            previewUrl: compressed.previewUrl,
            fileId: ''
          });

          renderEditorPhotos();
        }
      } catch (error) {
        document.getElementById('packageManagerError').textContent =
          editorLabel(
            '写真を読み込めませんでした。画像を選び直してください。',
            'Could not read the photo. Please choose it again.'
          );
      } finally {
        addButton.disabled = false;
      }
    };

    tools.append(addButton, input, count);
    field.insertBefore(tools, box);
    renderEditorPhotos();
  };


  renderEditorPhotos = function() {
    if (!reportEditorState) return;

    const box = document.getElementById('editorPhotos');
    if (!box) return;

    box.replaceChildren();

    reportEditorState.photos.forEach(function(photo) {
      const tile = document.createElement('div');
      tile.className = 'editor-photo';

      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'editor-thumb';

      const image = document.createElement('img');
      image.src = photo.url;
      image.alt = editorLabel('報告の写真', 'Report photo');
      thumb.append(image);
      thumb.onclick = () => openEditorPhoto(photo);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'editor-photo-remove';
      remove.textContent = editorLabel('削除', 'Delete');

      remove.onclick = () => {
        reportEditorState.photos =
          reportEditorState.photos.filter(item => item !== photo);
        reportEditorState.removedPhotos.push(photo.id);
        renderEditorPhotos();
      };

      tile.append(thumb, remove);
      box.append(tile);
    });

    reportEditorState.newPhotos.forEach(function(photo) {
      const tile = document.createElement('div');
      tile.className = 'editor-photo';

      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'editor-thumb';

      const image = document.createElement('img');
      image.src = photo.previewUrl;
      image.alt = editorLabel('追加する写真', 'Photo to add');
      thumb.append(image);
      thumb.onclick = () =>
        window.open(photo.previewUrl, '_blank', 'noopener');

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'editor-photo-remove';
      remove.textContent = editorLabel('削除', 'Remove');

      remove.onclick = () => {
        reportEditorState.newPhotos =
          reportEditorState.newPhotos.filter(item => item !== photo);
        renderEditorPhotos();
      };

      tile.append(thumb, remove);
      box.append(tile);
    });

    const count = document.getElementById('editorPhotoCount');
    if (count) {
      const total =
        reportEditorState.photos.length +
        reportEditorState.removedPhotos.length +
        reportEditorState.newPhotos.length;
      count.textContent = total + ' / 5';
    }
  };


  saveReportEditor = async function() {
    if (packageBusy) return;

    const state = reportEditorState;
    const errorBox = document.getElementById('packageManagerError');
    if (!state) return;

    packageBusy = true;

    const controls = Array.from(document.querySelectorAll(
      '#packageManagerOverlay button, ' +
      '#packageManagerOverlay input, ' +
      '#packageManagerOverlay textarea'
    ));

    controls.forEach(control => control.disabled = true);

    try {
      if (!state.pending) {
        for (const photo of state.newPhotos) {
          if (photo.fileId) continue;

          const uploaded = await menuRpc(
            'uploadSinglePhoto',
            {
              base64: photo.base64,
              mimeType: photo.mimeType
            },
            packageEntry.nama
          );

          if (!uploaded || !uploaded.success || !uploaded.fileId) {
            throw new Error(
              uploaded && uploaded.message
                ? uploaded.message
                : packageT().failed
            );
          }

          photo.fileId = uploaded.fileId;
        }

        state.pending = {
          entryId: packageEntry.id,
          urgency: state.report.urgensi,
          category: document.getElementById('editorCategory').value,
          note: document.getElementById('editorNote').value,
          date: state.report.tanggal,
          actions: state.actions.map(action => ({
            id: action.id,
            note: action.note
          })),
          added: state.added.map(action => ({ ...action })),
          removedActions: state.removedActions.slice(),
          removedPhotos: state.removedPhotos.slice(),
          newPhotoIds: state.newPhotos.map(photo => photo.fileId),
          operationId: newSubmissionId()
        };
      }

      const result = await menuRpc('saveJournalEditor', state.pending);

      if (!result || !result.success) {
        if (result && !result.partial) state.pending = null;

        throw new Error(
          result && result.message ? result.message : packageT().failed
        );
      }

      const expected = state.pending.newPhotoIds || [];
      const confirmed = result.photoFileIds || [];

      if (expected.some(id => !confirmed.includes(id))) {
        throw new Error(
          editorLabel(
            '写真の保存を確認できませんでした。もう一度「保存」を押してください。',
            'Photo saving was not confirmed. Press Save again to retry.'
          )
        );
      }

      state.pending = null;
      packageBusy = false;
      closePackageManager();
      invalidateMenuData();
      loadDashboard();
      loadJurnalPage(true);
    } catch (error) {
      if (errorBox) {
        errorBox.textContent = error.message || packageT().failed;
      }
    } finally {
      packageBusy = false;

      controls.forEach(control => {
        control.disabled = !!state.pending;
      });

      const save = document.getElementById('editorSave');
      const close = document.getElementById('packageManagerClose');

      if (save) {
        save.disabled = false;
        if (state.pending) save.textContent = revisionT().retry;
      }

      if (close) close.disabled = false;
    }
  };
})();
