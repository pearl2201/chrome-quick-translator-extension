import { toPng } from 'html-to-image';

console.log('SnapFull content script loaded.');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'START_CAPTURE') {
    runCapture(sendResponse);
    return true;
  }
});

async function runCapture(sendResponse: (response: any) => void) {
  try {
    const el = document.documentElement;

    // 1. Save original styles
    const origHeight = el.style.height;
    const origMaxHeight = el.style.maxHeight;
    const origOverflow = el.style.overflow;
    const origBodyOverflow = document.body.style.overflow;

    // 2. Expand to full content size
    el.style.height = `${Math.max(el.scrollHeight, window.innerHeight)}px`;
    el.style.maxHeight = 'none';
    el.style.overflow = 'visible';
    document.body.style.overflow = 'visible';

    // 3. Wait for layout
    await new Promise((r) => requestAnimationFrame(r));

    chrome.runtime.sendMessage({ action: 'CAPTURE_PROGRESS', percent: 50 });

    // 4. Capture
    const dataUrl = await toPng(el, {
      pixelRatio: window.devicePixelRatio || 1,
      cacheBust: true,
    });

    chrome.runtime.sendMessage({ action: 'CAPTURE_PROGRESS', percent: 95 });

    // 5. Restore styles
    el.style.height = origHeight;
    el.style.maxHeight = origMaxHeight;
    el.style.overflow = origOverflow;
    document.body.style.overflow = origBodyOverflow;

    // 6. Send result
    chrome.runtime.sendMessage({ action: 'CAPTURE_COMPLETE', dataUrl });
    sendResponse({ status: 'ok' });

  } catch (error: any) {
    console.error('SnapFull capture failed:', error);
    chrome.runtime.sendMessage({ action: 'CAPTURE_ERROR', message: error.message });
    sendResponse({ status: 'error', message: error.message });
  }
}
