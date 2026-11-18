"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function hasUnsavedChildForm(): boolean {
  const form = document.querySelector<HTMLFormElement>("form[data-offline-draft-form]");
  if (!form) return false;

  return Array.from(form.elements).some((element) => {
    if (element instanceof HTMLInputElement) {
      if (["hidden", "submit", "button", "reset"].includes(element.type)) return false;
      if (["checkbox", "radio"].includes(element.type)) return element.checked !== element.defaultChecked;
      return element.value !== element.defaultValue;
    }
    if (element instanceof HTMLSelectElement) {
      return Array.from(element.options).some((option) => option.selected !== option.defaultSelected);
    }
    if (element instanceof HTMLTextAreaElement) return element.value !== element.defaultValue;
    return false;
  });
}

export function OfflineNetworkWatch() {
  const pathname = usePathname();
  const [preservingForm, setPreservingForm] = useState(false);

  useEffect(() => {
    if (pathname !== "/" && !pathname.startsWith("/records/")) return;

    const switchToOfflineWorkspace = () => {
      if (navigator.onLine) return;
      if (hasUnsavedChildForm()) {
        setPreservingForm(true);
        return;
      }
      window.location.replace("/offline.html");
    };
    const restoreOnlineState = () => setPreservingForm(false);

    switchToOfflineWorkspace();
    window.addEventListener("offline", switchToOfflineWorkspace);
    window.addEventListener("online", restoreOnlineState);
    return () => {
      window.removeEventListener("offline", switchToOfflineWorkspace);
      window.removeEventListener("online", restoreOnlineState);
    };
  }, [pathname]);

  if (!preservingForm) return null;
  return <div className="offline-network-banner" role="status">
    <strong>Connection lost.</strong> Your unsaved child form is still open. Keep this tab open, then use the offline workspace in another tab and re-enter the details to save them offline.
    <a href="/offline.html" target="_blank" rel="noreferrer">Open offline workspace</a>
  </div>;
}
