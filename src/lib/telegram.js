// Telegram Serverless SDK and WebApp helper
export function getTelegram() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
}

export function isTelegramAvailable() {
  const tg = getTelegram();
  return Boolean(tg && (tg.initData || tg.initDataUnsafe?.user) && tg.Serverless?.call);
}

export function initTelegramApp() {
  const tg = getTelegram();
  if (!tg) return;

  try {
    tg.ready?.();
    tg.expand?.();
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
    if (tp.header_bg_color) root.style.setProperty('--tg-theme-header-bg-color', tp.header_bg_color);
    if (tp.section_bg_color) root.style.setProperty('--tg-theme-section-bg-color', tp.section_bg_color);
    if (tp.section_header_text_color) root.style.setProperty('--tg-theme-section-header-text-color', tp.section_header_text_color);
    if (tp.subtitle_text_color) root.style.setProperty('--tg-theme-subtitle-text-color', tp.subtitle_text_color);
    if (tp.destructive_text_color) root.style.setProperty('--tg-theme-destructive-text-color', tp.destructive_text_color);
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
 * Wait for Telegram.WebApp.Serverless to become available if Telegram is injecting it
 */
async function waitForServerless(maxWaitMs = 1200) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const tg = getTelegram();
    if (tg?.Serverless?.call) return tg;
    await new Promise((r) => setTimeout(r, 40));
  }
  return getTelegram();
}

/**
 * Call serverless backend endpoint via Telegram.WebApp.Serverless.call
 */
export async function callEndpoint(name, input = {}) {
  let tg = getTelegram();
  if (!tg?.Serverless?.call) {
    tg = await waitForServerless();
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    // 20 second timeout like native bot app
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(name === 'dashboard' ? 'O servidor demorou para responder. Tente novamente.' : 'Tempo limite da operação excedido. Tente novamente.'));
    }, 20000);

    if (tg?.Serverless?.call) {
      try {
        tg.Serverless.call(name, input, (err, res) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (err) {
            const message = err.message || err.description || 'Erro na requisição';
            const error = new Error(message);
            error.type = err.type;
            error.parameters = err.parameters;
            return reject(error);
          }
          resolve(res);
        });
      } catch (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      }
    } else {
      clearTimeout(timer);
      // If outside Telegram without Serverless SDK
      reject(new Error('Abra o bot no Telegram e envie /admin para acessar o painel.'));
    }
  });
}

/**
 * Safe settings saver that handles optimistic locking and automatic version recovery
 */
export async function saveSettingsSafe(settings, version, onVersionSync) {
  try {
    const res = await callEndpoint('saveSettings', { settings, version });
    onVersionSync?.(version ? version + 1 : 1);
    return res;
  } catch (err) {
    if (err.message && err.message.includes('As configurações mudaram')) {
      const fresh = await callEndpoint('dashboard', {});
      onVersionSync?.(fresh?.version || 1, fresh);
      // Do not silently resend stale settings: another administrator may have
      // changed a different field. Refresh the panel and let the user retry.
      throw new Error('As configurações mudaram em outro dispositivo. Revise os dados atualizados e salve novamente.');
    }
    throw err;
  }
}
