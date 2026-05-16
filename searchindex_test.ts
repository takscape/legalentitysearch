import { DatabaseSync } from "node:sqlite";
import { SearchIndex, tokenize } from "./searchindex.ts";

const db = new DatabaseSync(":memory:");
db.exec(
  'CREATE VIRTUAL TABLE t USING fts5(x, tokenize="unicode61 remove_diacritics 2");',
);
const insert = db.prepare("INSERT INTO t (x) VALUES (?);");
insert.run(tokenize("Ｍａｘａｒ　Ｓｐａｃｅ　ＬＬＣ").join(" "));
insert.run(tokenize("有限会社シー・エフコーポレーション").join(" "));
insert.run(tokenize("とり八商亊有限会社").join(" "));
insert.run(
  tokenize("高崎市5-34-10Ｃａｓａ高崎503 1.(2)③ Cédille　hy-phen-a-tion").join(
    " ",
  ),
);

function toFtsQuery(query: string): string {
  const tokens = tokenize(query);
  return `${
    tokens.map((t) => `"${SearchIndex.escapePhrase(t)}"`).join(" OR ")
  }`;
}

const search = db.prepare("SELECT *,rank FROM t WHERE x MATCH ?;");
const results = search.all(toFtsQuery("llc"));
console.log(results);
