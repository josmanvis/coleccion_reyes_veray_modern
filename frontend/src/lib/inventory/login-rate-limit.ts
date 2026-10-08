import {createHash} from "node:crypto";
import {getDb} from "./db";
export function loginAllowed(username: string): boolean {
 try {
  const db=getDb();
  db.exec("CREATE TABLE IF NOT EXISTS orc_login_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL)");
  db.exec("CREATE INDEX IF NOT EXISTS orc_login_limits_expiry ON orc_login_limits(reset_at)");
  const key=createHash("sha256").update(username.trim().toLowerCase()).digest("hex");
  const take=db.prepare(`INSERT INTO orc_login_limits (key,count,reset_at) VALUES (?,1,?)
   ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE MIN(count+1,101) END,
   reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count`);
  const now=Date.now();
  return db.transaction(()=>{
   db.prepare("DELETE FROM orc_login_limits WHERE key IN (SELECT key FROM orc_login_limits WHERE reset_at < ? AND key NOT IN (?, ?) LIMIT 20)").run(now-3600000,"global",key);
   const global=take.get("global",now+60000,now,now) as {count:number};
   if(global.count>100)return false;
   const account=take.get(key,now+60000,now,now) as {count:number};
   return global.count<=100 && account.count<=5;
  })();
 } catch {return false;}
}
