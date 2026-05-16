import { assertEquals } from "@std/assert";
import { LegalEntityColumns } from "./legalentity.ts";
import { LegalEntityCsvReader } from "./legalentitycsvreader.ts";

Deno.test("LegalEneityCsvReader reads one CSV row as LegalEntity", async () => {
  const values = LegalEntityColumns.map((_, i) => `v${i}`);
  values[1] = "1234567890123"; // corporateNumber

  const path = await Deno.makeTempFile({ dir: ".", suffix: ".csv" });
  await Deno.writeTextFile(path, `${values.join(",")}\n`);

  try {
    using file = await Deno.open(path);
    const reader = new LegalEntityCsvReader(
      file.readable.pipeThrough(new TextDecoderStream()),
    );
    const first = await reader.next();
    assertEquals(first.done, false);
    assertEquals(first.value.corporateNumber, "1234567890123");

    const second = await reader.next();
    assertEquals(second.done, true);
  } finally {
    await Deno.remove(path);
  }
});
