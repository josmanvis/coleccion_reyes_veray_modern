import importlib.util,unittest,tempfile,tarfile,io,json
from pathlib import Path
spec=importlib.util.spec_from_file_location('scan','frontend/scripts/gcp-scan-image.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class LayerTests(unittest.TestCase):
 def image(self,root,name,content,deleted=False):
  image=root/'image.tar';blob=io.BytesIO()
  with tarfile.open(fileobj=blob,mode='w') as t:
   member=tarfile.TarInfo(name);data=content.encode();member.size=len(data);t.addfile(member,io.BytesIO(data))
  layer=blob.getvalue();layers=['a/layer.tar'];extra=[]
  if deleted:
   top=io.BytesIO()
   with tarfile.open(fileobj=top,mode='w') as t:
    member=tarfile.TarInfo('app/.wh..env.production');member.size=0;t.addfile(member,io.BytesIO(b''))
   layers.append('b/layer.tar');extra.append(('b/layer.tar',top.getvalue()))
  manifest=json.dumps([{'Layers':layers}]).encode()
  with tarfile.open(image,'w') as t:
   for name,data in [('a/layer.tar',layer),('manifest.json',manifest)]+extra:
    info=tarfile.TarInfo(name);info.size=len(data);t.addfile(info,io.BytesIO(data))
  return str(image)
 def test_deleted_dotenv_in_prior_layer_still_fails(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);image=self.image(root,'app/.env.production','AUTH_SECRET=private-layer-secret',deleted=True);self.assertFalse(m.scan(image,str(root/'absent'))['passed'])
 def test_embedded_secret_detected_without_dotenv(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);secret=root/'env';secret.write_text('AUTH_SECRET="private-layer-secret"\nNEXT_PUBLIC_KEY=public-value\n');image=self.image(root,'app/server.js','const value="private-layer-secret"');result=m.scan(image,str(secret));self.assertTrue(result['credentialValueMatch']);self.assertFalse(result['passed'])
 def test_smtp_pass_embedded_in_deleted_layer_is_detected(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);secret=root/'env';secret.write_text('SMTP_PASS="smtp-private-layer-password"\n');image=self.image(root,'app/server.js','const smtp="smtp-private-layer-password"',deleted=True);result=m.scan(image,str(secret));self.assertTrue(result['credentialValueMatch']);self.assertFalse(result['passed']);self.assertEqual(result['checkedSecretValueCount'],1)
 def test_public_value_and_env_example_are_allowed(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);secret=root/'env';secret.write_text('AUTH_SECRET="private-layer-secret"\nNEXT_PUBLIC_KEY=public-value\n');image=self.image(root,'app/.env.example','NEXT_PUBLIC_KEY=public-value');self.assertTrue(m.scan(image,str(secret))['passed'])
if __name__=='__main__':unittest.main()
