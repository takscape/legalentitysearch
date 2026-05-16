# legalentitysearch
法人基本3情報を検索するツール



## これは何？

国税庁が[法人基本3情報ダウロード](https://www.houjin-bangou.nta.go.jp/download/index.html)で公開するCSVファイル(Unicode版)を検索インデックス化し、それを用いて、法人名や所在地で検索できるツールです。ある程度の曖昧性を許して検索します。

## 使い方

### インデックス作成

```
deno -A main.ts build [-d INDEX_FILE_PATH] [-f] [CSV_FILE_PATH_1] ([CSV_FILE_PATH_2]...)
  -d INDEX_FILE_PATH : 作成するインデックスファイルのパスを指定。省略すると、"./index.db"が用いられる。
  -f : すでにインデックスファイルが存在する場合、削除して作り直す。省略すると、既存インデックスに追加する。
  CSV_FILE_PATH_1... : 国税庁の基本3情報ダウンロードページからダウンロードできる、Unicode形式のCSVファイル。複数指定した場合、それらをすべてインデックス化する。
```

### 検索

```
deno -A main.ts search [-d INDEX_FILE_PATH] [-f FULL_NAME] [-a ADDRESS] [-p ZIP_CODE] [-l LIMIT] [-o OUTPUT_FORMAT] [NAME]
  -d INDEX_FILE_PATH : インデックスファイルのパスを指定。省略すると、"./index.db"が用いられる。
  -f FULL_NAME : 「株式会社」などの法人種別を含む、完全な法人名に対するクエリ文字列。
  -a ADDRESS : 所在地に対するクエリ文字列。
  -p ZIP_CODE : ”1008978”などの数字7桁（ハイフンなどを含まない）形式の郵便番号（完全一致検索）。
  -l LIMIT : 検索結果件数の上限（省略すると20件）。
  -o OUTPUT_FORMAT : 検索結果の出力形式。"json"もしくは"toml"。省略するとtoml。
  NAME : 法人名から「株式会社」などの法人種別を除いたものに対するクエリ文字列。
```

検索例

```
deno -A main.ts search 総務省

[[entity]]
sequenceNumber = "150083"
corporateNumber = "2000012020001"
process = "01"
correct = "1"
updateDate = "2018-04-02"
changeDate = "2015-10-05"
name = "総務省"
nameImageId = ""
kind = "101"
prefectureName = "東京都"
cityName = "千代田区"
streetNumber = "霞が関２丁目１－２中央合同庁舎第２号館"
addressImageId = ""
prefectureCode = "13"
cityCode = "101"
postCode = "1000013"
addressOutside = ""
addressOutsideImageId = ""
closeDate = ""
closeCause = ""
successorCorporateNumber = ""
changeCause = ""
assignmentDate = "2015-10-05"
latest = "1"
enName = "Ministry of Internal Affairs and Communications"
enPrefectureName = "Tokyo"
enCityName = "2-1-2, Kasumigaseki, Chiyoda ku"
enAddressOutside = ""
furigana = "ソウムショウ"
hihyoji = "0"
rank = 2.220446049250313e-16

...(以下省略)
```



## 動作の仕組み

* denoに組み込まれたSQLiteのFTS5拡張を用いて全文検索インデックスを作成します。
  * トークナイズ方式
    * 連続する数字は、それらを一つのトークンとする。
    * 連続するラテンアルファベットは、それらを一つのトークンとする。
    * それ以外の文字（日本語など）は、すべて1文字を一つのトークンとする。
  * 文字列正規化方式
    * UnicodeのNKFCを用いて文字列を正規化する
    * ひらがなはすべてカタカナに変換する
    * 中黒文字「・」は削除する
    * アルファベット等の大文字はすべて小文字に変換する

* 検索時は、クエリ文字列に対してインデックス作成時と同様の正規化を施した上で、すべての検索条件のOR条件で検索します。
  * つまり、日本語に関しては、文字unigramによる検索を行います。
  * ランキングは、FTS5の標準スコアリングアルゴリズムによります。
  * FTS5を用いた検索結果に対して、後処理として[Fuse.js](https://www.fusejs.io/)を用いたランキング補正を行います。

