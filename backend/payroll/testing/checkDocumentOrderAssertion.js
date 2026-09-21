import assert from 'node:assert/strict'

// Exercise the database handoff guard without altering the route fixture.
// Each attempted handoff is rolled back, including its synthetic observations.
export async function assertCheckDocumentObservationOrder(pool,{replacement=false,id,amountCents,paymentDate}){
 const key=replacement?'authorization_id':'issue_id'
 const observations=replacement?'payroll_check_replacement_observation':'payroll_check_issue_observation'
 const documents=replacement?'payroll_check_replacement_document_check':'payroll_check_document_check'
 const deliveries=replacement?'payroll_check_replacement_delivery':'payroll_check_delivery'
 for(const legacy of [false,true])for(const offset of ['0 seconds','1 second']){
  const db=await pool.connect()
  try{
   await db.query('BEGIN')
   let proof=(await db.query(`SELECT * FROM ${documents} WHERE ${key}=$1 ORDER BY id DESC LIMIT 1`,[id])).rows[0]
   assert.equal(proof.status,'RETAINED')
   assert.match(proof.metadata.observationWatermark,/^\d+$/)
   const download=(await db.query(`SELECT id FROM ${documents} WHERE ${key}=$1 AND status='DOWNLOADED' ORDER BY id DESC LIMIT 1`,[id])).rows[0]
   if(legacy)proof=(await db.query(`INSERT INTO ${documents}(${key},action,status,metadata,created_by,automatic,created_at) SELECT ${key},action,status,metadata-'observationWatermark',created_by,automatic,created_at FROM ${documents} WHERE id=$1 RETURNING *`,[proof.id])).rows[0]
   await db.query(`INSERT INTO ${observations}(${key},source,result,created_at) SELECT ${key},'RECOVERY',jsonb_set(result,'{status}','"STOPPED"'::jsonb),$2::timestamptz-$3::interval FROM ${observations} WHERE ${key}=$1 ORDER BY id DESC LIMIT 1`,[id,proof.created_at,offset])
   await assert.rejects(db.query(`INSERT INTO ${deliveries}(${key},document_check_id,download_check_id,delivery_date,amount_cents,reference,created_by) VALUES($1,$2,$3,$4,$5,'Synthetic rejected stopped check handoff',99)`,[id,proof.id,download.id,paymentDate,amountCents]),/Check delivery requires matching recent retained and downloaded document evidence/)
  }finally{await db.query('ROLLBACK');db.release()}
 }
}
