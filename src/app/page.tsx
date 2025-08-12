import styles from "./page.module.css";
import Hero from "@/components/sections/Hero";
import MembershipSection from "@/components/sections/MembershipSection";
import FeaturesAndToolsSection from "@/components/sections/FeaturesAndToolsSection";


export default function Home() {
  return (
    <div className={styles.page}>
     <Hero />
     <FeaturesAndToolsSection />
    
     <MembershipSection />
     
    </div>
  );
}
