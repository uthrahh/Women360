/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Google Analytics 4 Measurement ID ("G-XXXXXXXXXX"). Unset = analytics is entirely off. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
  /** "on" shows the scroll film on the landing page (once its files are in /public/film). Unset = the section is not part of the page. */
  readonly VITE_LIFE_FILM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
