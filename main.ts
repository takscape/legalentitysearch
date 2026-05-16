import { parseArgs, ParseOptions } from "@std/cli";
import { stringify as tomlStringify } from "@std/toml";
import { LegalEntityCsvReader } from "./legalentitycsvreader.ts";
import { isClosed, isHihyouji } from "./legalentity.ts";
import { parseCorporateName } from "./legalentitynameparser.ts";
import { normalize, Query, SearchIndex, SearchResult } from "./searchindex.ts";
import Fuse from "fuse.js";

const buildOptions: ParseOptions = {
  "--": true,
  boolean: ["force"],
  string: ["database", "_", "--"],
  alias: {
    f: "force", // delete existing index bofore run
    d: "database", // path to the index
  },
};

const searchOptions: ParseOptions = {
  "--": true,
  string: ["name", "fullName", "address", "postCode", "output", "_", "--"],
  alias: {
    d: "database", // path to the index
    f: "fullName", // full name of the legal entity
    a: "address", // address of the legal entity
    p: "postCode", // post code of the legal entity
    l: "limit", // the number of results returned (default: 20)
    o: "output", // output format (default: json)
  },
};

async function buildIndex(args: string[]) {
  const parsedArgs = parseArgs(args, buildOptions);
  const dbpath = parsedArgs.database ?? "./index.db";
  const force = parsedArgs.force ?? false;
  const rest = [...parsedArgs["_"], ...(parsedArgs["--"] ?? [])];

  if (force) {
    Deno.removeSync(dbpath);
  }

  using index = new SearchIndex(dbpath);
  for (const fname of rest) {
    using file = await Deno.open(fname.toString());
    const reader = new LegalEntityCsvReader(
      file.readable.pipeThrough(new TextDecoderStream()),
    );
    await index.addIterator(reader, (entity) => {
      return !isHihyouji(entity) && !isClosed(entity);
    });
  }
}

type Doc = {
  result: SearchResult;
  normName: string;
  normFullName: string;
  normAddress: string;
};

function rerank(query: Query, results: SearchResult[]): SearchResult[] {
  if (results.length === 0) return [];

  const keys: string[] = [];
  const q: Record<string, string>[] = [];
  if (query.name != null) {
    keys.push("normName");
    q.push({ normName: normalize(query.name) });
  }
  if (query.fullName != null) {
    keys.push("normFullName");
    q.push({ normFullName: normalize(query.fullName) });
  }
  if (query.address != null) {
    keys.push("normAddress");
    q.push({ normAddress: normalize(query.address) });
  }

  // no keys to search by, return results as-is
  if (keys.length == 0) return results;

  const docs: Doc[] = results.map((result) => {
    const parsed = parseCorporateName(normalize(result.name));
    return {
      result,
      normName: parsed.name,
      normFullName: parsed.fullName,
      normAddress: normalize(
        result.prefectureName + result.cityName + result.streetNumber,
      ),
    };
  });

  const fuse = new Fuse(docs, {
    keys: keys,
    includeScore: true,
    ignoreLocation: true,
    threshold: 1,
  });

  return fuse.search({ $or: q }).sort((a, b) => a.score! - b.score!)
    .map((item) => {
      const result = item.item.result;
      result.rank = item.score!;
      return result;
    });
}

function search(args: string[]) {
  const parsedArgs = parseArgs(args, searchOptions);
  const dbpath = parsedArgs.database ?? "./index.db";
  const rest = [...parsedArgs["_"], ...(parsedArgs["--"] ?? [])];

  using index = new SearchIndex(dbpath);

  const query: Query = {};
  query.name = rest.join(" ");
  if (parsedArgs.fullName) query.fullName = parsedArgs.fullName;
  if (parsedArgs.address) query.address = parsedArgs.address;
  if (parsedArgs.postCode) query.postCode = parsedArgs.postCode;
  if (parsedArgs.limit != null) query.limit = parsedArgs.limit;

  const results = index.search(query);
  const reranked = rerank(query, results);

  const outputFormat = parsedArgs.output?.toLowerCase() ?? "toml";
  switch (outputFormat) {
    case "json":
      console.log(JSON.stringify(reranked));
      break;
    case "toml":
      console.log(tomlStringify({ entity: reranked }));
      break;
    default:
      console.error(`Unknown output format: ${parsedArgs.output}`);
      Deno.exit(1);
  }
}

function printHelp() {
  console.error("Usage: hello COMMAND [options]");
  console.error();
  console.error("Commands:");
  console.error("  build");
  console.error("  search");
}

if (import.meta.main) {
  if (Deno.args.length > 0) {
    const command = Deno.args[0].toLowerCase();
    const args = Deno.args.slice(1);
    switch (command) {
      case "build":
        await buildIndex(args);
        break;
      case "search":
        search(args);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error();
        printHelp();
        Deno.exit(1);
    }
  } else {
    console.error("No command specified.");
    printHelp();
    Deno.exit(1);
  }
}
