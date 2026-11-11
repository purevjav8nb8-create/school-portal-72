import { decryptVault, encryptVault } from './vault.js';

const VAULT_KEY = 'portal72EncryptedVault';
const slots = ['gmail', 'mozaik', 'medle', 'lms'];
let activePassphrase = '';

function readRecords() {
  return Object.fromEntries(slots.map((slot) => [
    slot,
    {
      username: document.querySelector(`#${slot}-username`).value.trim(),
      password: document.querySelector(`#${slot}-password`).value,
    },
  ]));
}

function displayRecords(records) {
  for (const slot of slots) {
    document.querySelector(`#${slot}-username`).value = records[slot]?.username ?? '';
    document.querySelector(`#${slot}-password`).value = records[slot]?.password ?? '';
  }
}

async function unlockWith(passphrase) {
  const { [VAULT_KEY]: vault } = await chrome.storage.local.get(VAULT_KEY);
  if (!vault) throw new Error('Vault олдсонгүй. Шинэ vault үүсгэнэ үү.');
  const records = await decryptVault(passphrase, vault);
  activePassphrase = passphrase;
  displayRecords(records);
  document.querySelector('#credentials-form').hidden = false;
  document.querySelector('#status').textContent = 'Vault нээгдлээ. Мэдээллээ засаж хадгалж болно.';
  await chrome.runtime.sendMessage({ type: 'portal72-unlock', passphrase });
}

document.querySelector('#vault-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const passphrase = document.querySelector('#master-password').value;
  try {
    await unlockWith(passphrase);
  } catch (error) {
    document.querySelector('#status').textContent = error instanceof Error ? error.message : 'Vault нээгдсэнгүй.';
  }
});

document.querySelector('#create-button').addEventListener('click', async () => {
  const passphrase = document.querySelector('#master-password').value;
  if (passphrase.length < 12) {
    document.querySelector('#status').textContent = 'Мастер нууц үг 12-аас доошгүй тэмдэгт байна.';
    return;
  }
  const { [VAULT_KEY]: existingVault } = await chrome.storage.local.get(VAULT_KEY);
  if (existingVault && !window.confirm('Одоогийн vault-ийг устгаж шинээр үүсгэх үү? Хуучин нууц үг сэргээгдэхгүй.')) return;
  activePassphrase = passphrase;
  displayRecords({ gmail: {}, mozaik: {}, medle: {}, lms: {} });
  document.querySelector('#credentials-form').hidden = false;
  document.querySelector('#status').textContent = 'Шинэ vault бэлэн. Бүртгэлүүдээ оруулаад шифрлэж хадгална уу.';
});

document.querySelector('#credentials-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activePassphrase) {
    document.querySelector('#status').textContent = 'Эхлээд vault-аа нээнэ үү.';
    return;
  }
  try {
    const encryptedVault = await encryptVault(activePassphrase, readRecords());
    await chrome.storage.local.set({ [VAULT_KEY]: encryptedVault });
    await chrome.runtime.sendMessage({ type: 'portal72-unlock', passphrase: activePassphrase });
    document.querySelector('#status').textContent = 'Шифрлэж хадгаллаа. Энэ browser profile-оос гадагш илгээгээгүй.';
  } catch (error) {
    document.querySelector('#status').textContent = error instanceof Error ? error.message : 'Vault хадгалагдсангүй.';
  }
});

document.querySelector('#lock-options-button').addEventListener('click', async () => {
  activePassphrase = '';
  displayRecords({ gmail: {}, mozaik: {}, medle: {}, lms: {} });
  document.querySelector('#credentials-form').hidden = true;
  document.querySelector('#master-password').value = '';
  await chrome.runtime.sendMessage({ type: 'portal72-lock' });
  document.querySelector('#status').textContent = 'Vault түгжлээ.';
});
