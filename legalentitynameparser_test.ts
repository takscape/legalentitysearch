import { assertEquals } from "@std/assert";
import { parseCorporateName } from "./legalentitynameparser.ts";

Deno.test("parseCorporateName returns the correct prefix and suffix", () => {
  let c = parseCorporateName("隠岐島後製材業協同組合");
  assertEquals(c.name, "隠岐島後製材業");
  assertEquals(c.prefix, "");
  assertEquals(c.suffix, "協同組合");
  assertEquals(c.fullName, "隠岐島後製材業協同組合");

  c = parseCorporateName("西田生産森林組合");
  assertEquals(c.name, "西田生産森林組合");
  assertEquals(c.prefix, "");
  assertEquals(c.suffix, "");
  assertEquals(c.fullName, "西田生産森林組合");

  c = parseCorporateName("島根県身体障害者団体連合会");
  assertEquals(c.name, "島根県身体障害者団体");
  assertEquals(c.prefix, "");
  assertEquals(c.suffix, "連合会");
  assertEquals(c.fullName, "島根県身体障害者団体連合会");

  c = parseCorporateName("島根県厚生農業協同組合連合会");
  assertEquals(c.name, "島根県厚生");
  assertEquals(c.prefix, "");
  assertEquals(c.suffix, "農業協同組合連合会");
  assertEquals(c.fullName, "島根県厚生農業協同組合連合会");

  c = parseCorporateName("一般社団法人イワミノチカラ");
  assertEquals(c.name, "イワミノチカラ");
  assertEquals(c.prefix, "一般社団法人");
  assertEquals(c.suffix, "");
  assertEquals(c.fullName, "一般社団法人イワミノチカラ");
});
