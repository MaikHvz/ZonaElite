import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://zonaelite.cl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data: blogPosts } = await supabase
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("status", "publicado")
    .order("updated_at", { ascending: false });

  const { data: events } = await supabase
    .from("events")
    .select("id, updated_at")
    .order("updated_at", { ascending: false });

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/horarios`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/quienes-somos`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/productos`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/eventos`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/auth`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const blogPages: MetadataRoute.Sitemap = (blogPosts || []).map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const eventPages: MetadataRoute.Sitemap = (events || []).map((event) => ({
    url: `${BASE_URL}/eventos#${event.id}`,
    lastModified: new Date(event.updated_at),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...blogPages, ...eventPages];
}
