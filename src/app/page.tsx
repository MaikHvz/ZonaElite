import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import IntroSection from "@/components/IntroSection";
import Disciplines from "@/components/Disciplines";
import Memberships from "@/components/Memberships";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import ContactModal from "@/components/ContactModal";
import FadeUpObserver from "@/components/FadeUpObserver";

export default function Home() {
  return (
    <>
      <FadeUpObserver />
      <Navbar />
      <main>
        <Hero />
        <IntroSection />
        <Disciplines />
        <Memberships />
        <CTA />
      </main>
      <Footer />
      <ContactModal />
    </>
  );
}
