// Lists tr("…") strings in the admin UI that have no English in lib/i18n-admin.ts.
//   node scripts/check-i18n.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

const dict = fs.readFileSync(path.join(root, "src/lib/i18n-admin.ts"), "utf8");
const have = new Set();
for (const m of dict.matchAll(/^\s+("(?:[^"\\]|\\.)*"):/gm)) have.add(JSON.parse(m[1]));

const missing = new Set();
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) scan(p);
  }
}
function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  (function visit(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "tr") {
      const a = n.arguments[0];
      const lits = !a ? [] : ts.isConditionalExpression(a) ? [a.whenTrue, a.whenFalse] : [a];
      for (const l of lits) if ((ts.isStringLiteral(l) || ts.isNoSubstitutionTemplateLiteral(l)) && !have.has(l.text)) missing.add(`${path.relative(root, file)}: ${l.text}`);
    }
    ts.forEachChild(n, visit);
  })(sf);
}
for (const d of ["src/app/(admin)", "src/app/login", "src/components/inventory"]) walk(path.join(root, d));
if (missing.size) console.log([...missing].sort().join("\n"));
console.log(`\n${missing.size} string(s) without an English entry`);
