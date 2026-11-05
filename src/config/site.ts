/**
 * Who to write to. One place, so the landing page, the legal pages and the emails agree. It is a public
 * address by nature. Override with VITE_SUPPORT_EMAIL at build time (and SUPPORT_EMAIL on the server).
 */
export const SUPPORT_EMAIL: string = import.meta.env.VITE_SUPPORT_EMAIL ?? "admin.women360@gmail.com";
