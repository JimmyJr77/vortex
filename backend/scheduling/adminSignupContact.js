import { resolveMemberContactEmail } from '../email/memberContact.js'

/** A signup contact is a notification destination, not a change to identity. */
export async function resolveAdminSignupResponses(db,member,{responses={},phone=null}={}) {
  const contact=await resolveMemberContactEmail(db,member,{includeBillingPayer:true})
  if(!contact) throw Object.assign(new Error('Add a contact email to the member, legal guardian, or active household payer before enrollment.'),{statusCode:400})
  return {...responses,first_name:member.first_name,last_name:member.last_name,email:contact.email,
    phone:member.phone || phone || responses.phone || null}
}
