"use client";

import { Download, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let installedByEvent = false;

function getInstalledSnapshot() {
  if (typeof window === "undefined") return false;

  return (
    installedByEvent ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function subscribeToInstalled(onChange: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  const handleInstalled = () => {
    installedByEvent = true;
    onChange();
  };

  displayMode.addEventListener("change", onChange);
  window.addEventListener("appinstalled", handleInstalled);
  return () => {
    displayMode.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", handleInstalled);
  };
}

function getServerInstalledSnapshot() {
  return false;
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const isInstalled = useSyncExternalStore(
    subscribeToInstalled,
    getInstalledSnapshot,
    getServerInstalledSnapshot,
  );
  const [acceptedInstall, setAcceptedInstall] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (showHelp && !dialog.open) dialog.showModal();
    if (!showHelp && dialog.open) dialog.close();
  }, [showHelp]);

  if (isInstalled || acceptedInstall) return null;

  const handleClick = async () => {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    const prompt = installPrompt;
    setInstallPrompt(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setAcceptedInstall(true);
    } catch {
      setShowHelp(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className="secondary-button pwa-install-button"
        aria-label="Install BHW Records"
        title="Install BHW Records"
        onClick={() => void handleClick()}
      >
        <Download aria-hidden="true" />
        <span>Install app</span>
      </button>

      <dialog
        ref={dialogRef}
        className="pwa-install-dialog"
        aria-labelledby="pwa-install-title"
        onCancel={() => setShowHelp(false)}
        onClose={() => setShowHelp(false)}
      >
        <div className="pwa-dialog-heading">
          <h2 id="pwa-install-title">Install BHW Records</h2>
          <button
            type="button"
            className="text-button"
            aria-label="Close install instructions"
            onClick={() => dialogRef.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <p>Add the app to your device for quick access. Installation is offered by your browser.</p>
        <ol className="pwa-install-steps">
          <li>On iPhone or iPad, open the Share menu in Safari and choose Add to Home Screen.</li>
          <li>On Android or desktop, open the browser menu and choose Install app or Add to Home screen.</li>
        </ol>
        <div className="pwa-dialog-actions">
          <button type="button" className="secondary-button" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
