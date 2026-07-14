chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "START_CAPTURE") {
    runFullPageCapture(message.tabId)
      .then(() => sendResponse({ status: "initiated" }))
      .catch((err) => sendResponse({ status: "error", message: err.message }));
    return true; 
  }
});

async function runFullPageCapture(tabId: number) {
  const target = { tabId };

  try {
    // 1. Attach the debugger to the target tab
    await chrome.debugger.attach(target, "1.3");

    // 2. Query the device metrics to find the true page content size
    const { contentSize, visualViewport }: any = await chrome.debugger.sendCommand(target, "Page.getLayoutMetrics", {});

    const fullWidth = Math.ceil(contentSize.width);
    const fullHeight = Math.ceil(contentSize.height);

    chrome.runtime.sendMessage({ action: "CAPTURE_PROGRESS", percent: 30 });

    // 3. Override the viewport to the full content size so the browser renders everything
    await chrome.debugger.sendCommand(target, "Emulation.setDeviceMetricsOverride", {
      width: fullWidth,
      height: fullHeight,
      deviceScaleFactor: visualViewport.devicePixelRatio || 1,
      mobile: false,
    });

    // Wait for the page to re-render at the new dimensions
    await new Promise((resolve) => setTimeout(resolve, 300));

    chrome.runtime.sendMessage({ action: "CAPTURE_PROGRESS", percent: 60 });

    // 4. Capture the full rendered page (viewport now matches full content)
    const result: any = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });

    chrome.runtime.sendMessage({ action: "CAPTURE_PROGRESS", percent: 95 });

    // 5. Restore the original viewport
    await chrome.debugger.sendCommand(target, "Emulation.clearDeviceMetricsOverride").catch(() => {});

    // 6. Construct the complete full-page image URI string
    const dataUrl = `data:image/png;base64,${result.data}`;

    // 7. Pipe the image back to the popup
    chrome.runtime.sendMessage({ action: "CAPTURE_COMPLETE", dataUrl });

  } catch (error) {
    console.error("Capture failed:", error);
    throw error;
  } finally {
    // 8. Always detach debugger to remove the browser notification banner
    await chrome.debugger.detach(target).catch(() => {});
  }
}
