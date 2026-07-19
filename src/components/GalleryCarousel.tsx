"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface GalleryImage {
  id: string;
  url: string;
  alt: string;
}

export default function GalleryCarousel() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("gallery_images")
      .select("id, url, alt")
      .eq("active", true)
      .order("position")
      .then(({ data }) => {
        setImages((data as GalleryImage[]) || []);
        setLoading(false);
      });
  }, []);

  const next = useCallback(() => {
    if (images.length === 0) return;
    setCurrent((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    if (images.length === 0) return;
    setCurrent((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [images.length, next]);

  if (loading || images.length === 0) return null;

  return (
    <section className="py-[64px] md:py-[96px] fade-up">
      <div className="max-w-[1280px] mx-auto px-5 md:px-6">
        <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] md:text-[32px] text-on-surface uppercase tracking-tighter mb-2">
          Nuestros <span className="text-primary">Espacios y Comunidad</span>
        </h2>
        <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant max-w-3xl mb-10">
          Conoce nuestro espacio de entrenamiento y la comunidad que nos hace únicos.
        </p>

        {/* Carousel */}
        <div className="relative rounded-2xl overflow-hidden bg-surface-container border border-on-surface/5">
          {/* Main Image */}
          <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden">
            {images.map((img, i) => (
              <div
                key={img.id}
                className={`absolute inset-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              >
                <img
                  src={img.url}
                  alt={img.alt || "Espacios ZonaElite"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              </div>
            ))}

            {/* Nav Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass-panel flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors z-10"
                >
                  <span className="material-symbols-outlined text-on-surface text-[20px]">chevron_left</span>
                </button>
                <button
                  onClick={next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass-panel flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors z-10"
                >
                  <span className="material-symbols-outlined text-on-surface text-[20px]">chevron_right</span>
                </button>
              </>
            )}
          </div>

          {/* Dots */}
          {images.length > 1 && (
            <div className="flex justify-center gap-2 py-4 bg-surface-container">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                    i === current ? "bg-primary w-6" : "bg-on-surface/20 hover:bg-on-surface/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
