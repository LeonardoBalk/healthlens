import { motion } from 'framer-motion'
import styles from './DashboardPreview.module.scss'

export function DashboardPreview() {
  return (
    <section className={styles.previewSection} id="demo">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className={styles.dashboardMockup}
      >
        <div className={styles.mockupHeader}>
          <div className={styles.dots}>
            <span className={styles.dotClose}></span>
            <span className={styles.dotMin}></span>
            <span className={styles.dotMax}></span>
          </div>
          <div className={styles.mockupTitle}>dashboard_preview.csv</div>
        </div>

        <div className={styles.mockupBody}>
          <div className={styles.mockupSidebar}>
            <div className={styles.fakeItemActive}></div>
            <div className={styles.fakeItem}></div>
            <div className={styles.fakeItem}></div>
          </div>

          <div className={styles.mockupContent}>
            <div className={styles.mockupMetrics}>
              <div className={styles.mockupCard}>
                <p className="text-muted text-xs">Total Patients</p>
                <h3 className="text-xl mt-1">1,245</h3>
              </div>
              <div className={styles.mockupCard}>
                <p className="text-muted text-xs">Recovery Rate</p>
                <h3 className="text-success text-xl mt-1">94.2%</h3>
              </div>
              <div className={styles.mockupCard}>
                <p className="text-muted text-xs">Critical Alerts</p>
                <h3 className="text-danger text-xl mt-1">12</h3>
              </div>
            </div>

            <div className={styles.mockupMainRow}>
              <div className={styles.mockupChart}>
                <div className={styles.chartBars}>
                  <div className={styles.barLine} style={{ height: '40%' }}></div>
                  <div className={styles.barLine} style={{ height: '70%' }}></div>
                  <div className={styles.barLine} style={{ height: '55%' }}></div>
                  <div className={styles.barLine} style={{ height: '90%' }}></div>
                  <div className={styles.barLine} style={{ height: '60%' }}></div>
                  <div className={styles.barLine} style={{ height: '80%' }}></div>
                </div>
              </div>
              <div className={styles.mockupChat}></div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
