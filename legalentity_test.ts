import { assertEquals } from "@std/assert";
import {
  isValidCorporateNumber,
  LegalEntity,
  LegalEntityColumns,
} from "./legalentity.ts";

function createEmptyLegalEntity(): LegalEntity {
  return LegalEntityColumns.reduce((acc, column) => {
    acc[column] = "";
    return acc;
  }, {} as LegalEntity);
}

Deno.test("isValidCorporateNumber returns true for a valid corporate number", () => {
  const entity = createEmptyLegalEntity();
  entity.corporateNumber = "8700110005901";
  assertEquals(isValidCorporateNumber(entity), true);
});

Deno.test("isValidCorporateNumber returns false for an invalid corporate number", () => {
  const entity = createEmptyLegalEntity();

  // invalid check digit
  entity.corporateNumber = "1234567890123";
  assertEquals(isValidCorporateNumber(entity), false);

  // invalid length
  entity.corporateNumber = "87001100";
  assertEquals(isValidCorporateNumber(entity), false);
});
