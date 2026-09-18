"""Validate MELSEC definitions and generate the standalone site (stdlib only)."""

import argparse
import base64
from copy import deepcopy
from datetime import date
import json
import math
from pathlib import Path
import re
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = ROOT / "src"

# Defaults formerly supplied by the C# models; keep the browser's data contract.
DEFAULTS = {
    "model": dict(modelNames=[], areas=[], sharedMemoryBaseKWords=None, sharedAreaIds=[],
                  memoryBlocks=[], labelPlacementSelectable=False, allowedMemoryOptionIds=["none"],
                  allowedStorageOptionIds=["none"], deviceOverrides={}, sources=[], notes=[],
                  programCapacityKSteps=None, programCapacityText=None, memoryDrives=[],
                  systemDeviceProfileId=None, auxiliaryDevices=[]),
    "area": dict(defaultKWords=0, minKWords=0, maxKWords=0, absoluteMaxKWords=None,
                 configurable=False, expandWithMemory=False, capacityFromMemoryOption=False,
                 overheadWords=0, unitLabel="Kワード"),
    "block": dict(totalKWords=0, areaIds=[]),
    "drive": dict(drive="", capacityKBytes=None, capacityText=None, expandWithMemory=False, note=None),
    "auxiliary": dict(points=None, pointsText=None, range=None),
    "profile": dict(devices=[]),
    "rule": dict(devices=[]),
    "device": dict(kind="word", radix=10, defaultPoints=0, settingUnit=1, maxPoints=2147483647,
                   fixed=False, bitCostPerPoint=0, wordCostPerPoint=0),
    "override": dict(name=None, areaId=None, defaultPoints=None, settingUnit=None,
                     maxPoints=None, fixed=None, hidden=None),
    "memory": dict(sizeMBytes=0, sharedMemoryAddedKWords=0, fileCapacityAddedKPoints=0,
                   fileCapacityOverrideKPoints=None, productName=None, supersedesProductName=None, note=None),
    "storage": dict(capacityGBytes=0, productName=None, note=None),
    "source": dict(pages=[]),
    "options": dict(memoryOptions=[], storageOptions=[]),
}
REQUIRED = {
    "model": "id displayName series engineeringTool ruleSetId",
    "area": "id displayName", "block": "id displayName", "drive": "displayName",
    "auxiliary": "symbol displayName", "profile": "id displayName", "rule": "id displayName",
    "device": "symbol name areaId", "memory": "id displayName kind",
    "storage": "id displayName", "source": "manual",
}
CHILDREN = {
    "model": dict(areas="area", memoryBlocks="block", memoryDrives="drive",
                  auxiliaryDevices="auxiliary", sources="source", deviceOverrides="override"),
    "profile": dict(devices="auxiliary"), "rule": dict(devices="device"),
    "options": dict(memoryOptions="memory", storageOptions="storage"),
}
NUMBERS = set("sharedMemoryBaseKWords programCapacityKSteps defaultKWords minKWords maxKWords "
              "absoluteMaxKWords totalKWords capacityKBytes sizeMBytes sharedMemoryAddedKWords "
              "fileCapacityAddedKPoints fileCapacityOverrideKPoints capacityGBytes "
              "bitCostPerPoint wordCostPerPoint".split())
INTEGERS = set("overheadWords points radix defaultPoints settingUnit maxPoints".split())
BOOLEANS = set("labelPlacementSelectable configurable expandWithMemory capacityFromMemoryOption fixed hidden".split())


def normalize(value, kind):
    if not isinstance(value, dict):
        raise ValueError(f"{kind}: JSONオブジェクトが必要です。")
    supplied = {key.casefold(): item for key, item in value.items()}
    result = deepcopy(DEFAULTS[kind])
    for key in REQUIRED.get(kind, "").split():
        if key.casefold() not in supplied:
            raise ValueError(f"{kind}: 必須項目 {key} がありません。")
        result[key] = ""
    for key, default in result.items():
        item = supplied.get(key.casefold(), default)
        if item is None and default is None:
            continue
        expected = (bool if key in BOOLEANS else int if key in INTEGERS else
                    (int, float) if key in NUMBERS else type(default) if default is not None else str)
        if not isinstance(item, expected) or (isinstance(item, bool) and key not in BOOLEANS):
            raise ValueError(f"{kind}.{key}: 値の型が不正です。")
        if key in NUMBERS and not math.isfinite(item):
            raise ValueError(f"{kind}.{key}: 有限の数値が必要です。")
        child = CHILDREN.get(kind, {}).get(key)
        if child:
            item = ({symbol: normalize(device, child) for symbol, device in item.items()}
                    if isinstance(item, dict) else [normalize(entry, child) for entry in item])
        elif isinstance(item, list) and not all(isinstance(entry, str) for entry in item):
            raise ValueError(f"{kind}.{key}: 文字列の配列が必要です。")
        result[key] = item
    return result


def read_definition(path, kind):
    try:
        # Preserve JSON string literals while accepting the old loader's // and /* */ comments.
        text = re.sub(r'"(?:\\.|[^"\\])*"|//[^\r\n]*|/\*[\s\S]*?\*/',
                      lambda match: match[0] if match[0].startswith('"') else " ",
                      path.read_text(encoding="utf-8-sig"))
        return normalize(json.loads(text), kind)
    except (OSError, ValueError, TypeError) as error:
        raise ValueError(f"定義ファイルを読み込めません: {path}: {error}") from error


def unique_map(items, label, key="id"):
    result = {}
    for item in items:
        identifier = item[key].casefold()
        if identifier in result:
            raise ValueError(f"{label}に重複IDがあります: {item[key]}")
        result[identifier] = item
    return result


def validate(catalog):
    maps = {key: unique_map(items, key) for key, items in catalog.items()}
    for rule in catalog["ruleSets"]:
        unique_map(rule["devices"], rule["id"], "symbol")
        if any(d["settingUnit"] <= 0 or d["maxPoints"] < 0 for d in rule["devices"]):
            raise ValueError(f"{rule['id']}: 設定単位または最大点数が不正です。")
    for model in catalog["models"]:
        label = model["id"]
        rule = maps["ruleSets"].get(model["ruleSetId"].casefold())
        if rule is None:
            raise ValueError(f"{label}: ルールセット {model['ruleSetId']} がありません。")
        areas = unique_map(model["areas"], label)
        if not areas or any(a["minKWords"] < 0 or a["maxKWords"] < a["minKWords"] for a in areas.values()):
            raise ValueError(f"{label}: 容量エリアの設定が不正です。")
        for device in rule["devices"]:
            override = model["deviceOverrides"].get(device["symbol"], {})
            area = override.get("areaId") or device["areaId"]
            if not override.get("hidden") and area.casefold() not in areas:
                raise ValueError(f"{label}: デバイス {device['symbol']} のエリア {area} がありません。")
        for field, collection in (("allowedMemoryOptionIds", "memoryOptions"),
                                  ("allowedStorageOptionIds", "storageOptions")):
            for identifier in model[field]:
                if identifier.casefold() not in maps[collection]:
                    raise ValueError(f"{label}: {collection} の {identifier} がありません。")
        if "none" not in [identifier.casefold() for identifier in model["allowedMemoryOptionIds"]]:
            raise ValueError(f"{label}: 装着なし(none)を選択可能にしてください。")
        if any(identifier.casefold() != "none" for identifier in model["allowedStorageOptionIds"]):
            raise ValueError(f"{label}: SDカードはバックアップ専用のため選択可能にできません。")
        unique_map(model["memoryBlocks"], label)
        assigned = set()
        for block in model["memoryBlocks"]:
            if block["totalKWords"] <= 0:
                raise ValueError(f"{label}: メモリブロック {block['id']} の合計容量が不正です。")
            total = 0
            for identifier in block["areaIds"]:
                key = identifier.casefold()
                if key not in areas:
                    raise ValueError(f"{label}: メモリブロックのエリア {identifier} がありません。")
                if key in assigned:
                    raise ValueError(f"{label}: エリア {identifier} が複数のメモリブロックに属しています。")
                assigned.add(key)
                total += areas[key]["defaultKWords"]
            if total > block["totalKWords"]:
                raise ValueError(f"{label}: メモリブロック {block['id']} の初期値合計が上限を超えています。")
        profile = model["systemDeviceProfileId"]
        if profile is not None and profile.casefold() not in maps["systemDeviceProfiles"]:
            raise ValueError(f"{label}: システムデバイスプロファイル {profile} がありません。")


def load_catalog(app=SOURCE_ROOT):
    root = Path(app) / "definitions"
    catalog = {}
    for key, folder, kind in (("models", "models", "model"), ("ruleSets", "rule_sets", "rule"),
                              ("systemDeviceProfiles", "system_device_profiles", "profile")):
        directory = root / folder
        if not directory.is_dir():
            raise ValueError(f"定義フォルダーがありません: {directory}")
        catalog[key] = [read_definition(path, kind) for path in sorted(directory.glob("*.json"))]
        catalog[key].sort(key=(lambda item: (item["series"].casefold(), item["displayName"].casefold()))
                          if key == "models" else lambda item: item["id"])
    catalog.update(read_definition(root / "memory-options.json", "options"))
    validate(catalog)
    return catalog


def calculate(model, rule, memory, points=None, capacities=None):
    """Reference calculation retained for the original capacity regression checks."""
    if memory["id"].casefold() not in [key.casefold() for key in model["allowedMemoryOptionIds"]]:
        raise ValueError(f"{memory['id']} は {model['displayName']} で選択できるオプションではありません。")
    points, capacities = points or {}, capacities or {}
    errors = []
    used = {area["id"].casefold(): area["overheadWords"] for area in model["areas"]}
    for base in rule["devices"]:
        override = model["deviceOverrides"].get(base["symbol"], {})
        if override.get("hidden"):
            continue
        device = {**base, **{key: value for key, value in override.items() if value is not None}}
        symbol = device["symbol"]
        value = points.get(symbol, device["defaultPoints"])
        if value < 0:
            errors.append(f"{symbol}: 0以上を入力してください。")
            value = 0
        if value > device["maxPoints"]:
            errors.append(f"{symbol}: 最大{device['maxPoints']:,}点を超えています。")
        if value % device["settingUnit"]:
            errors.append(f"{symbol}: {device['settingUnit']:,}点単位で入力してください。")
        used[device["areaId"].casefold()] += value * (device["wordCostPerPoint"] + device["bitCostPerPoint"] / 16)
    results = {}
    for area in model["areas"]:
        limit = area["maxKWords"]
        if area["expandWithMemory"]:
            limit += memory["sharedMemoryAddedKWords"]
        if area["capacityFromMemoryOption"]:
            limit = (memory["fileCapacityOverrideKPoints"] if memory["fileCapacityOverrideKPoints"] is not None
                     else limit + memory["fileCapacityAddedKPoints"])
        if area["absoluteMaxKWords"] is not None:
            limit = min(limit, area["absoluteMaxKWords"])
        if limit < area["minKWords"]:
            raise ValueError(f"{area['id']}: 容量上限が下限未満です。")
        capacity = min(max(capacities.get(area["id"], area["defaultKWords"]), area["minKWords"]), limit) * 1024
        words = used[area["id"].casefold()]
        percent = words / capacity * 100 if capacity > 0 else (0 if words <= 0 else math.inf)
        results[area["id"]] = dict(usedWords=words, capacityWords=capacity, percent=percent,
                                  status="over" if percent > 100 else "warning" if percent >= 90 else "ok")
    return dict(areas=results, errors=errors)


def generate(output=ROOT / "docs" / "index.html", app=SOURCE_ROOT):
    catalog = load_catalog(app)
    site = Path(app) / "site"
    # A literal '<' could close the script tag, even inside application/json.
    data = json.dumps(catalog, ensure_ascii=False, allow_nan=False, separators=(",", ":")).replace("<", "\\u003c")
    replacements = {
        "__CATALOG_JSON__": data,
        "__SITE_CSS__": (site / "site.css").read_text(encoding="utf-8-sig"),
        "__SITE_JS__": (site / "site.js").read_text(encoding="utf-8-sig"),
        "__FAVICON_BASE64__": base64.b64encode((site / "favicon.ico").read_bytes()).decode("ascii"),
        "__GENERATED_NOTE__": f"JSON定義 {date.today():%Y-%m-%d} 生成",
    }
    template = (site / "index.template.html").read_text(encoding="utf-8-sig")
    for token in replacements:
        if token not in template:
            raise ValueError(f"テンプレートにトークンがありません: {token}")
    html = re.sub("|".join(replacements), lambda match: replacements[match[0]], template)
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    # Leave the previous usable site intact if validation or writing fails.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(html.encode("utf-8"))
        temporary.replace(output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return catalog


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", type=Path, default=ROOT / "docs" / "index.html")
    args = parser.parse_args()
    try:
        catalog = generate(args.output)
    except (OSError, ValueError) as error:
        print(f"生成に失敗しました: {error}", file=sys.stderr)
        return 1
    print(f"定義検証OK: {len(catalog['models'])} 型式 / {len(catalog['ruleSets'])} 計算ルール")
    print(f"生成しました: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
