import { defaultEmailSignature, type VortexEmailSignature } from '../../utils/emailSignature'

export default function EmailSignaturePreview({ signature = defaultEmailSignature }: { signature?: VortexEmailSignature }) {
  const websiteUrl = `https://${signature.website.replace(/^https?:\/\//, '')}`
  const phoneNumber = signature.phone.replace(/[^\d+]/g, '')
  return <aside aria-label="Vortex email signature" className="mt-6 space-y-2 border-t border-gray-200 pt-5 text-sm leading-relaxed text-gray-700">
    <img src={signature.logoUrl} alt={signature.name} width={280} className="block h-auto max-w-full" />
    <div className="!mt-0 space-y-1">
      <p>{signature.address}</p>
      <p><a href={websiteUrl} className="underline underline-offset-2">{signature.website}</a></p>
      <p><a href={`tel:${phoneNumber}`} className="underline underline-offset-2">{signature.phone}</a></p>
    </div>
  </aside>
}
