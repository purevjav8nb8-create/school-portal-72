let credential = null;
let attempts = 0;
const filledInputs = new WeakSet();

function visible(input) {
  return input instanceof HTMLInputElement
    && input.type !== 'hidden'
    && !input.disabled
    && input.getClientRects().length > 0;
}

function usernameInput(hasPasswordField) {
  const candidates = [
    document.querySelector('#identifierId'),
    document.querySelector('input[autocomplete="username"]'),
    document.querySelector('input[name="loginfmt"]'),
    document.querySelector('#i0116'),
  ];
  if (hasPasswordField) {
    candidates.push(
      document.querySelector('input[type="email"]'),
      ...document.querySelectorAll('input[type="text"]'),
    );
  }
  return candidates.find((candidate) => visible(candidate));
}

function passwordInput() {
  return [...document.querySelectorAll('input[type="password"]')].find(visible);
}

function setValue(input, value) {
  if (!input || !value || input.value || filledInputs.has(input)) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  filledInputs.add(input);
  return true;
}

function fillCredentials() {
  if (!credential || attempts >= 120) return;
  attempts += 1;
  const passwordField = passwordInput();
  const usernameField = usernameInput(Boolean(passwordField));
  setValue(usernameField, credential.username);
  if (setValue(passwordField, credential.password)) {
    credential = null;
    window.clearInterval(timer);
    observer.disconnect();
  }
}

const observer = new MutationObserver(fillCredentials);
observer.observe(document.documentElement, { childList: true, subtree: true });

const timer = window.setInterval(() => {
  if (attempts >= 120) {
    window.clearInterval(timer);
    observer.disconnect();
    credential = null;
    return;
  }
  fillCredentials();
}, 750);

void chrome.runtime.sendMessage({ type: 'portal72-get-credential' })
  .then((response) => {
    if (!response?.ok || !response.credential) return;
    credential = response.credential;
    fillCredentials();
  })
  .catch(() => {
    window.clearInterval(timer);
    observer.disconnect();
  });
