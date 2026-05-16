/**
 * 法人名称
 */
const CORPORATE_TYPE_NAMES: string[][] = [
  ["株式会社", "(株)"],
  ["有限会社", "(有)"],
  ["合名会社", "(名)"],
  ["合資会社", "(資)"],
  ["合同会社", "(合)"],
  ["医療法人", "(医)"],
  ["医療法人社団", "(医)"],
  ["医療法人財団", "(医)"],
  ["社会医療法人", "(医)"],
  ["財団法人", "(財)"],
  ["一般財団法人", "(一財)"],
  ["公益財団法人", "(公財)"],
  ["社団法人", "(社)"],
  ["一般社団法人", "(一社)"],
  ["公益社団法人", "(公社)"],
  ["宗教法人", "(宗)"],
  ["学校法人", "(学)"],
  ["社会福祉法人", "(福)"],
  ["更生保護法人"],
  ["相互会社", "(相)"],
  ["特定非営利活動法人", "(特非)"],
  ["独立行政法人", "(独)"],
  ["地方独立行政法人", "(地独)"],
  ["弁護士法人", "(弁)"],
  ["有限責任中間法人", "(中)"],
  ["無限責任中間法人", "(中)"],
  ["行政書士法人", "(行)"],
  ["司法書士法人", "(司)"],
  ["税理士法人", "(税)"],
  ["国立大学法人", "(大)"],
  ["公立大学法人", "(大)"],
  ["農事組合法人"],
  ["管理組合法人"],
  ["社会保険労務士法人"],
] as const;

/**
 * 事業名称
 */
const BUSINESS_TYPE_NAMES: string[][] = [
  ["連合会", "(連)"],
  ["共済組合", "(共済)"],
  ["協同組合", "(協組)"],
  ["生命保険", "(生命)"],
  ["海上火災保険", "(海上)"],
  ["火災海上保険", "(火災)"],
  ["健康保険組合", "(健保)"],
  ["国民健康保険組合", "(国保)"],
  ["国民健康保険団体連合会", "(国保連)"],
  ["社会保険診療報酬支払基金", "(社保)"],
  ["厚生年金基金", "(厚年)"],
  ["従業員組合", "(従組)"],
  ["労働組合", "(労組)"],
  ["生活協同組合", "(生協)"],
  ["食糧販売協同組合", "(食販協)"],
  ["国家公務員共済組合連合会", "(国共連)"],
  ["農業協同組合連合会", "(農共連)"],
  ["経済農業協同組合連合会", "(経済連)"],
  ["共済農業協同組合連合会", "(共済連)"],
  ["漁業協同組合", "(漁協)"],
  ["漁業協同組合連合会", "(漁連)"],
  ["公共職業安定所", "(職安)"],
  ["社会福祉協議会", "(社協)"],
  ["特別養護老人ホーム", "(特養)"],
  ["有限責任事業組合", "(責)"],
] as const;

function makeRegexFriendly(): string[] {
  const flattend = [...CORPORATE_TYPE_NAMES, ...BUSINESS_TYPE_NAMES].flat();
  const sortedEscapedNames = Array.from(new Set(flattend))
    .map((name) => RegExp.escape(name))
    .sort((a, b) => b.length - a.length);
  return sortedEscapedNames;
}

const regexFriendlyNames = makeRegexFriendly().join("|");
export const PREFIX_NAME_REGEX = new RegExp(
  `^(?<prefix>${regexFriendlyNames})`,
);
export const SUFFIX_NAME_REGEX = new RegExp(
  `(?<suffix>${regexFriendlyNames})$`,
);

export type CorporateName = {
  name: string; // 法人名から「株式会社」などの法人種別を除いたもの
  prefix: string; // 法人名の先頭部分（例："(株)"）
  suffix: string; // 法人名の末尾部分（例："(株)"）
  fullName: string; // 完全な法人名
};

/**
 * 法人名の前後についた法人種別部分と、正味の法人名部分を分離する。
 * "㈱"などの省略文字は、あらかじめNKFCで正規化して"(株)"のように変換しておく必要がある。
 */
export function parseCorporateName(name: string): CorporateName {
  const prefixMatch = name.match(PREFIX_NAME_REGEX);
  if (prefixMatch) {
    const prefix = prefixMatch.groups?.prefix ?? "";
    return {
      name: name.slice(prefix.length).trim(),
      prefix: prefix,
      suffix: "",
      fullName: name,
    };
  }

  const suffixMatch = name.match(SUFFIX_NAME_REGEX);
  if (suffixMatch) {
    const suffix = suffixMatch.groups?.suffix ?? "";
    return {
      name: name.slice(0, -suffix.length).trim(),
      prefix: "",
      suffix: suffix,
      fullName: name,
    };
  }

  return {
    name: name,
    prefix: "",
    suffix: "",
    fullName: name,
  };
}
