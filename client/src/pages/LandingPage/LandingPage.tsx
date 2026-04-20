import { Navbar } from '@/components/layout/Navbar/Navbar'
import { Footer } from '@/components/layout/Footer/Footer'
import { Hero } from './components/Hero/Hero'
import { DashboardPreview } from './components/DashboardPreview/DashboardPreview'
import { Features } from './components/Features/Features'
import styles from './LandingPage.module.scss'

export function LandingPage() {
  return (
    <div className={styles.container}>
      <div className={styles.gridBackground} />
      <div className={styles.glowReflect} />
      <Navbar />
      <main>
        <Hero />
        <DashboardPreview />
        <Features />
      </main>
      <Footer />
    </div>
  )
}
