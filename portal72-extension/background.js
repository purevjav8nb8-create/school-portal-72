import { decryptVault } from './vault.js';

const SESSION_KEY = 'portal72VaultPassphrase';
const VAULT_KEY = 'portal72EncryptedVault';

function credentialSlotForUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') return null;
  const { hostname, pathname, searchParams } = url;
  if (hostname === 'accounts.google.com'
    && (/^\/(?:signin|v3\/signin)\//i.test(pathname) || /^\/ServiceLogin$/i.test(pathname))) {
    return 'gmail';
  }
  if ((hostname === 'mozaweb.mn' || hostname === 'www.mozaweb.mn')
    && pathname.toLowerCase() === '/user.php'
    && searchParams.get('cmd') === 'login') {
    return 'mozaik';
  }
  if (hostname === 'login.microsoftonline.com'
    && /^\/[^/]+\/(?:login|oauth2)(?:\/|$)/i.test(pathname)) {
    return 'medle';
  }
  if (hostname === 'login.live.com'
    && /^\/(?:login\.srf|oauth20_authorize\.srf|ppsecure\/post\.srf)$/i.test(pathname)) {
    return 'medle';
  }
  if (hostname === 'ub72.nuudelms.mn' && /^\/login\/?$/i.test(pathname)) {
    return 'lms';
  }
  return null;
}

async function restrictSessionStorage() {
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

chrome.runtime.onInstalled.addListener(() => {
  void restrictSessionStorage();
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.storage.session.remove(SESSION_KEY);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'portal72-unlock' && typeof message.passphrase === 'string') {
    void (async () => {
      try {
        const { [VAULT_KEY]: vault } = await chrome.storage.local.get(VAULT_KEY);
        if (!vault) throw new Error('Vault хараахан үүсгээгүй байна.');
        await decryptVault(message.passphrase, vault);
        await chrome.storage.session.set({ [SESSION_KEY]: message.passphrase });
        sendResponse({ ok: true });
      } catch {
        sendResponse({ ok: false, error: 'Мастер нууц үг буруу эсвэл vault уншигдсангүй.' });
      }
    })();
    return true;
  }

  if (message?.type === 'portal72-lock') {
    void chrome.storage.session.remove(SESSION_KEY).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'portal72-status') {
    void (async () => {
      const [{ [SESSION_KEY]: passphrase }, { [VAULT_KEY]: vault }] = await Promise.all([
        chrome.storage.session.get(SESSION_KEY),
        chrome.storage.local.get(VAULT_KEY),
      ]);
      sendResponse({ hasVault: Boolean(vault), unlocked: Boolean(passphrase) });
    })();
    return true;
  }

  if (message?.type === 'portal72-get-credential') {
    void (async () => {
      if (!sender.url) {
        sendResponse({ ok: false, error: 'Нэвтрэх хуудасны мэдээлэл олдсонгүй.' });
        return;
      }
      const slot = credentialSlotForUrl(sender.url);
      if (!slot) {
        sendResponse({ ok: false, error: 'Энэ сайт зөвшөөрөгдсөн жагсаалтад байхгүй.' });
        return;
      }
      const [{ [SESSION_KEY]: passphrase }, { [VAULT_KEY]: vault }] = await Promise.all([
        chrome.storage.session.get(SESSION_KEY),
        chrome.storage.local.get(VAULT_KEY),
      ]);
      if (!passphrase || !vault) {
        sendResponse({ ok: false, locked: true });
        return;
      }
      try {
        const records = await decryptVault(passphrase, vault);
        sendResponse({ ok: true, credential: records[slot] ?? null });
      } catch {
        await chrome.storage.session.remove(SESSION_KEY);
        sendResponse({ ok: false, locked: true });
      }
    })();
    return true;
  }
});
