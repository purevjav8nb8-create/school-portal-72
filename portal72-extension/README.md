# Portal72 Login Helper

The extension autofills four teacher accounts on a fixed list of HTTPS sign-in sites:

- Gmail: Google sign-in pages at `accounts.google.com`
- Mozaik: `mozaweb.mn`
- Medle Office: Outlook / Microsoft sign-in pages
- Ih Nüdel LMS: `ub72.nuudelms.mn`

It does not submit login forms. Teachers review the filled values and click **Sign in** themselves. CAPTCHA, MFA, and account-recovery steps remain manual.

## Credential storage and security

- Passwords are encrypted in the browser's extension storage using AES-GCM-256.
- A vault key is derived from the teacher's master passphrase with PBKDF2-SHA-256 (310,000 iterations and a random salt).
- The vault passphrase is kept only in `chrome.storage.session` while unlocked. It is cleared when the browser session ends or the teacher locks the vault.
- Credentials are not sent to Portal72, Supabase, or any extension server. There is no sync between devices; configure each browser profile separately.
- Anyone who knows the vault master passphrase and can use the unlocked browser profile can access the saved accounts. Use a unique master passphrase, lock the vault before leaving a shared computer, and do not share master passwords.
- The extension injects only on the explicit HTTPS domains in `manifest.json` and inspects login input fields there. It does not transmit page content or submit forms.

## Teacher setup (Chrome or Edge)

1. Copy the `portal72-extension` folder to a trusted location on the teacher's computer.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**, select **Load unpacked**, and choose the `portal72-extension` folder.
4. Open the extension's **Details → Extension options** page.
5. Create a unique master passphrase with at least 12 characters. Enter each site's username and password in its own section, then select **Шифрлэж хадгалах**.
6. Use the extension icon and **Vault нээх** once after starting the browser. The extension will fill matching sign-in forms while the vault is unlocked. Teachers still click the site's sign-in button.
7. Select **Vault түгжих** before leaving a shared or unattended computer.

If Chrome or Edge reports that an extension is blocked by school policy, the organization's browser administrator must distribute/allow it through the browser management policy. Do not disable browser security controls.

## Updating the extension

Replace the extension folder with a reviewed release, then select **Reload** on the browser extensions page. A changed extension version or browser session may require unlocking the vault again.

## Supabase

No Supabase columns, tables, or SQL migration are needed for this extension. Do not add Gmail, Mozaik, Medle, ESIS, or LMS passwords to teacher records or Auth metadata.
