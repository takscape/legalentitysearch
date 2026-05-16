import { z } from "zod";
import { DateTime } from "luxon";

const corporateNumberSchema = z.string().regex(/^[0-9]{13}$/);
export type CorporateNumber = z.infer<typeof corporateNumberSchema>;

/**
 * 処理区分
 */
export const Process = {
  Assign: "01", // 法人番号指定
  ChangeName: "11", // 商号/名称変更
  ChangeAddress: "12", // 所在地変更
  ChangeAddressOutside: "13", // 国外所在地変更
  Close: "21", // 登記記録閉鎖
  Restore: "22", // 登記記録復活
  Merge: "71", // 吸収合併
  VoidMerger: "72", // 吸収合併無効
  Cancel: "81", // 登記抹消
  Withdraw: "99", // 撤回
} as const;
const processSchema = z.enum(Process);
export type Process = z.infer<typeof processSchema>;

/**
 * 法人種別
 */
export const Kind = {
  GovernmentalEntity: "101", // 国の機関
  LocalPublicEntity: "201", // 地方公共団体
  StockCompany: "301", // 株式会社
  SpecialLimitedLiabilityCompany: "302", // 特例有限会社
  GeneralPartnershipCompany: "303", // 合名会社
  LimitedPartnershipCompany: "304", // 合資会社
  LimitedLiabilityCompany: "305", // 合同会社
  OtherEntity: "399", // その他の設立登記法人
  ForeignEntity: "401", // 外国法人
  UnregisteredEntity: "499", // その他の登記を行わない法人
} as const;
const kindSchema = z.enum(Kind);
export type Kind = z.infer<typeof kindSchema>;

/**
 * 閉鎖事由
 */
export const CloseCause = {
  Liquidation: "01", // 清算
  Merger: "02", // 合併
  ByRegistrar: "21", // 登記官による閉鎖
  Other: "31", // その他
} as const;
const closeCauseSchema = z.enum(CloseCause);
export type CloseCause = z.infer<typeof closeCauseSchema>;

/**
 * 法人情報の列名一覧
 */
export const LegalEntityColumns = [
  "sequenceNumber",
  "corporateNumber",
  "process",
  "correct",
  "updateDate",
  "changeDate",
  "name",
  "nameImageId",
  "kind",
  "prefectureName",
  "cityName",
  "streetNumber",
  "addressImageId",
  "prefectureCode",
  "cityCode",
  "postCode",
  "addressOutside",
  "addressOutsideImageId",
  "closeDate",
  "closeCause",
  "successorCorporateNumber",
  "changeCause",
  "assignmentDate",
  "latest",
  "enName",
  "enPrefectureName",
  "enCityName",
  "enAddressOutside",
  "furigana",
  "hihyoji",
] as const;

/**
 * 法人情報型
 */
export type LegalEntity = {
  [K in typeof LegalEntityColumns[number]]: string;
};

const dateSchema = z.iso.date();

/**
 * チェック・ディジットを検証し、有効な13桁の法人番号なら、trueを返す。
 */
export function isValidCorporateNumber(entity: LegalEntity): boolean {
  // Ref: https://www.houjin-bangou.nta.go.jp/documents/checkdigit.pdf
  const result = corporateNumberSchema.safeParse(entity.corporateNumber);
  if (result.success) {
    const corporateNumber = result.data;
    const weights = [0, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];
    const sum = corporateNumber.split("").reduce((acc, char, index) => {
      return acc + parseInt(char) * weights[index];
    }, 0);
    const checkDigit = 9 - (sum % 9);
    return checkDigit === parseInt(corporateNumber[0]);
  }

  return false;
}

export function getProcess(entity: LegalEntity): Process {
  return processSchema.parse(entity.process);
}

export function isCorrected(entity: LegalEntity): boolean {
  return entity.correct === "1";
}

export function getKind(entity: LegalEntity): Kind {
  return kindSchema.parse(entity.kind);
}

export function getCloseCause(entity: LegalEntity): CloseCause {
  return closeCauseSchema.parse(entity.closeCause);
}

/**
 * 日付文字列をDateオブジェクトに変換する。タイムゾーンが"Asia/Tokyo"であるとみなす。
 */
function toDate(datestr: string): Date {
  return DateTime.fromISO(dateSchema.parse(datestr), { zone: "Asia/Tokyo" })
    .toJSDate();
}

export function getUpdateDate(entity: LegalEntity): Date {
  return toDate(entity.updateDate);
}

export function getChangeDate(entity: LegalEntity): Date {
  return toDate(entity.changeDate);
}

export function getCloseDate(entity: LegalEntity): Date {
  return toDate(entity.closeDate);
}

export function getAssignmentDate(entity: LegalEntity): Date {
  return toDate(entity.assignmentDate);
}

export function isLatest(entity: LegalEntity): boolean {
  return entity.latest === "1";
}

export function isHihyouji(entity: LegalEntity): boolean {
  return entity.hihyoji === "1";
}

export function isClosed(entity: LegalEntity): boolean {
  return entity.closeDate !== "";
}
