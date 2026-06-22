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

async function handleCapture(mode, delay) {
  if (delay > 0) {
    await new Promise(r => setTimeout(r, delay * 1000));
  } else {
    await new Promise(r => setTimeout(r, 200));
  }

  if (mode === 'fullscreen') {
    const dataUrl = await requestCapture();
    await openEditor(dataUrl);
  } else if (mode === 'select') {
    const rect = await selectArea();
    const fullDataUrl = await requestCapture();
    const croppedDataUrl = await cropImage(fullDataUrl, rect);
    await openEditor(croppedDataUrl);
  }
}

function requestCapture() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryCapture() {
      attempts++;
      chrome.runtime.sendMessage({ action: 'captureTab' }, (response) => {
        if (chrome.runtime.lastError) {
          if (attempts < 3) {
            setTimeout(tryCapture, 200);
          } else {
            reject(chrome.runtime.lastError.message);
          }
        } else if (response?.error) {
          if (attempts < 3) {
            setTimeout(tryCapture, 200);
          } else {
            reject(response.error);
          }
        } else {
          resolve(response.dataUrl);
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
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.4); z-index: 999999; cursor: crosshair;
    `;

    const selection = document.createElement('div');
    selection.style.cssText = `
      position: absolute; border: 2px dashed #00cc44;
      background: transparent; display: none; pointer-events: none;
    `;
    overlay.appendChild(selection);
    document.body.appendChild(overlay);

    let startX, startY, isDown = false;

    const onMouseDown = (e) => {
      isDown = true;
      const rect = overlay.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      selection.style.cssText = `
        position: absolute; border: 2px dashed #00cc44;
        background: transparent; pointer-events: none;
      `;
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

      const dpr = window.devicePixelRatio || 1;
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      resolve({
        x: (x + scrollX) * dpr,
        y: (y + scrollY) * dpr,
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
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
      resolve(canvas.toDataURL('image/png'));
    };
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
  return new Promise((resolve, reject) => {
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
      script.onerror = () => {
        reject(new Error('Failed to load editor.js'));
      };
      document.head.appendChild(script);
    };
    link.onerror = () => {
      reject(new Error('Failed to load editor.css'));
    };
    document.head.appendChild(link);
  });
}
