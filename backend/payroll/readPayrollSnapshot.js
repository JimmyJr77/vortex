// Pool callers get one consistent view across source, review and payroll reads.
// A checked-out client belongs to the caller's existing transaction.
export async function readPayrollSnapshot(db,work){
 if(typeof db.connect!=='function'||typeof db.release==='function')return work(db)
 const client=await db.connect()
 try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const value=await work(client);await client.query('COMMIT');return value}
 catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}
 finally{client.release()}
}
