const { shell } = require('electron');

function openExternalUrl(url) {
  if (/^https?:\/\//i.test(String(url || ''))) {
    shell.openExternal(url).catch((error) => {
      console.warn('[shell:open-external]', error);
    });
  }
}

function safelyCallWindowMethod(window, methodName, ...args) {
  if (
    !window ||
    window.isDestroyed() ||
    typeof window[methodName] !== 'function'
  ) {
    return undefined;
  }

  try {
    return window[methodName](...args);
  } catch (error) {
    console.warn(`[window:${methodName}]`, error);
    return undefined;
  }
}

function sendToWindow(window, channel, payload) {
  if (!window || window.isDestroyed() || window.webContents?.isDestroyed()) {
    return;
  }

  try {
    window.webContents.send(channel, payload);
  } catch (error) {
    console.warn(`[window:send:${channel}]`, error);
  }
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

module.exports = {
  clampNumber,
  openExternalUrl,
  safelyCallWindowMethod,
  sendToWindow,
};
