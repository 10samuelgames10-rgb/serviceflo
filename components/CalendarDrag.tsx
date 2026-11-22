"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { moveJob } from "@/app/actions";
import { fmtDate } from "@/lib/format";

type Pending = { id: string; label: string; from: string; to: string };

/**
 * Lets people drag a job chip (any element with data-job) onto a day
 * (any element with data-drop-date). Nothing moves until they confirm,
 * and they choose whether the customer gets a text about the new time.
 */
export function CalendarDrag() {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState("");
  const [busy, start] = useTransition();

  useEffect(() => {
    let dragging: { id: string; label: string; from: string } | null = null;
    let over: HTMLElement | null = null;
    const clearOver = () => { over?.classList.remove("drop-over"); over = null; };

    const onStart = (e: DragEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-job]");
      if (!el) return;
      dragging = { id: el.dataset.job!, label: el.dataset.label ?? "", from: el.dataset.date ?? "" };
      e.dataTransfer?.setData("text/plain", dragging.id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      el.classList.add("dragging");
    };
    const onOver = (e: DragEvent) => {
      if (!dragging) return;
      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-drop-date]");
      if (!cell) return;
      e.preventDefault();
      if (over !== cell) { clearOver(); over = cell; cell.classList.add("drop-over"); }
    };
    const onDrop = (e: DragEvent) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-drop-date]");
      if (!cell || !dragging) return;
      e.preventDefault();
      const to = cell.dataset.dropDate!;
      if (to !== dragging.from) setPending({ ...dragging, to });
      clearOver();
    };
    const onEnd = () => {
      document.querySelectorAll(".dragging").forEach((n) => n.classList.remove("dragging"));
      clearOver();
      dragging = null;
    };
    document.addEventListener("dragstart", onStart);
    document.addEventListener("dragover", onOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragend", onEnd);
    return () => {
      document.removeEventListener("dragstart", onStart);
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragend", onEnd);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const confirm = (notify: boolean) => {
    if (!pending) return;
    const p = pending;
    start(async () => {
      const r = await moveJob(p.id, p.to, notify);
      setPending(null);
      if (!r.ok) setToast(r.error);
      else if (notify && r.texted) setToast(`Moved to ${fmtDate(p.to)}. Text to the customer is queued.`);
      else if (notify && !r.hadPhone) setToast(`Moved to ${fmtDate(p.to)}. No text sent: there's no phone number on file.`);
      else setToast(`Moved to ${fmtDate(p.to)}.`);
      router.refresh();
    });
  };

  return (
    <>
      {pending ? (
        <div className="dropbar" role="dialog" aria-label="Confirm move">
          <span>Move <b>{pending.label}</b> from {fmtDate(pending.from)} to <b>{fmtDate(pending.to)}</b>?</span>
          <div className="dropbar-btns">
            <button className="btn pri" disabled={busy} onClick={() => confirm(true)}>Move and text customer</button>
            <button className="btn" disabled={busy} onClick={() => confirm(false)}>Move without texting</button>
            <button className="btn ghost" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>
  );
}
