import {createHash} from 'node:crypto'
export function marylandElectionFingerprint(election){
 return createHash('sha256').update(JSON.stringify({filingStatus:election.filingStatus,exemptions:election.exemptions,localRate:Number(election.localRate),extraWithholdingCents:election.extraWithholdingCents??0,exempt:election.exempt===true})).digest('hex')
}
