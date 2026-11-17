// Imports one reviewer's QA answers from a spreadsheet into article_qa_assessments.
//
// Expected sheet: one row per article, an "ID" column (the study id, e.g. SCOPUS_22), and ten
// columns starting with Q1..Q10 whose cells contain "Yes (1)", "Partial (0.5)" or "No (0)" (the
// rest of the cell, e.g. "| Evidence: ...", is ignored).
//
// Usage (PowerShell):
//   $env:SB_EMAIL="owner@mail.com"; $env:SB_PASSWORD="..."
//   node scripts/import-qa-assessments.mjs docs/Peer_Gabi.xlsx --reviewer gabi@mail.com            # report only
//   node scripts/import-qa-assessments.mjs docs/Peer_Gabi.xlsx --reviewer gabi@mail.com --apply    # write
// Safe to run again: existing assessments of that reviewer are updated, never duplicated.
// Rows whose ID has no article yet are skipped; run again after creating the article.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--reviewer");
const reviewerEmail = args[args.indexOf("--reviewer") + 1];
const apply = args.includes("--apply");
if (!file || !reviewerEmail) throw new Error("Usage: node scripts/import-qa-assessments.mjs <file.xlsx> --reviewer <email> [--apply]");

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

const { data: memberships } = await supabase.from("review_members").select("review_id").eq("user_id", auth.user.id);
const reviewId = memberships[0].review_id;
const { data: members, error: membersError } = await supabase.rpc("list_review_members", { p_review_id: reviewId });
if (membersError) throw membersError;
const reviewer = members.find((member) => member.email.toLowerCase() === reviewerEmail.toLowerCase());
if (!reviewer) throw new Error(`${reviewerEmail} is not a member of this review.`);
if (!reviewer.reviewer_slot) throw new Error(`${reviewerEmail} has no reviewer number; assign one in Protocol > Team first.`);

const SCORES = { Yes: 1, Partial: 0.5, No: 0 };
const key = (value) => String(value ?? "").split("/")[0].trim().toLowerCase();

const workbook = XLSX.read(readFileSync(file), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null });
const questionColumns = Object.keys(rows[0] ?? {}).filter((column) => /^Q\d+\b/.test(column));
if (questionColumns.length !== 10) throw new Error(`Expected 10 Q columns, found ${questionColumns.length}.`);

const { data: articles, error: articlesError } = await supabase.from("articles").select("id,study_id").eq("review_id", reviewId);
if (articlesError) throw articlesError;
const articleByKey = new Map(articles.map((article) => [key(article.study_id), article.id]));

const toSave = [];
const skipped = [];
for (const row of rows) {
  const articleId = articleByKey.get(key(row.ID));
  if (!articleId) {
    skipped.push(row.ID);
    continue;
  }
  const answers = {};
  let score = 0;
  questionColumns.forEach((column, index) => {
    const answer = /\b(Yes|Partial|No)\s*\(/.exec(String(row[column] ?? ""))?.[1] ?? null;
    answers[`qa_q${index + 1}`] = answer;
    score += answer ? SCORES[answer] : 0;
  });
  toSave.push({ article_id: articleId, reviewer_slot: reviewer.reviewer_slot, reviewer_id: reviewer.user_id, ...answers, qa_score: score });
}

console.log(`${apply ? "APPLY" : "DRY RUN"} | reviewer ${reviewer.email} (Reviewer ${reviewer.reviewer_slot}) | sheet rows ${rows.length}`);
console.log(`to import: ${toSave.length} | skipped (no article with this ID yet): ${skipped.length}${skipped.length ? " -> " + skipped.join(", ") : ""}`);

if (apply) {
  // One row at a time and without RETURNING: the blind-review policy hides a row from its writer
  // when they are not allowed to see that slot (e.g. an owner who has not verified their own QA).
  let saved = 0;
  const failed = [];
  for (const row of toSave) {
    let { error } = await supabase.from("article_qa_assessments").upsert(row, { onConflict: "article_id,reviewer_slot" });
    // An upsert also needs read access to the row; a plain insert covers a first import in that case.
    if (error) ({ error } = await supabase.from("article_qa_assessments").insert(row));
    if (error) failed.push(`${row.article_id}: ${error.message}`);
    else saved += 1;
  }
  console.log(`saved ${saved} assessments${failed.length ? `, ${failed.length} failed` : ""}`);
  failed.forEach((line) => console.log("  ", line));
}
