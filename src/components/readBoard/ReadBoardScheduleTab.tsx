import { motion } from 'framer-motion'
import PublicSchedulingCalendar from '../scheduling/PublicSchedulingCalendar'

const ReadBoardScheduleTab = () => (
  <section className="section-padding bg-white">
    <div className="container-custom">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-8 text-center">
          Class <span className="text-vortex-red">Schedule</span>
        </h2>
        <PublicSchedulingCalendar theme="light" />
      </motion.div>
    </div>
  </section>
)

export default ReadBoardScheduleTab
