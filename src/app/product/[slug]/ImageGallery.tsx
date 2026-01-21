"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Props = {
  images: string[];
  title: string;
};

export default function ImageGallery({ images, title }: Props) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const canPrev = idx > 0;
  const canNext = idx < images.length - 1;

  const goPrev = () => canPrev && setIdx((i) => i - 1);
  const goNext = () => canNext && setIdx((i) => i + 1);

  // keyboard ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx]);

  // simple swipe
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let startX = 0;
    let dragging = false;

    const down = (e: PointerEvent) => {
      dragging = true;
      startX = e.clientX;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (dx > 60) { goPrev(); dragging = false; }
      else if (dx < -60) { goNext(); dragging = false; }
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [idx]);

  if (!images?.length) {
    return <div className="relative aspect-square rounded-xl bg-gray-100" />;
  }

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        className="relative aspect-square overflow-hidden rounded-xl bg-gray-50 ring-1 ring-gray-100"
      >
        <Image
          key={images[idx]}
          src={images[idx]}
          alt={`${title} - image ${idx + 1}`}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
        />

        <button
          onClick={goPrev}
          aria-label="Previous image"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow hover:bg-white disabled:opacity-40"
          disabled={!canPrev}
        >
          ‹
        </button>
        <button
          onClick={goNext}
          aria-label="Next image"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow hover:bg-white disabled:opacity-40"
          disabled={!canNext}
        >
          ›
        </button>

        <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
          {idx + 1}/{images.length}
        </div>
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => {
            const active = i === idx;
            return (
              <button
                key={`${src}-${i}`}
                onClick={() => setIdx(i)}
                className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 transition
                  ${active ? "ring-black" : "ring-transparent hover:ring-gray-300"}`}
                aria-label={`Show image ${i + 1}`}
              >
                <Image src={src} alt={`${title} thumb ${i + 1}`} fill sizes="64px" className="object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
