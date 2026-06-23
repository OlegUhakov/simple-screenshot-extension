function sendCapture(mode) {
  const delay = parseInt(document.getElementById('timerSelect').value, 10);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tabId = tabs[0].id;

    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).then(() => {
      return chrome.tabs.sendMessage(tabId, {
        action: 'capture',
        mode: mode,
        delay: delay
      });
    }).catch(() => {});

    window.close();
  });
}

document.getElementById('selectArea').addEventListener('click', () => sendCapture('select'));
document.getElementById('fullScreen').addEventListener('click', () => sendCapture('fullscreen'));
