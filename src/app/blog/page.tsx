"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageCTA from "@/components/PageCTA";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  cover_image: string | null;
  gallery: string[];
  published_at: string | null;
  created_at: string;
  profiles?: { full_name: string; photo_url: string | null };
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("blog_posts")
      .select("*, profiles:author_id(full_name, photo_url)")
      .eq("status", "publicado")
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setPosts((data as BlogPost[]) || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <div className="max-w-[680px] mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[48px] text-on-surface uppercase tracking-tighter mb-2">
            Blog <span className="text-primary">ZonaElite</span>
          </h1>
          <p className="font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] text-on-surface-variant">
            Noticias, consejos y novedades de nuestra academia
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-on-surface/20 text-7xl mb-4 block">
              article
            </span>
            <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant">
              No hay publicaciones disponibles aún
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-surface-container-lowest border border-on-surface/5 rounded-2xl overflow-hidden"
              >
                {/* Header: autor + fecha */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                  <div className="w-10 h-10 rounded-full btn-primary-gradient flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-white text-[18px]">person</span>
                  </div>
                  <div>
                    <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface font-medium">
                      {post.profiles?.full_name || "ZonaElite"}
                    </p>
                    <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">
                      {new Date(post.published_at || post.created_at).toLocaleDateString("es-CL", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Título */}
                <div className="px-5 pb-3">
                  <h2 className="font-[family-name:var(--font-headline-md)] text-[20px] text-on-surface uppercase">
                    {post.title}
                  </h2>
                </div>

                {/* Imagen principal */}
                {post.cover_image && (
                  <div className="w-full">
                    <img
                      src={post.cover_image}
                      alt={post.title}
                      className="w-full h-auto max-h-[500px] object-cover"
                    />
                  </div>
                )}

                {/* Contenido */}
                <div className="px-5 pt-3 pb-4">
                  {post.content.split("\n").map((paragraph, i) => {
                    if (paragraph.trim() === "") return null;
                    return (
                      <p
                        key={i}
                        className="font-[family-name:var(--font-body-md)] text-[14px] leading-[24px] text-on-surface mb-2"
                      >
                        {paragraph}
                      </p>
                    );
                  })}
                </div>

                {/* Galería */}
                {post.gallery && post.gallery.length > 0 && (
                  <div className="px-5 pb-4 grid grid-cols-2 gap-1.5">
                    {post.gallery.map((img: string, i: number) => (
                      <div key={i} className="rounded-lg overflow-hidden">
                        <img
                          src={img}
                          alt={`Galería ${i + 1}`}
                          className="w-full h-[140px] object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Separator */}
                <div className="border-t border-on-surface/5 mx-5" />

                {/* Acciones */}
                <div className="flex items-center gap-6 px-5 py-3">
                  <button className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[20px]">share</span>
                    <span className="font-[family-name:var(--font-body-md)] text-[13px]">Compartir</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <PageCTA />
    </div>
  );
}
