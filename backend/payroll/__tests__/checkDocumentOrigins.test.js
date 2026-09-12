import test from 'node:test'
import assert from 'node:assert/strict'
import {checkDocumentDownloadOrigins} from '../checkDocument.js'
test('check PDF redirects use exact server-owned HTTPS origins',()=>{
 assert.deepEqual(checkDocumentDownloadOrigins(''),[])
 assert.deepEqual(checkDocumentDownloadOrigins(' https://documents.example.test,https://documents.example.test/ '),['https://documents.example.test'])
 for(const input of [null,'not-a-url','http://documents.example.test','https://user:secret@documents.example.test','https://documents.example.test:8443','https://documents.example.test/path','https://documents.example.test/?token=secret','https://documents.example.test/#fragment'])assert.throws(()=>checkDocumentDownloadOrigins(input),e=>e.status===503)
})
