export function i9HiringContextEvidence({offerAcceptedOn,participationVerifiedOn,eVerify}){
 const outcome=eVerify?'participate in E-Verify':'do not participate in E-Verify'
 return `Accepted employment offer dated ${offerAcceptedOn} was reviewed in the employee hiring record. The employer's E-Verify enrollment status and hiring-site participation records were reviewed on ${participationVerifiedOn} and confirm that the employer and hiring site ${outcome}.`
}
