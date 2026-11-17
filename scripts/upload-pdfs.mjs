// One-off bulk PDF upload. Matches pdfs-import/**/<ID>.pdf to articles whose study_id starts with <ID>
// (e.g. "SCOPUS_22 / Jiang et al., 2017"), uploads to the research-pdfs bucket and sets articles.pdf_url.
//
// Usage (PowerShell):
//   $env:SB_EMAIL="you@mail.com"; $env:SB_PASSWORD="..."
//   node scripts/upload-pdfs.mjs            # dry run, report only
//   node scripts/upload-pdfs.mjs --apply    # upload for real
// Add --force to also replace articles that already have a pdf_url.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
const DIR = "pdfs-import";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const { SB_EMAIL, SB_PASSWORD } = process.env;
if (!SB_EMAIL || !SB_PASSWORD) throw new Error("Set SB_EMAIL and SB_PASSWORD environment variables.");

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email: SB_EMAIL, password: SB_PASSWORD });
if (authError) throw authError;
const userId = auth.user.id;
console.log(`Project ${env.VITE_SUPABASE_URL} | user ${userId} | ${apply ? "APPLY" : "DRY RUN"}`);

const { data: articles, error } = await supabase.from("articles").select("id,study_id,pdf_url").eq("user_id", userId);
if (error) throw error;

const key = (s) => String(s ?? "").split("/")[0].trim().toLowerCase();
const byKey = new Map();
for (const a of articles) if (key(a.study_id)) byKey.set(key(a.study_id), a);

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.pdf$/i.test(entry.name)) files.push(path);
  }
})(DIR);

const counts = { uploaded: 0, skippedHasPdf: 0, noArticle: 0, failed: 0 };
for (const file of files) {
  const name = basename(file);
  const article = byKey.get(basename(name, ".pdf").toLowerCase());
  if (!article) {
    counts.noArticle++;
    console.log(`NO ARTICLE   ${name}`);
    continue;
  }
  if (article.pdf_url && !force) {
    counts.skippedHasPdf++;
    console.log(`HAS PDF      ${name}`);
    continue;
  }
  const storagePath = `${userId}/${Date.now()}_${name.replace(/[^\w.\-]+/g, "_")}`;
  if (!apply) {
    console.log(`WOULD UPLOAD ${name} -> ${article.study_id}`);
    continue;
  }
  const { error: upError } = await supabase.storage
    .from("research-pdfs")
    .upload(storagePath, readFileSync(file), { contentType: "application/pdf", upsert: false });
  if (upError) {
    counts.failed++;
    console.log(`FAILED       ${name}: ${upError.message}`);
    continue;
  }
  const { error: dbError } = await supabase.from("articles").update({ pdf_url: storagePath }).eq("id", article.id);
  if (dbError) {
    counts.failed++;
    console.log(`DB FAILED    ${name}: ${dbError.message}`);
    continue;
  }
  counts.uploaded++;
  console.log(`OK           ${name} -> ${article.study_id}`);
}
console.log(counts);
