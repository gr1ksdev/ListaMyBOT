// Telegram Serverless SDK and WebApp helper
export function getTelegram() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
}

export function isTelegramAvailable() {
  const tg = getTelegram();
  return Boolean(tg && (tg.initData || tg.initDataUnsafe?.user));
}

export function initTelegramApp() {
  const tg = getTelegram();
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();
  } catch (e) {
    console.warn('Telegram init warning:', e);
  }

  // Sync theme
  applyTelegramTheme();
  tg.onEvent?.('themeChanged', applyTelegramTheme);
}

export function applyTelegramTheme() {
  const tg = getTelegram();
  const root = document.documentElement;
  const isDark = tg?.colorScheme ? tg.colorScheme === 'dark' : true;
  root.dataset.theme = isDark ? 'dark' : 'light';

  if (tg?.themeParams) {
    const tp = tg.themeParams;
    if (tp.bg_color) root.style.setProperty('--tg-theme-bg-color', tp.bg_color);
    if (tp.text_color) root.style.setProperty('--tg-theme-text-color', tp.text_color);
    if (tp.hint_color) root.style.setProperty('--tg-theme-hint-color', tp.hint_color);
    if (tp.link_color) root.style.setProperty('--tg-theme-link-color', tp.link_color);
    if (tp.button_color) root.style.setProperty('--tg-theme-button-color', tp.button_color);
    if (tp.button_text_color) root.style.setProperty('--tg-theme-button-text-color', tp.button_text_color);
    if (tp.secondary_bg_color) root.style.setProperty('--tg-theme-secondary-bg-color', tp.secondary_bg_color);
  }
}

export function haptic(type = 'light') {
  const tg = getTelegram();
  try {
    if (!tg?.HapticFeedback) return;
    if (['light', 'medium', 'heavy', 'rigid', 'soft'].includes(type)) {
      tg.HapticFeedback.impactOccurred(type);
    } else if (['error', 'success', 'warning'].includes(type)) {
      tg.HapticFeedback.notificationOccurred(type);
    } else if (type === 'selection') {
      tg.HapticFeedback.selectionChanged();
    }
  } catch {
    // Haptics optional
  }
}

export function openTelegramLink(url) {
  const tg = getTelegram();
  if (tg?.openTelegramLink && url?.startsWith('https://t.me/')) {
    tg.openTelegramLink(url);
  } else if (tg?.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Call serverless backend endpoint via Telegram.WebApp.Serverless.call
 * Fallback to direct POST /api/<name> if running in browser dev or mock mode.
 */
export async function callEndpoint(name, input = {}) {
  const tg = getTelegram();

  return new Promise((resolve, reject) => {
    if (tg?.Serverless?.call) {
      tg.Serverless.call(name, input, (err, res) => {
        if (err) {
          const message = err.message || err.description || 'Erro na requisição';
          const error = new Error(message);
          error.type = err.type;
          error.parameters = err.parameters;
          return reject(error);
        }
        resolve(res);
      });
    } else {
      // In local development or standalone browser fallback
      fetch(`/api/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.description || data.message || `HTTP ${res.status}`);
          }
          resolve(data);
        })
        .catch(reject);
    }
  });
}
