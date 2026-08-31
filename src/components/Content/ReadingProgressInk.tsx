import { useCallback, useEffect, useRef, useState } from "react";
import { computeProgress } from "../../utils/scrollPosition";

interface ReadingProgressInkProps {
  scrollEl: HTMLElement | null;
}

export default function ReadingProgressInk({
  scrollEl,
}: ReadingProgressInkProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const update = useCallback(() => {
    rafRef.current = null;
    if (!scrollEl) return;
    setProgress(
      computeProgress(
        scrollEl.scrollTop,
        scrollEl.scrollHeight,
        scrollEl.clientHeight,
      ),
    );
  }, [scrollEl]);

  useEffect(() => {
    if (!scrollEl) return;
    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(update);
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    rafRef.current = requestAnimationFrame(update);
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [scrollEl, update]);

  const readHeight = `${progress * 100}%`;

  return (
    <div className="reading-ink" aria-hidden="true">
      <div className="reading-ink-read" style={{ height: readHeight }} />
      <div className="reading-ink-unread" style={{ top: readHeight }} />
    </div>
  );
}
