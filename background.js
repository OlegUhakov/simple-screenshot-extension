chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    chrome.tabs.captureVisibleTab(sender.tab?.windowId ?? null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true;
  }

  if (request.action === 'downloadFile') {
    chrome.downloads.download({
      url: request.dataUrl,
      filename: request.filename || 'screenshot.png',
      saveAs: true
    });
    sendResponse({ ok: true });
    return true;
  }
});
