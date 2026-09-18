# 全機種のファイルレジスタ容量

各機種JSON (src/definitions/models/*.json) と memory-options.json から生成。単位はKワード（ファイルレジスタは1点=1ワード）。
実際に割り当てられる点数は、デバイス上限（ZR/Rの最大点数）や同一領域の他デバイスとの共用により、領域容量より小さくなる場合があります。

| PLCシリーズ | PLC型式 | ファイルレジスタ領域 | 装着なし | オプション装着時の最大 |
|---|---|---|---:|---|
| MELSEC MX | MX-Fモデル | ファイル格納エリア | 4,064K | - |
| MELSEC MX | MXR300シリーズ | ファイル格納エリア | 8,160K | - |
| MELSEC MX | MXR500シリーズ | ファイル格納エリア | 10,208K | - |
| MELSEC iQ-F | FX5U / FX5UC CPUユニット | デバイス (標準) エリア | 63K | - |
| MELSEC iQ-F | FX5UJ CPUユニット | デバイス (標準) エリア | 35K | - |
| MELSEC iQ-L | L04HCPU | ファイル格納エリア | 160K | - |
| MELSEC iQ-L | L08HCPU | ファイル格納エリア | 544K | - |
| MELSEC iQ-L | L16HCPU | ファイル格納エリア | 800K | - |
| MELSEC iQ-R | R00CPU / R01CPU / R02CPU | ファイル格納エリア | 96K | - |
| MELSEC iQ-R | R04CPU / R04ENCPU | ファイル格納エリア | 160K | 8,352K (NZ2MC-16MBS (拡張SRAM 16MB)) |
| MELSEC iQ-R | R08CPU / R08ENCPU | ファイル格納エリア | 544K | 8,736K (NZ2MC-16MBS (拡張SRAM 16MB)) |
| MELSEC iQ-R | R120CPU / R120ENCPU | ファイル格納エリア | 1,600K | 9,792K (NZ2MC-16MBS (拡張SRAM 16MB)) |
| MELSEC iQ-R | R16CPU / R16ENCPU | ファイル格納エリア | 800K | 8,992K (NZ2MC-16MBS (拡張SRAM 16MB)) |
| MELSEC iQ-R | R32CPU / R32ENCPU | ファイル格納エリア | 1,088K | 9,280K (NZ2MC-16MBS (拡張SRAM 16MB)) |
| MELSEC iQ-R プロセスCPU | R08PCPU | ファイル格納エリア | 544K | 4,640K (NZ2MC-8MBSE (拡張SRAM 8MB・ECC対応品)) |
| MELSEC iQ-R プロセスCPU | R120PCPU | ファイル格納エリア | 1,600K | 5,696K (NZ2MC-8MBSE (拡張SRAM 8MB・ECC対応品)) |
| MELSEC iQ-R プロセスCPU | R16PCPU | ファイル格納エリア | 800K | 4,896K (NZ2MC-8MBSE (拡張SRAM 8MB・ECC対応品)) |
| MELSEC iQ-R プロセスCPU | R32PCPU | ファイル格納エリア | 1,088K | 5,184K (NZ2MC-8MBSE (拡張SRAM 8MB・ECC対応品)) |
| MELSEC-L | L02SCPU / L02CPU 系 | 標準RAM (ファイル/ローカル共用) | 64K | - |
| MELSEC-L | L06CPU / L26CPU 系 | 標準RAM (ファイル/ローカル共用) | 384K | - |
| MELSEC-Q | Q00CPU / Q01CPU (ベーシックモデル) | ファイルレジスタ | 64K | - |
| MELSEC-Q | Q02CPU | ファイルレジスタ (標準RAM / SRAMカード) | 32K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q | Q02HCPU / Q06HCPU / Q02PHCPU / Q06PHCPU | ファイルレジスタ (標準RAM / SRAMカード) | 64K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q | Q12H / Q25H / Q12PH / Q25PH / Q12PRH / Q25PRHCPU | ファイルレジスタ (標準RAM / SRAMカード) | 128K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q ユニバーサルモデル | Q00UCPU / Q01UCPU | 標準RAM (ファイル等共用) | 64K | - |
| MELSEC-Q ユニバーサルモデル | Q02UCPU | 標準RAM / SRAMカード | 64K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q ユニバーサルモデル | Q03UDCPU / Q03UDECPU | 標準RAM / SRAMカード | 96K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q ユニバーサルモデル | Q04UDHCPU / Q04UDEHCPU | 標準RAM / SRAMカード | 128K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q ユニバーサルモデル | Q06UDHCPU / Q06UDEHCPU | 標準RAM / SRAMカード | 384K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q ユニバーサルモデル | Q100UDEHCPU | 標準RAM / SRAMカード | 896K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q ユニバーサルモデル | Q10UD(E)HCPU / Q13UD(E)HCPU | 標準RAM / SRAMカード | 512K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q ユニバーサルモデル | Q20UD(E)HCPU / Q26UD(E)HCPU | 標準RAM / SRAMカード | 640K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q ユニバーサルモデル | Q50UDEHCPU | 標準RAM / SRAMカード | 768K | 4,086K (Q3MEM-8MBS (SRAMカード 8MB)) |
| MELSEC-Q ユニバーサル高速タイプ | Q03UDVCPU | 標準RAM + 拡張SRAM | 96K | 4,192K (Q4MCA-8MBS (拡張SRAM 8MB)) |
| MELSEC-Q ユニバーサル高速タイプ | Q04UDVCPU / Q04UDPVCPU | 標準RAM + 拡張SRAM | 128K | 4,224K (Q4MCA-8MBS (拡張SRAM 8MB)) |
| MELSEC-Q ユニバーサル高速タイプ | Q06UDVCPU / Q06UDPVCPU | 標準RAM + 拡張SRAM | 384K | 4,480K (Q4MCA-8MBS (拡張SRAM 8MB)) |
| MELSEC-Q ユニバーサル高速タイプ | Q13UDVCPU / Q13UDPVCPU | 標準RAM + 拡張SRAM | 512K | 4,608K (Q4MCA-8MBS (拡張SRAM 8MB)) |
| MELSEC-Q ユニバーサル高速タイプ | Q26UDVCPU / Q26UDPVCPU | 標準RAM + 拡張SRAM | 640K | 4,736K (Q4MCA-8MBS (拡張SRAM 8MB)) |
