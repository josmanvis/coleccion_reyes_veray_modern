import {submitInquiry} from '@/lib/mac';
import {queryInquiryAdmission} from '@/lib/gcp-catalog';
import {createInquiryHandler} from '@/lib/inquiry-security';
import {consume} from '@/lib/security/admission-core.mjs';
export const POST=createInquiryHandler((identity,limit,seconds)=>consume(queryInquiryAdmission,identity,limit,seconds,1,'orc_security_rate_limits'),submitInquiry);
