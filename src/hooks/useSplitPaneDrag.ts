import { useEffect, useState } from "react";
import type { RefObject } from "react";

export function useSplitPaneDrag(enabled: boolean, containerRef: RefObject<HTMLDivElement | null>) {
  const [leftPanePercent, setLeftPanePercent] = useState(58);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  useEffect(() => {
    if (!enabled || !isDraggingSplit) return;

    const onPointerMove = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const splitterWidth = 16;
      const availableWidth = rect.width - splitterWidth;
      if (availableWidth <= 0) return;
      const minPanePx = 320;
      const minPercent = (minPanePx / availableWidth) * 100;
      const maxPercent = 100 - minPercent;
      const rawPercent = ((event.clientX - rect.left) / availableWidth) * 100;
      const clamped = Math.max(minPercent, Math.min(maxPercent, rawPercent));
      setLeftPanePercent(clamped);
    };

    const onPointerUp = () => setIsDraggingSplit(false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [enabled, isDraggingSplit, containerRef]);

  return { leftPanePercent, setLeftPanePercent, isDraggingSplit, setIsDraggingSplit };
}
