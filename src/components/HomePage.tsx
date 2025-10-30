import Hero from './Hero'
import ParallaxGym from './ParallaxGym'
import About from './About'
import Programs from './Programs'
import Technology from './Technology'

interface HomePageProps {
  onContactClick: () => void
}

const HomePage = ({ onContactClick }: HomePageProps) => {
  return (
    <>
      <Hero onContactClick={onContactClick} />
      <ParallaxGym />
      <About />
      <Programs />
      <Technology />
    </>
  )
}

export default HomePage

