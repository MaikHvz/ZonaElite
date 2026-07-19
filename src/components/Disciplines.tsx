import { createClient } from "@/lib/supabase/server";

interface Discipline {
  id: string;
  name: string;
  color_hex: string;
  icon: string;
  description: string | null;
}

export default async function Disciplines() {
  const supabase = await createClient();

  const { data: disciplines } = await supabase
    .from("disciplines")
    .select("*")
    .eq("active", true)
    .order("name");

  if (!disciplines || disciplines.length === 0) {
    return null;
  }

  return (
    <section
      id="disciplinas"
      className="py-[64px] md:py-[96px] px-5 md:px-6 max-w-[1280px] mx-auto fade-up"
    >
      <div className="mb-16">
        <h2 className="font-[family-name:var(--font-headline-lg)] text-[32px] leading-[36px] md:text-[48px] md:leading-[52px] md:tracking-[0.02em] text-on-surface uppercase tracking-tighter">
          Nuestras <span className="text-primary">Disciplinas</span>
        </h2>
        <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mt-2 max-w-xl">
          Forja tu carácter y habilidades con nuestro programa integral.
          Entrenamiento de alto impacto para resultados reales.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {disciplines.map((d: Discipline) => (
          <div
            key={d.id}
            className="group relative overflow-hidden rounded-2xl bg-surface-container-low border border-on-surface/5 h-[400px] flex flex-col justify-end p-6 hover:border-primary/50 transition-colors duration-500"
          >
            <div
              className="absolute inset-0 transition-transform duration-700 group-hover:scale-110 opacity-30 group-hover:opacity-50"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${d.color_hex}, transparent 70%)`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            <div className="relative z-10">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors"
                style={{ backgroundColor: `${d.color_hex}20` }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ color: d.color_hex }}
                >
                  {d.icon}
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-headline-md)] text-[24px] leading-[28px] text-on-surface uppercase mb-2">
                {d.name}
              </h3>
              <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant line-clamp-3">
                {d.description || ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
