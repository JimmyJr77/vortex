const key=/^carrier-remittance-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export function carrierRemittanceSmtpTracking({category,idempotencyKey,host=process.env.SMTP_HOST}={}){
 if(category!=='payroll_carrier_remittance'||String(host||'smtp.gmail.com').trim().toLowerCase()!=='smtp.sendgrid.net')return null
 if(typeof idempotencyKey!=='string'||!key.test(idempotencyKey))throw new Error('A retained carrier remittance dispatch key is required.')
 return {provider:'smtp:sendgrid',headers:{'X-SMTPAPI':JSON.stringify({unique_args:{vortex_carrier_dispatch:idempotencyKey}})}}
}
