import {submitInquiry} from '@/lib/mac';
import {admitInquiry} from '@/lib/gcp-catalog';
import {createInquiryHandler} from '@/lib/inquiry-security';
export const POST=createInquiryHandler(admitInquiry,submitInquiry);
