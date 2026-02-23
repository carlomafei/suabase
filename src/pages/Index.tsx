import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <div id="problema">
        <ProblemSection />
      </div>
      <div id="solucao">
        <SolutionSection />
      </div>
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
