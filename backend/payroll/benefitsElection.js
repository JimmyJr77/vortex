import {compensationEvidence} from './employmentCompensation.js'
import {selectedBenefits} from './benefitCatalog.js'
export function benefitsElectionInput(body,policy,plans=[]){
 const fail=message=>{throw Object.assign(new Error(message),{status:400})}
 if(!policy||body.displayedTerms!==policy)fail('Benefits terms changed or are not published. Refresh and read the current offering before submitting.')
 if(!['ENROLL','WAIVE'].includes(body.choice))fail('Choose enrollment or decline the offered benefits.')
 if(typeof body.signature!=='string'||body.signature.trim().length<2||body.signature.length>200||body.confirmed!==true)fail('Enter your full name and confirm your benefits choice.')
 if(typeof body.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(body.requestKey))fail('Refresh the benefits form before submitting.')
 return {...(plans.length?{version:2,catalogSnapshot:plans,selections:selectedBenefits(body,plans)}:{version:1}),choice:body.choice,signature:body.signature.trim(),policyTerms:policy,submissionId:body.requestKey}
}
export function benefitsElectionMatches(election,policy,plans=[]){
 try{
  if(![1,2].includes(election?.version)||!['ENROLL','WAIVE'].includes(election.choice)||typeof election.signature!=='string'||election.signature.trim().length<2||typeof election.submissionId!=='string'||election.policyTerms!==policy)return false
  const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
  if(plans.length||election.version===2)return election.version===2&&same(election.catalogSnapshot,plans)&&same(election.selections,selectedBenefits(election,plans))
  return true
 }catch{return false}
}
