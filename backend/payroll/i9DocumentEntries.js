import {createHash} from 'node:crypto'
export function i9DocumentEntries(answers){
 const selected=answers.documentChoice==='LIST_A'?answers.listA.map((values,index)=>({key:`A${index+1}`,label:`List A document ${index+1}`,values})):[{key:'B',label:'List B document',values:answers.listB},{key:'C',label:'List C document',values:answers.listC}]
 return selected.map(row=>({...row,fingerprint:createHash('sha256').update(JSON.stringify({key:row.key,values:row.values})).digest('hex')}))
}
