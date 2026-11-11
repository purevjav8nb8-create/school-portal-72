const status = document.querySelector('#status');
const message = document.querySelector('#message');
const unlockForm = document.querySelector('#unlock-form');
const lockButton = document.querySelector('#lock-button');

async function refreshStatus() {
  const result = await chrome.runtime.sendMessage({ type: 'portal72-status' });
  if (!result.hasVault) {
    status.textContent = 'Эхлээд нууц vault үүсгэнэ үү.';
    unlockForm.hidden = true;
    lockButton.hidden = true;
    return;
  }
  status.textContent = result.unlocked
    ? 'Vault нээлттэй. Зөвшөөрөгдсөн нэвтрэх хуудсууд автоматаар бөглөгдөнө.'
    : 'Нэвтрэх мэдээлэл бөглөхийн тулд vault-аа нээнэ үү.';
  unlockForm.hidden = result.unlocked;
  lockButton.hidden = !result.unlocked;
}

unlockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  const response = await chrome.runtime.sendMessage({
    type: 'portal72-unlock',
    passphrase: document.querySelector('#passphrase').value,
  });
  if (!response.ok) {
    message.textContent = response.error;
    return;
  }
  document.querySelector('#passphrase').value = '';
  await refreshStatus();
});

lockButton.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'portal72-lock' });
  await refreshStatus();
});

document.querySelector('#options-button').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

void refreshStatus();
