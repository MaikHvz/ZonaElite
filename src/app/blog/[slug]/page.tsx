"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageCTA from "@/components/PageCTA";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  cover_image: string | null;
  gallery: string[];
  author_id: string;
  published_at: string | null;
  created_at: string;
  profiles?: { full_name: string };
}

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("blog_posts")
      .select("*, profiles:author_id(full_name)")
      .eq("slug", slug)
      .eq("status", "publicado")
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          router.push("/blog");
          return;
        }
        setPost(data as BlogPost);
        setLoading(false);
      });
  }, [slug, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-28 pb-16 px-5">
        <div className="max-w-3xl mx-auto flex justify-center py-20">
          <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <article className="max-w-3xl mx-auto">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 font-[family-name:var(--font-body-md)] text-[14px] text-primary hover:text-on-surface transition-colors mb-8"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Volver al blog
        </Link>

        {post.cover_image && (
          <div className="rounded-2xl overflow-hidden mb-8">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-[300px] md:h-[400px] object-cover"
            />
          </div>
        )}

        <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter mb-4">
          {post.title}
        </h1>

        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-on-surface/5">
          {post.profiles?.full_name && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[16px]">person</span>
              </div>
              <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
                {post.profiles.full_name}
              </span>
            </div>
          )}
          <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant">
            {new Date(post.published_at || post.created_at).toLocaleDateString("es-CL", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>

        <div className="prose prose-invert max-w-none">
          {post.content.split("\n").map((paragraph, i) => {
            if (paragraph.trim() === "") return <br key={i} />;
            return (
              <p
                key={i}
                className="font-[family-name:var(--font-body-lg)] text-[16px] leading-[28px] text-on-surface mb-4"
              >
                {paragraph}
              </p>
            );
          })}
        </div>

        {post.gallery && post.gallery.length > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3">
            {post.gallery.map((img: string, i: number) => (
              <div key={i} className="rounded-xl overflow-hidden">
                <img
                  src={img}
                  alt={`Galería ${i + 1}`}
                  className="w-full h-[140px] object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        )}
      </article>

      <PageCTA />
    </div>
  );
}
