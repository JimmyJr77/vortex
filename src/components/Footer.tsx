import { motion } from 'framer-motion'
import { Mail, Phone, MapPin, Instagram, Facebook, Twitter, ArrowUp } from 'lucide-react'

interface FooterProps {
  onContactClick: () => void
  onLoginClick?: () => void
}

const Footer = ({ onContactClick, onLoginClick }: FooterProps) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const quickLinks = [
    { name: 'FAQ', href: '#faq' },
  ]

  const socialLinks = [
    { name: 'Instagram', icon: Instagram, href: '#' },
    { name: 'Facebook', icon: Facebook, href: '#' },
    { name: 'Twitter', icon: Twitter, href: '#' },
  ]

  return (
    <footer className="bg-black text-white">
      <div className="container-custom">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-2">
              <motion.div
                className="flex items-center space-x-3 mb-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <img 
                  src="/vortex_logo_1.png" 
                  alt="Vortex Athletics" 
                  className="h-16 w-auto"
                />
              </motion.div>
              
              <motion.p
                className="text-gray-300 text-lg leading-relaxed mb-8 max-w-md"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                Transforming youth athletes into champions through cutting-edge gymnastics training, 
                advanced technology, and a relentless competitive mindset.
              </motion.p>

              <motion.div
                className="flex space-x-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                viewport={{ once: true }}
              >
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-vortex-red transition-colors duration-300"
                  >
                    <social.icon className="w-5 h-5" />
                  </a>
                ))}
              </motion.div>
            </div>

            {/* Quick Links */}
            <div>
              <motion.h4
                className="text-xl font-bold mb-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                Quick Links
              </motion.h4>
              <motion.ul
                className="space-y-3"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                viewport={{ once: true }}
              >
                {quickLinks.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-gray-300 hover:text-vortex-red transition-colors duration-300"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
                <li>
                  <button
                    onClick={onContactClick}
                    className="text-gray-300 hover:text-vortex-red transition-colors duration-300"
                  >
                    Login
                  </button>
                </li>
                {onLoginClick && (
                  <li>
                    <button
                      onClick={onLoginClick}
                      className="text-gray-300 hover:text-vortex-red transition-colors duration-300"
                    >
                      Admin
                    </button>
                  </li>
                )}
              </motion.ul>
            </div>

            {/* Contact Info */}
            <div className="lg:col-span-2">
              <motion.h4
                className="text-xl font-bold mb-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                Contact Info
              </motion.h4>
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-vortex-red" />
                  <span className="text-gray-300">team.vortexathletics@gmail.com</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-vortex-red" />
                  <span className="text-gray-300">+1 (443) 422-4794</span>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-vortex-red mt-1" />
                  <div className="text-gray-300">
                    <div>4961 Tesla Dr, Ste E</div>
                    <div className="text-sm">Bowie, MD 20715</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <motion.div
          className="border-t border-gray-800 py-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="text-center">
            <h3 className="text-2xl font-display font-bold mb-4">
              Ready to Transform?
            </h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Join the waitlist and be the first to experience the future of athletic development.
            </p>
            <motion.button
              onClick={onContactClick}
              className="btn-primary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Stay Informed
            </motion.button>
          </div>
        </motion.div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <motion.p
              className="text-gray-400 text-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              © 2024 Vortex Athletics, LLC. All rights reserved.
            </motion.p>
            
            <motion.button
              onClick={scrollToTop}
              className="flex items-center space-x-2 text-gray-400 hover:text-vortex-red transition-colors duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-sm font-medium">Back to Top</span>
              <ArrowUp className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
