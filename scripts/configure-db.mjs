/** One-time tenant-scoped Cloud SQL access; credentials are sent only to Secret Manager. */
import fs from 'node:fs';import {createRequire} from 'node:module';import {randomBytes} from 'node:crypto';import {execFileSync} from 'node:child_process';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));const {Client}=require('pg');
const config=JSON.parse(fs.readFileSync(process.env.ORC_TEST_CONFIG || '/Users/admin/Developer/_gcp/_cutover/data/private/target-connections.json'));
const c=new Client({host:'127.0.0.1',port:15439,user:config.admin.user,password:config.admin.password,database:'axxes_prod'});
await c.connect();
try {
 const tenant=(await c.query("SELECT id FROM tenants WHERE slug=$1",['coleccion-reyes-veray'])).rows[0];if(!tenant)throw Error('Missing collection tenant');
 const id=tenant.id;const password=randomBytes(32).toString('hex');
 await c.query('BEGIN');
 await c.query('CREATE SCHEMA IF NOT EXISTS orc_public');
 const definitions={
  tenants:`SELECT id,name,slug,email FROM public.tenants WHERE id='${id}'`,
  products:`SELECT id,tenant_id,name,slug,description,short_description,price,currency,images,tags,is_featured,created_at FROM public.products WHERE tenant_id='${id}' AND status='active' AND deleted_at IS NULL`,
  artists:`SELECT id,tenant_id,slug,name,bio,lifespan,artwork_count,sort_name FROM public.artists WHERE tenant_id='${id}'`,
  pages:`SELECT id,tenant_id,title,slug,description,meta_title,meta_description,og_image,is_homepage FROM public.pages WHERE tenant_id='${id}' AND is_published=true`,
  page_blocks:`SELECT page_id,tenant_id,type,content,settings,sort_order FROM public.page_blocks WHERE tenant_id='${id}' AND is_visible=true`,
  website_settings:`SELECT tenant_id,custom_domain,subdomain,navigation_style,footer_style,show_powered_by,default_og_image,footer_text FROM public.website_settings WHERE tenant_id='${id}'`,
  contacts:`SELECT * FROM public.contacts WHERE tenant_id='${id}' AND deleted_at IS NULL`,
 };
 for(const[name,sql]of Object.entries(definitions))await c.query(`CREATE OR REPLACE VIEW orc_public.${name} WITH (security_barrier=true) AS ${sql} WITH LOCAL CHECK OPTION`);
 const exists=(await c.query("SELECT 1 FROM pg_roles WHERE rolname='orc_web'")).rowCount;
 if(!exists)await c.query(`CREATE ROLE orc_web LOGIN PASSWORD '${password}'`);
 await c.query('REVOKE ALL ON SCHEMA orc_public FROM PUBLIC');
 await c.query('GRANT USAGE ON SCHEMA orc_public TO orc_web');
 await c.query('GRANT SELECT ON ALL TABLES IN SCHEMA orc_public TO orc_web');
 await c.query('GRANT INSERT,UPDATE ON orc_public.contacts TO orc_web');
 await c.query('GRANT CONNECT ON DATABASE axxes_prod TO orc_web');
 await c.query('CREATE TABLE IF NOT EXISTS orc_public.inquiry_submissions (id uuid PRIMARY KEY,payload_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())');
 await c.query('GRANT SELECT,INSERT ON orc_public.inquiry_submissions TO orc_web');
 await c.query('COMMIT');
 if(!exists){
  const url=new URL('postgresql://localhost/axxes_prod');url.username='orc_web';url.password=password;url.searchParams.set('host','/cloudsql/gravy-meta:us-west1:axxes-prod-db');
  execFileSync('gcloud',['secrets','create','orc-database-url','--project=gravy-meta','--replication-policy=automatic','--data-file=-'],{input:url.href,stdio:['pipe','pipe','pipe']});
 }
 console.log('Tenant-scoped views and website database role configured; credential kept in Secret Manager');
} catch(e){await c.query('ROLLBACK').catch(()=>{});console.error(e.code||e.name);process.exitCode=1;}finally{await c.end();}
