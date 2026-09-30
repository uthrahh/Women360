import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.women360.app',
  appName: 'Women360',
  webDir: 'dist',
  // Load the live Vercel deployment instead of a bundle frozen inside the
  // APK at build time — so a normal `git push` (which already triggers a
  // Vercel deploy) reaches the phone the next time the app is opened, with
  // no new APK needed. `webDir`/dist above is kept only as the offline
  // fallback Capacitor falls back to if the device has no connectivity.
  server: {
    url: 'https://women-360.vercel.app',
    cleartext: false,
  },
};

export default config;
