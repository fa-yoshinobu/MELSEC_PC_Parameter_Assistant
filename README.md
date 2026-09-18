# MELSEC PC Parameter Assistant

MELSECのPLC型式ごとにデバイス点数とメモリ容量を確認し、設定結果をExcelへコピーできるブラウザーツールです。

[アプリを開く](https://fa-yoshinobu.github.io/MELSEC_PC_Parameter_Assistant/)

## 使い方

1. PLCシリーズ・型式・メモリオプションを選ぶ。
2. 初期値が入った表のデバイス点数を編集する。`8K` は8,192点として入力できる。
3. 容量判定と使用範囲を確認する。
4. 「設定結果をExcel用にコピー」を押し、Excelへ貼り付ける。

入力中の自動補正は行いません。必要に応じて「設定単位に切り上げ補正」を使います。「ファイルレジスタへ全領域割当」は、同じエリアの変更可能な他デバイスを0点にして割り当て直します。

既存設定は「既存設定をまとめて入力する場合」から、点数1列または「記号＋点数」の2列で貼り付けられます。

ローカルでは [docs/index.html](docs/index.html) をブラウザーで開くだけで使えます。PythonやWebサーバーは不要です。

## 特記事項

- 実機への書込み機能はありません。最終設定はGX Worksでパラメータチェックしてください。
- SDカードは容量計算の対象外です。SRAMカードの管理領域や他ファイルの占有分は自動控除しません。
- ラベルの実使用量、FX5のラッチ範囲・保持容量は判定しません。

詳しい計算方法・判定範囲・未解決事項は [デバイス容量の計算と判定](reference/MELSEC-device-rules.md) にまとめています。

## 編集するファイル

| 場所 | 内容 |
|---|---|
| [src/definitions/models/](src/definitions/models/) | 型式別の容量・初期値・対応オプション |
| [src/definitions/rule_sets/](src/definitions/rule_sets/) | デバイスの共通計算ルール |
| [src/definitions/system_device_profiles/](src/definitions/system_device_profiles/) | 共通システムデバイス仕様 |
| [src/definitions/memory-options.json](src/definitions/memory-options.json) | メモリ・保持オプション |
| [src/site/](src/site/) | HTMLテンプレート・CSS・JavaScript・アイコン |
| [docs/](docs/) | 生成された公開用HTML |
| [reference/](reference/) | 計算の説明と確認用資料 |

機種別の値はJSON定義で管理します。`reference/` の容量表・オプション対応表は自動更新されません。

## 生成と起動

編集後の生成・検証には **Python 3.9以降**を使います。追加パッケージは不要です。リポジトリ直下で実行してください。

```sh
python build.py
python -m unittest -v
```

`docs/index.html` に画面素材と定義データを埋め込みます。生成に失敗した場合は既存のHTMLを保持します。出力先を指定する場合は `python build.py docs/preview.html` のように引数を渡します。

Windowsでは [MELSEC_PC_Param.bat](MELSEC_PC_Param.bat) で生成してからブラウザーで開けます。Pythonがなければ既存HTMLを開きます。コマンドの `python` が使えない場合は `py -3` に読み替えてください。

## GitHub Pagesへの反映

公開元は `main` ブランチの `/docs` です。設定場所は Settings → Pages → Deploy from a branch です。

変更した編集元と、再生成した `docs/index.html` をコミットして `main` へpushすると公開内容が更新されます。
