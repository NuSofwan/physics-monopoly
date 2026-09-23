import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
const AssetLab = React.lazy(() => import("./game3d/AssetLab").then((module) => ({ default: module.AssetLab })));
const TeacherDashboard = React.lazy(() => import("./teacher/TeacherDashboard").then((module) => ({ default: module.TeacherDashboard })));
const ActivityEntry = React.lazy(() => import("./teacher/ActivityEntry").then((module) => ({ default: module.ActivityEntry })));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

const rootLoadFailedFallback = (
  <div className="grid min-h-screen place-items-center p-6 text-center">
    <div>
      <p className="font-black text-ink">โหลดหน้าไม่สำเร็จ กรุณารีเฟรช</p>
      <button className="focus-ring mt-3 rounded-lg bg-coral px-4 py-2 font-bold text-white" onClick={() => window.location.reload()}>
        รีเฟรชหน้า
      </button>
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={rootLoadFailedFallback}>
      <React.Suspense fallback={<p>กำลังโหลด…</p>}>
        {window.location.pathname === "/asset-lab" ? <AssetLab /> : window.location.pathname === "/teacher" ? <TeacherDashboard /> : window.location.pathname.startsWith("/play/") ? <ActivityEntry /> : <App />}
      </React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
