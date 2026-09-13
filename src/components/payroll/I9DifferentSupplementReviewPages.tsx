import {useCallback} from 'react'
import W4PdfReview from './W4PdfReview'
import {workforceApi} from '../../utils/workforceApi'
export default function I9DifferentSupplementReviewPages({employeeId,taskId,reviewId,previewSha256,documentKey,pdfBase64,pageCount,title}:{employeeId:number;taskId:string|number;reviewId:string|number;previewSha256:string;documentKey:string;pdfBase64:string;pageCount:number;title:string}){
 const displayed=useCallback(async(page:number)=>{await workforceApi.differentSupplementPage(employeeId,taskId,{reviewId,previewSha256,documentKey,page,displayed:true})},[employeeId,taskId,reviewId,previewSha256,documentKey])
 return <W4PdfReview pdfBase64={pdfBase64} pageCount={pageCount} formName={title} reviewTitle={title} editionLabel="01/20/25" onDisplayed={displayed}/>
}
