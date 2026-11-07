import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Fonts are served from this site (variable fonts: one file covers every weight), not from Google, so
// the first paint doesn't wait on two other servers. Latin is fetched only when a page uses it.
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/fraunces/opsz.css";
import "./index.css";
import { installGlobalErrorReporting } from "@/lib/reportError";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

installGlobalErrorReporting();
