"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/Client/shared/components/ui/dialog";

const savedScrollKey = "bhw-admin-action-scroll";
const useRestoreLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type FeedbackDialogProps = {
  message?: string;
  isError: boolean;
  feedbackId?: string;
};

export function FeedbackDialog({ message, isError, feedbackId }: FeedbackDialogProps) {
  const feedbackToken = feedbackId ?? message ?? "";
  const [dismissedFeedback, setDismissedFeedback] = useState("");
  const open = Boolean(message) && dismissedFeedback !== feedbackToken;

  useEffect(() => {
    const rememberScroll = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement) || event.target.method.toUpperCase() === "GET") return;
      try { sessionStorage.setItem(savedScrollKey, JSON.stringify({ pathname: window.location.pathname, y: window.scrollY })); } catch { /* keep form submission working when storage is unavailable */ }
    };
    document.addEventListener("submit", rememberScroll, true);
    return () => document.removeEventListener("submit", rememberScroll, true);
  }, []);

  useRestoreLayoutEffect(() => {
    if (!message) return;
    let saved: { pathname?: string; y?: number } | undefined;
    try {
      saved = JSON.parse(sessionStorage.getItem(savedScrollKey) ?? "null") ?? undefined;
      sessionStorage.removeItem(savedScrollKey);
    } catch {
      sessionStorage.removeItem(savedScrollKey);
    }
    if (!saved || saved.pathname !== window.location.pathname || typeof saved.y !== "number") return;
    const restore = () => window.scrollTo({ top: saved!.y!, behavior: "auto" });
    restore();
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [feedbackId, message]);

  function clearFeedbackFromUrl() {
    const url = new URL(window.location.href);
    ["message", "feedbackError", "feedbackId", "assignmentMessage", "assignmentError", "assignmentUserId"].forEach((key) => url.searchParams.delete(key));
    if (url.hash.startsWith("#assignment-")) url.hash = "";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDismissedFeedback(feedbackToken);
      clearFeedbackFromUrl();
    }
  }

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    {message && <DialogContent showCloseButton={false}>
      <DialogHeader><DialogTitle>{isError ? "Could not save changes" : "Changes saved"}</DialogTitle><DialogDescription>{message}</DialogDescription></DialogHeader>
      <DialogFooter><DialogClose asChild><button className={isError ? "secondary-button" : "primary-button"} type="button">Close</button></DialogClose></DialogFooter>
    </DialogContent>}
  </Dialog>;
}
