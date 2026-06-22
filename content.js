let editorLoaded = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture') {
    handleCapture(request.mode, request.delay);
  }
});

window.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'downloadFile') {
    chrome.runtime.sendMessage({
      action: 'downloadFile',
      dataUrl: event.data.dataUrl,
      filename: event.data.filename
    });
  }
});

function showError(msg) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#dc3545;color:#fff;padding:12px 24px;border-radius:8px;z-index:99999999;font:14px Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3000);
}

async function handleCapture(mode, delay) {
  try {
    if (delay > 0) {
      await new Promise(r => setTimeout(r, delay * 1000));
    } else {
      await new Promise(r => setTimeout(r, 200));
    }

    if (mode === 'fullscreen') {
      const dataUrl = await requestCapture();
      if (!dataUrl) { showError('Capture failed'); return; }
      await openEditor(dataUrl);
    } else if (mode === 'select') {
      const rect = await selectArea();
      if (!rect || rect.w < 5 || rect.h < 5) return;
      const fullDataUrl = await requestCapture();
      if (!fullDataUrl) { showError('Capture failed'); return; }
      const croppedDataUrl = await cropImage(fullDataUrl, rect);
      if (!croppedDataUrl) { showError('Crop failed'); return; }
      await openEditor(croppedDataUrl);
    }
  } catch (e) {
    showError('Error: ' + e.message);
  }
}

function requestCapture() {
  return new Promise((resolve) => {
    let attempts = 0;
    function tryCapture() {
      attempts++;
      chrome.runtime.sendMessage({ action: 'captureTab' }, (response) => {
        if (chrome.runtime.lastError) {
          if (attempts < 3) {
            setTimeout(tryCapture, 300);
          } else {
            resolve(null);
          }
        } else if (response && response.error) {
          if (attempts < 3) {
            setTimeout(tryCapture, 300);
          } else {
            resolve(null);
          }
        } else if (response && response.dataUrl) {
          resolve(response.dataUrl);
        } else {
          resolve(null);
        }
      });
    }
    tryCapture();
  });
}

function selectArea() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'screenshot-select-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:999999;cursor:crosshair;';

    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font:16px Arial,sans-serif;pointer-events:none;text-shadow:0 2px 8px rgba(0,0,0,0.5);';
    tip.textContent = 'Click and drag to select area';
    overlay.appendChild(tip);

    const selection = document.createElement('div');
    selection.style.cssText = 'position:absolute;border:2px dashed #00cc44;background:transparent;display:none;pointer-events:none;';
    overlay.appendChild(selection);
    document.body.appendChild(overlay);

    let startX, startY, isDown = false;

    const onMouseDown = (e) => {
      isDown = true;
      tip.style.display = 'none';
      const rect = overlay.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      selection.style.cssText = 'position:absolute;border:2px dashed #00cc44;background:transparent;pointer-events:none;';
      selection.style.left = startX + 'px';
      selection.style.top = startY + 'px';
      selection.style.width = '0px';
      selection.style.height = '0px';
      selection.style.display = 'block';
    };

    const onMouseMove = (e) => {
      if (!isDown) return;
      const rect = overlay.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);
      selection.style.left = x + 'px';
      selection.style.top = y + 'px';
      selection.style.width = w + 'px';
      selection.style.height = h + 'px';
    };

    const onMouseUp = (e) => {
      if (!isDown) return;
      isDown = false;
      const rect = overlay.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);

      overlay.remove();
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (w < 5 || h < 5) {
        resolve(null);
        return;
      }

      const dpr = window.devicePixelRatio || 1;

      resolve({
        x: x * dpr,
        y: y * dpr,
        w: w * dpr,
        h: h * dpr
      });
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

function cropImage(dataUrl, rect) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = rect.w;
      canvas.height = rect.h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function openEditor(dataUrl) {
  if (!editorLoaded) {
    await loadEditor();
  }

  document.dispatchEvent(new CustomEvent('screenshot-open-editor', {
    detail: { dataUrl, devicePixelRatio: window.devicePixelRatio || 1 }
  }));
}

function loadEditor() {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('editor.css');
    link.onload = () => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('editor.js');
      script.onload = () => {
        editorLoaded = true;
        resolve();
      };
      script.onerror = () => resolve();
      document.head.appendChild(script);
    };
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}
