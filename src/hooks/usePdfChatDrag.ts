import { useEffect, useState } from "react";
import type { RefObject } from "react";

export function usePdfChatDrag(enabled: boolean, containerRef: RefObject<HTMLDivElement | null>) {
  const [pdfChatWidth, setPdfChatWidth] = useState(360);
  const [isDraggingPdfSplit, setIsDraggingPdfSplit] = useState(false);

  useEffect(() => {
    if (!enabled || !isDraggingPdfSplit) return;

    const onPointerMove = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const splitterWidth = 12;
      const minChatPx = 320;
      const minPdfPx = 480;
      const maxChatByWidth = rect.width - splitterWidth - minPdfPx;
      const maxChatPx = Math.max(minChatPx, Math.min(560, maxChatByWidth));
      const nextChatWidth = rect.right - event.clientX;
      const clamped = Math.max(minChatPx, Math.min(maxChatPx, nextChatWidth));
      setPdfChatWidth(clamped);
    };

    const onPointerUp = () => setIsDraggingPdfSplit(false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [enabled, isDraggingPdfSplit, containerRef]);

  return { pdfChatWidth, isDraggingPdfSplit, setIsDraggingPdfSplit };
}
