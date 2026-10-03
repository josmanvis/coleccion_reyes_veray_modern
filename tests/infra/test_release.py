import unittest,importlib.util,os
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('release','frontend/scripts/gcp-release.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def service(rev='old',percent=100):return {'metadata':{'annotations':{}},'status':{'traffic':[{'revisionName':rev,'percent':percent}],'url':'https://ordinary','latestReadyRevisionName':rev}}
class ReleaseTests(unittest.TestCase):
 def fixture(self):
  before=service();current=service();current['status']['latestReadyRevisionName']='new';current['status']['traffic'].append({'revisionName':'new','tag':'ci-123','url':'https://staged'})
  return before,current
 def test_stage_then_promote_image_only(self):
  before,current=self.fixture();calls=[]
  def gc(*args):calls.append(args);return before if len(calls)==1 else current if args[:3]==('run','services','describe') else {}
  with patch.object(m,'gcloud',gc),patch.object(m,'probe') as probe:m.release('api','image@sha256:abc','123')
  deploy=next(c for c in calls if c[:2]==('run','deploy'));self.assertEqual(deploy,('run','deploy','api','--region=us-west1','--image=image@sha256:abc','--no-traffic','--tag=ci-123'));self.assertEqual(probe.call_count,2)
  self.assertIn('--to-revisions=new=100',str(calls))
 def test_postpromotion_failure_rolls_back(self):
  before,current=self.fixture();calls=[]
  def gc(*args):calls.append(args);return before if len(calls)==1 else current if args[:3]==('run','services','describe') else {}
  with patch.object(m,'gcloud',gc),patch.object(m,'probe',side_effect=[None,RuntimeError('unhealthy')]):
   with self.assertRaises(RuntimeError):m.release('api','image@sha256:abc','123')
  self.assertTrue(any('--to-revisions=old=100' in c for c in calls))
 def test_split_stops_before_deploy(self):
  before=service('old',50);before['status']['traffic'].append({'revisionName':'canary','percent':50})
  with patch.object(m,'gcloud',return_value=before) as gc:
   with self.assertRaisesRegex(RuntimeError,'traffic split'):m.release('api','digest','123')
  self.assertEqual(gc.call_count,1)
 def test_staged_failure_never_promotes(self):
  before,current=self.fixture();calls=[]
  def gc(*args):calls.append(args);return before if len(calls)==1 else current if args[:3]==('run','services','describe') else {}
  with patch.object(m,'gcloud',gc),patch.object(m,'probe',side_effect=RuntimeError('unhealthy')):
   with self.assertRaises(RuntimeError):m.release('api','digest','123')
  self.assertFalse(any(any(a.startswith('--to-revisions') for a in c) for c in calls))
 def test_internal_worker_uses_api_readiness(self):
  before,current=self.fixture();before['metadata']['annotations']['run.googleapis.com/ingress']='internal';current['status']['conditions']=[{'type':'Ready','status':'True'}];calls=[]
  def gc(*args):calls.append(args);return before if len(calls)==1 else current if args[:3]==('run','services','describe') else {}
  with patch.dict(os.environ,{'CI_READY_ONLY':'true'},clear=True),patch.object(m,'gcloud',gc),patch.object(m,'probe') as probe:m.release('webmaster-worker','digest','123')
  probe.assert_not_called();self.assertTrue(any('--to-revisions=new=100' in c for c in calls))
 def test_private_ui_requires_public_health(self):
  before,current=self.fixture();before['metadata']['annotations']['run.googleapis.com/ingress']='internal-and-cloud-load-balancing';current['status']['conditions']=[{'type':'Ready','status':'True'}];calls=[]
  def gc(*args):calls.append(args);return before if len(calls)==1 else current if args[:3]==('run','services','describe') else {}
  with patch.dict(os.environ,{},clear=True),patch.object(m,'gcloud',gc),patch.object(m,'probe'):
   with self.assertRaisesRegex(RuntimeError,'public load-balancer health URL'):m.release('webmaster','digest','123')
  self.assertFalse(any(any(a.startswith('--to-revisions') for a in c) for c in calls))
 def test_valid_redirects_reject_local_or_insecure_targets(self):
  self.assertTrue(m.valid_response(307,'https://handshake.axxes.club/sign-in'))
  self.assertTrue(m.valid_response(302,'/sign-in'))
  for location in ['https://0.0.0.0:8080/sign-in','http://handshake.axxes.club','https://localhost','https://127.0.0.1/',None]:self.assertFalse(m.valid_response(307,location))
  self.assertFalse(m.valid_response(500))
 def test_ambiguous_promotion_error_restores_previous(self):
  before,current=self.fixture();calls=[]
  def gc(*args):
   calls.append(args)
   if '--to-revisions=new=100' in args:raise RuntimeError('RPC timed out after server applied promotion')
   return before if len(calls)==1 else current if args[:3]==('run','services','describe') else {}
  with patch.object(m,'gcloud',gc),patch.object(m,'probe'):
   with self.assertRaisesRegex(RuntimeError,'RPC timed out'):m.release('api','digest','123')
  self.assertTrue(any('--to-revisions=old=100' in c for c in calls))
 def test_bundle_second_failure_rolls_back_first(self):
  with patch.object(m,'release',side_effect=[{'service':'webmaster-worker','previous':'worker-old'},RuntimeError('UI failed')]),patch.object(m,'restore') as restore:
   with self.assertRaises(RuntimeError):m.release_bundle(['webmaster-worker','webmaster'],'digest','123')
  restore.assert_called_once_with('webmaster-worker','worker-old')
 def test_auth_error_redirect_is_unhealthy(self):
  for location in ['/api/auth/error','/sign-in?error=Configuration','https://handshake.axxes.club/api/auth/error','https://handshake.axxes.club/sign-in?error=OAuthCallback']:
   self.assertFalse(m.valid_response(307,location))
 def test_tag_cleanup_failure_after_success_restores_previous(self):
  before,current=self.fixture();calls=[]
  def gc(*args):
   calls.append(args)
   if '--remove-tags=ci-123' in args:raise RuntimeError('cleanup timed out')
   return before if len(calls)==1 else current if args[:3]==('run','services','describe') else {}
  with patch.object(m,'gcloud',gc),patch.object(m,'probe'):
   with self.assertRaisesRegex(RuntimeError,'tag cleanup failed'):m.release('api','digest','123')
  self.assertTrue(any('--to-revisions=old=100' in c for c in calls))
if __name__=='__main__':unittest.main()
