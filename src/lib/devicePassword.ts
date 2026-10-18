// The phone app's throwaway device account signs in with a password nobody
// ever types. It must be independent of the account's email — the backend
// rejects any password that contains it, and a password derived from the
// email would be only as secret as the email is.
const BASE64URL = /[A-Za-z0-9_-]/;

export function randomDevicePassword(): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const password = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    // The server's policy rejects 4 identical characters in a row; vanishingly
    // rare in random output, but cheaper to re-roll than to fail a sign-up.
    if (!/(.)\1{3}/.test(password)) return password;
  }
}

export const DEVICE_PASSWORD_ALPHABET = BASE64URL;
