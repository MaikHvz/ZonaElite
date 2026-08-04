import Hero from "@/components/Hero";
import IntroSection from "@/components/IntroSection";
import Disciplines from "@/components/Disciplines";
import Memberships from "@/components/Memberships";
import PersonalizedPlans from "@/components/PersonalizedPlans";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <IntroSection />
        <Disciplines />
        <Memberships />
        <PersonalizedPlans />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
