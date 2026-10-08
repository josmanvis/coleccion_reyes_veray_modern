import {createHash} from "node:crypto";
import {getDb} from "./db";
export function loginAllowed(username: string): boolean {
 try {
  const db=getDb();
  db.exec("CREATE TABLE IF NOT EXISTS orc_login_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL)");
  const take=db.prepare(`INSERT INTO orc_login_limits (key,count,reset_at) VALUES (?,1,?)
   ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE MIN(count+1,101) END,
   reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count`);
  const now=Date.now();
  return db.transaction(()=>{
   const global=take.get("global",now+60000,now,now) as {count:number};
   const account=take.get(createHash("sha256").update(username.toLowerCase()).digest("hex"),now+60000,now,now) as {count:number};
   db.prepare("DELETE FROM orc_login_limits WHERE reset_at < ?").run(now-86400000);
   return global.count<=100 && account.count<=5;
  })();
 } catch {return false;}
}
