import { DatabaseSync } from "node:sqlite";
import { LegalEntity, LegalEntityColumns } from "./legalentity.ts";
import { parseCorporateName } from "./legalentitynameparser.ts";

const SINGLE_QUOTE_REGEX: RegExp = /'/g;
const DOUBLE_QUOTE_REGEX: RegExp = /"/g;
const TOKEN_REGEX: RegExp = /[0-9]+|[\p{Script=Latin}]+|./gu;

/**
 * 文字列を以下のルールで正規化する。
 * - Unicode正規化 (NFKC)
 * - ひらがなをカタカナに変換
 * - "・"を削除
 * - 小文字に変換
 * - 先頭と末尾の空白を削除
 */
export function normalize(text: string): string {
  return text.normalize("NFKC").replace(/[\u3041-\u3096]/g, (match) => {
    const code = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(code);
  }).replaceAll("・", "").toLowerCase().trim();
}

/**
 * 文字列を、以下のルールでトークンに分割する。
 * - 連続する数字(0-9)を一つのトークンとする
 * - 連続するラテン文字(UnicodeのScriptプロパティが"Latin")を一つのトークンとする
 * - それ以外の文字は、一つの文字を一つのトークンとする
 * - 空白文字のみで構成されるトークンは無視する
 */
export function tokenize(str: string): string[] {
  if (!str) return [];

  const tokens = str.match(TOKEN_REGEX);

  if (!tokens) return [];

  const ret: string[] = [];

  for (const token of tokens) {
    const trimmed = token.trim();
    if (trimmed) ret.push(trimmed);
  }

  return ret;
}

function escapePhrase(text: string): string {
  return text.replace(DOUBLE_QUOTE_REGEX, '""');
}

function escapeString(text: string): string {
  return text.replace(SINGLE_QUOTE_REGEX, "''");
}

function toFtsQuery(query: string): string {
  const tokens = tokenize(normalize(query));
  return `${tokens.map((t) => `"${escapePhrase(t)}"`).join(" OR ")}`;
}

/**
 * 検索クエリ型
 */
export type Query = {
  name?: string; // 法人名から「株式会社」などの法人種別を除いたものに対する検索文字列
  fullName?: string; // 法人種別を含む完全な法人名に対する検索文字列
  address?: string; // 住所に対する検索文字列
  postCode?: string; // 郵便番号に対する検索文字列（完全一致検索）
  limit?: number; // 検索結果の最大件数（省略すると20件）
};

/**
 * 検索結果型。"rank"フィールドは検索結果アイテムのスコアを表す。スコアが小さいほど、検索条件にマッチしている。
 */
export type SearchResult = LegalEntity & { rank: number };

/**
 * 検索インデックス
 */
export class SearchIndex {
  private db?: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.createTables();
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }

  [Symbol.dispose]() {
    this.close();
  }

  private transaction<T>(callback: (db: DatabaseSync) => T): T {
    if (this.db == null) throw new Error("Database not open");

    this.db.exec("BEGIN TRANSACTION;");
    try {
      const result = callback(this.db);
      this.db.exec("COMMIT TRANSACTION;");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK TRANSACTION;");
      throw e;
    }
  }

  private createTables() {
    if (this.db == null) throw new Error("Database not open");

    const cols = LegalEntityColumns.map((col) => {
      if (col === "corporateNumber") {
        return `${col} TEXT PRIMARY KEY`;
      }
      return `${col} TEXT`;
    }).join(", ");

    const tblsql = `CREATE TABLE IF NOT EXISTS legal_entities (${cols});`;
    this.db.exec(tblsql);

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS legal_entities_fts
      USING fts5(
        name, fullName, address, postCode, corporateNumber UNINDEXED,
        tokenize="unicode61 remove_diacritics 2"
      );
    `);
  }

  search(query: Query): SearchResult[] {
    if (this.db == null) throw new Error("Database not open");

    const cols = LegalEntityColumns.map((col) => {
      return `t.${col} AS ${col}`;
    }).join(", ");

    const match = [
      query.name ? `(name : ${toFtsQuery(query.name)})` : null,
      query.fullName ? `(fullName : ${toFtsQuery(query.fullName)})` : null,
      query.address ? `(address : ${toFtsQuery(query.address)})` : null,
      query.postCode ? `(postCode : ${escapePhrase(query.postCode)})` : null,
    ].filter(Boolean).join(" AND ");

    const limit = query.limit ?? 20;

    if (match.length === 0) return [];

    const sql = `
      SELECT ${cols}, fts.rank AS rank
      FROM legal_entities_fts fts
      LEFT JOIN legal_entities t ON t.corporateNumber = fts.corporateNumber
      WHERE legal_entities_fts MATCH '${escapeString(match)}'
      ORDER BY fts.rank
      LIMIT ?;
      `;
    const search = this.db.prepare(sql);
    return search.all(limit) as SearchResult[];
  }

  get(corporateNumber: string): LegalEntity | undefined {
    if (this.db == null) throw new Error("Database not open");
    const sql = `SELECT * FROM legal_entities WHERE corporateNumber = ?;`;
    const stmt = this.db.prepare(sql);
    return stmt.get(corporateNumber) as LegalEntity | undefined;
  }

  add(legalEntities: LegalEntity[]): void {
    const cols = LegalEntityColumns.join(", ");
    const placeholders = LegalEntityColumns.map(() => "?").join(", ");
    const sql =
      `INSERT INTO legal_entities (${cols}) VALUES (${placeholders});`;
    const ftsSql =
      `INSERT INTO legal_entities_fts (name, fullName, address, postCode, corporateNumber) VALUES (?, ?, ?, ?, ?);`;

    this.transaction((db) => {
      const stmt = db.prepare(sql);
      const ftsStmt = db.prepare(ftsSql);
      for (const legalEntity of legalEntities) {
        const values = LegalEntityColumns.map((col) => legalEntity[col]);
        const name = normalize(legalEntity.name);
        const address = normalize(
          legalEntity.prefectureName + " " + legalEntity.cityName + " " +
            legalEntity.streetNumber,
        );
        const parsed = parseCorporateName(name);
        stmt.run(...values);
        ftsStmt.run(
          tokenize(parsed.name).join(" "),
          tokenize(parsed.fullName).join(" "),
          tokenize(address).join(" "),
          legalEntity.postCode,
          legalEntity.corporateNumber,
        );
      }
    });
  }

  async addIterator(
    iter: AsyncIterableIterator<LegalEntity>,
    filter: (entity: LegalEntity) => boolean = () => true,
    batchSize: number = 1000,
  ): Promise<void> {
    const batch: LegalEntity[] = [];
    for await (const legalEntity of iter) {
      if (!filter(legalEntity)) continue;
      batch.push(legalEntity);
      if (batch.length >= batchSize) {
        this.add(batch);
        batch.length = 0;
      }
    }
    if (batch.length > 0) {
      this.add(batch);
    }
  }
}
