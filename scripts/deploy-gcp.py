"""Deploy ORC and add only its host/DNS records; never print credentials."""
import argparse, json, pathlib, subprocess, urllib.request, time
PROJECT='gravy-meta'; REGION='us-west1'; HOST='orc.axxes.app'; IP='136.81.161.193'
SCRATCH=pathlib.Path(__file__).resolve().parents[1]/'.superpowers/orc'
SCRATCH.mkdir(parents=True,exist_ok=True)
def gc(*args):
 p=subprocess.run(['gcloud',*args,'--project='+PROJECT,'--quiet','--format=json'],capture_output=True,text=True)
 if p.returncode:raise RuntimeError(p.stderr[-1800:])
 return json.loads(p.stdout) if p.stdout.strip() else None
def api(url,token,data=None,method=None):
 req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},data=json.dumps(data).encode() if data is not None else None,method=method)
 with urllib.request.urlopen(req,timeout=40) as r:return json.load(r)
def route():
 mapping=gc('compute','url-maps','describe','axxes-lb','--global')
 (SCRATCH/'url-map-before.json').write_text(json.dumps(mapping,indent=2))
 rules=mapping.setdefault('hostRules',[])
 existing=[r for r in rules if HOST in r['hosts']]
 if existing:
  assert len(existing)==1 and existing[0]['pathMatcher']=='orc-matcher','Conflicting ORC route'
  print('ORC route already configured');return
 rules.append({'hosts':[HOST],'pathMatcher':'orc-matcher'})
 mapping.setdefault('pathMatchers',[]).append({'name':'orc-matcher','defaultService':f'https://www.googleapis.com/compute/v1/projects/{PROJECT}/global/backendServices/orc-be'})
 for key in ['creationTimestamp','id','kind','selfLink']:mapping.pop(key,None)
 token=subprocess.check_output(['gcloud','auth','print-access-token'],text=True).strip()
 operation=api(f'https://compute.googleapis.com/compute/v1/projects/{PROJECT}/global/urlMaps/axxes-lb',token,mapping,'PUT')
 for _ in range(30):
  result=gc('compute','operations','describe',operation['name'],'--global')
  if result.get('status')=='DONE':
   assert not result.get('error'), 'URL map operation failed'
   break
  time.sleep(1)
 else:raise RuntimeError('URL map operation did not finish')
 print('ORC route configured with concurrency fingerprint')
def dns():
 token=pathlib.Path('/Users/admin/.cloudflare-token').read_text().strip()
 def cf(path,data=None,method=None):
  reply=api('https://api.cloudflare.com/client/v4/'+path,token,data,method)
  assert reply['success'],'Cloudflare DNS operation failed'
  return reply['result']
 zones=cf('zones?name=axxes.app');assert len(zones)==1
 zone=zones[0]['id'];records=cf(f'zones/{zone}/dns_records?name={HOST}')
 (SCRATCH/'dns-before.json').write_text(json.dumps(records,indent=2))
 addresses=[r for r in records if r['type'] in ['A','AAAA','CNAME']]
 assert not addresses or len(addresses)==1 and addresses[0]['type']=='A' and addresses[0]['content']==IP,'Existing DNS conflicts; refusing overwrite'
 if not addresses:cf(f'zones/{zone}/dns_records',{'type':'A','name':HOST,'content':IP,'ttl':300,'proxied':False,'comment':'ORC GCP Cloud Run website'},'POST')
 existing=gc('dns','record-sets','list','--zone=axxes-migration-axxes-app','--name='+HOST+'.')
 old=[r for r in existing if r['type'] in ['A','AAAA','CNAME']]
 assert not old or len(old)==1 and old[0]['type']=='A' and old[0]['rrdatas']==[IP],'Google DNS conflicts'
 if not old:gc('dns','record-sets','create',HOST+'.','--zone=axxes-migration-axxes-app','--type=A','--ttl=300','--rrdatas='+IP)
 print('Authoritative and mirrored DNS configured')
def deploy(image):
 assert image.startswith('us-west1-docker.pkg.dev/gravy-meta/orc/site@sha256:'),'Deploy a verified digest'
 gc('run','deploy','orc','--region='+REGION,'--image='+image,'--service-account=orc-runtime@gravy-meta.iam.gserviceaccount.com','--allow-unauthenticated','--ingress=internal-and-cloud-load-balancing','--cpu=1','--memory=512Mi','--min=0','--max=3','--concurrency=40','--cpu-throttling','--timeout=60','--set-env-vars=NODE_ENV=production','--set-cloudsql-instances=gravy-meta:us-west1:axxes-prod-db','--set-secrets=ORC_DATABASE_URL=orc-database-url:1','--labels=client=coleccion-reyes-veray,app=orc')
 print('ORC deployed with request billing and zero minimum instances')
p=argparse.ArgumentParser();p.add_argument('action',choices=['deploy','route','dns']);p.add_argument('--image');a=p.parse_args()
if a.action=='deploy':deploy(a.image)
elif a.action=='route':route()
else:dns()
