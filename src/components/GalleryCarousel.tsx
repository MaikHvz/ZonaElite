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
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data, error } = await supabase
          .from("gallery_images")
          .select("id, url, alt")
          .eq("active", true)
          .order("position");
        if (error) {
          console.error("[GalleryCarousel] fetch error:", error);
        }
        setImages((data as GalleryImage[]) || []);
      } catch (err) {
        console.error("[GalleryCarousel] unexpected error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const next = useCallback(() => {
    setCurrent((prev) => prev + 1);
  }, []);

  const prev = useCallback(() => {
    setCurrent((prev) => prev - 1);
  }, []);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [images.length, next]);

  if (loading) return null;
  if (images.length === 0) return null;

  const validImages = images.filter((img) => !imgError[img.id]);
  if (validImages.length === 0) return null;

  const safeCurrent = validImages.length === 0 ? 0 : ((current % validImages.length) + validImages.length) % validImages.length;

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
            {validImages.map((img, i) => (
              <div
                key={img.id}
                className={`absolute inset-0 transition-opacity duration-700 ${i === safeCurrent ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              >
                <img
                  src={img.url}
                  alt={img.alt || "Espacios ZonaElite"}
                  className="w-full h-full object-cover"
                  onError={() => setImgError((prev) => ({ ...prev, [img.id]: true }))}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              </div>
            ))}

            {/* Nav Arrows */}
            {validImages.length > 1 && (
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
          {validImages.length > 1 && (
            <div className="flex justify-center gap-2 py-4 bg-surface-container">
              {validImages.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                    i === safeCurrent ? "bg-primary w-6" : "bg-on-surface/20 hover:bg-on-surface/40"
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
