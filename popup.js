function sendCapture(mode) {
  const delay = parseInt(document.getElementById('timerSelect').value, 10);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'capture',
      mode: mode,
      delay: delay
    }).catch(() => {});
    window.close();
  });
}

document.getElementById('selectArea').addEventListener('click', () => sendCapture('select'));
document.getElementById('fullScreen').addEventListener('click', () => sendCapture('fullscreen'));
