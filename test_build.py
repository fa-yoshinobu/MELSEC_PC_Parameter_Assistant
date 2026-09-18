"""Run with python -m unittest -v; no third-party packages required."""

from copy import deepcopy
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import build


class DefinitionAndCalculationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = build.load_catalog()
        cls.models = {item["id"]: item for item in cls.catalog["models"]}
        cls.rules = {item["id"]: item for item in cls.catalog["ruleSets"]}
        cls.memory = {item["id"]: item for item in cls.catalog["memoryOptions"]}

    def calculate(self, identifier, option="none", points=None, capacities=None):
        model = self.models[identifier]
        return build.calculate(model, self.rules[model["ruleSetId"]], self.memory[option], points, capacities)

    def test_catalog_loads_all_models_and_backup_excluded_storage(self):
        self.assertEqual(len(list((build.SOURCE_ROOT / "definitions/models").glob("*.json"))), len(self.models))
        for model in self.models.values():
            self.assertIn("none", model["allowedMemoryOptionIds"])
            self.assertEqual(["none"], model["allowedStorageOptionIds"])
        self.assertEqual("fx5u-uc", self.catalog["models"][0]["id"])

    def test_gxworks2_default_total(self):
        area = self.calculate("qnudv-q04")["areas"]["device"]
        self.assertEqual(40148, area["usedWords"])
        self.assertEqual(39.20703125, area["usedWords"] / 1024)
        self.assertEqual("warning", area["status"])

    def test_gxworks3_default_total_including_overhead(self):
        area = self.calculate("iqr-r04")["areas"]["device"]
        self.assertEqual(39296, area["usedWords"])
        self.assertEqual(38.375, area["usedWords"] / 1024)
        self.assertEqual("warning", area["status"])

    def test_setting_unit_error(self):
        errors = self.calculate("iqr-r04", points={"M": 12289})["errors"]
        self.assertTrue(any("M:" in error and "64点単位" in error for error in errors))

    def test_unsupported_option_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "選択できるオプションではありません"):
            self.calculate("process-r08", "iqr-sram-1mb")

    def test_successor_cards(self):
        self.assertEqual("Q2MEM-1MBS", self.memory["q-sram-card-1mb"]["supersedesProductName"])
        self.assertEqual("Q2MEM-2MBS", self.memory["q-sram-card-2mb"]["supersedesProductName"])

    def test_all_model_defaults_within_capacity(self):
        for identifier in self.models:
            with self.subTest(model=identifier):
                result = self.calculate(identifier)
                self.assertEqual([], result["errors"])
                self.assertTrue(all(area["status"] != "over" for area in result["areas"].values()))

    def test_qnudv_8mb_cassette(self):
        result = self.calculate("qnudv-q26", "q-sram-cassette-8mb", {"ZR": 4736 * 1024}, {"file": 4736})
        self.assertEqual(4736 * 1024, result["areas"]["file"]["capacityWords"])
        self.assertEqual(100, result["areas"]["file"]["percent"])
        self.assertEqual([], result["errors"])

    def test_all_model_specifications(self):
        profiles = {item["id"] for item in self.catalog["systemDeviceProfiles"]}
        for model in self.models.values():
            with self.subTest(model=model["id"]):
                self.assertTrue(model["programCapacityKSteps"] is not None or model["programCapacityText"])
                self.assertTrue(model["memoryDrives"])
                self.assertTrue(model["auxiliaryDevices"] or model["systemDeviceProfileId"] in profiles)

    def test_mx_manual_values(self):
        r300, r500 = self.models["mx-r300"], self.models["mx-r500"]
        self.assertEqual(65536, r300["sharedMemoryBaseKWords"])
        self.assertEqual(131072, r500["sharedMemoryBaseKWords"])
        self.assertEqual(102400, next(d["capacityKBytes"] for d in r300["memoryDrives"] if d["drive"] == "0"))
        self.assertEqual(262144, next(d["capacityKBytes"] for d in r500["memoryDrives"] if d["drive"] == "3"))
        profile = next(p for p in self.catalog["systemDeviceProfiles"] if p["id"] == "mx-f")
        devices = {d["symbol"]: d for d in profile["devices"]}
        self.assertEqual(10000, devices["SM"]["points"])
        self.assertEqual(256, devices["I"]["points"])

    def test_iql_manual_values(self):
        for identifier, steps, capacity in (("iql-l04", 40, 2048), ("iql-l08", 80, 5120), ("iql-l16", 160, 10240)):
            model = self.models[identifier]
            self.assertEqual(steps, model["programCapacityKSteps"])
            self.assertEqual(capacity, next(d["capacityKBytes"] for d in model["memoryDrives"] if d["drive"] == "4"))

    def test_fx5_default_points(self):
        devices = {d["symbol"]: d for d in self.rules["fx5"]["devices"]}
        for symbol, value in (("M", 7680), ("T", 512), ("D", 8000), ("R", 32768)):
            self.assertEqual(value, devices[symbol]["defaultPoints"])

    def test_fx5_label_areas_and_memory_blocks(self):
        for identifier, total, selectable in (("fx5u-uc", 63, True), ("fx5uj", 48, False)):
            model = self.models[identifier]
            block = next(b for b in model["memoryBlocks"] if b["id"] == "standard")
            areas = {a["id"]: a for a in model["areas"]}
            self.assertEqual(total, block["totalKWords"])
            self.assertEqual(48, sum(areas[key]["defaultKWords"] for key in block["areaIds"]))
            self.assertEqual(selectable, model["labelPlacementSelectable"])
        areas = {a["id"]: a for a in self.models["fx5u-uc"]["areas"]}
        self.assertEqual(12, areas["label"]["defaultKWords"])
        self.assertEqual(1, areas["latchLabel"]["defaultKWords"])
        self.assertTrue(all(not a["configurable"] for a in self.models["fx5uj"]["areas"]))

    def test_invalid_definitions_are_rejected(self):
        # Every validation category from the old loader remains enforced.
        mutations = [
            lambda c: c["models"].append(deepcopy(c["models"][0])),
            lambda c: c["ruleSets"][0]["devices"].append(deepcopy(c["ruleSets"][0]["devices"][0])),
            lambda c: c["ruleSets"][0]["devices"][0].update(settingUnit=0),
            lambda c: c["ruleSets"][0]["devices"][0].update(maxPoints=-1),
            lambda c: c["models"][0].update(ruleSetId="missing"),
            lambda c: c["models"][0]["areas"].append(deepcopy(c["models"][0]["areas"][0])),
            lambda c: c["models"][0].update(areas=[]),
            lambda c: c["models"][0]["areas"][0].update(minKWords=-1),
            lambda c: c["models"][0]["areas"][0].update(maxKWords=-1),
            lambda c: c["models"][0]["deviceOverrides"].update(X={"areaId": "missing"}),
            lambda c: c["models"][0].update(allowedMemoryOptionIds=["missing"]),
            lambda c: c["models"][0].update(allowedMemoryOptionIds=[]),
            lambda c: c["models"][0].update(allowedStorageOptionIds=["missing"]),
            lambda c: (c["storageOptions"].append({"id": "sd"}), c["models"][0].update(allowedStorageOptionIds=["sd"])),
            lambda c: c["models"][0]["memoryBlocks"].append(deepcopy(c["models"][0]["memoryBlocks"][0])),
            lambda c: c["models"][0]["memoryBlocks"][0].update(totalKWords=0),
            lambda c: c["models"][0]["memoryBlocks"][0].update(areaIds=["missing"]),
            lambda c: c["models"][0]["memoryBlocks"][1]["areaIds"].append("high"),
            lambda c: c["models"][0]["memoryBlocks"][0].update(totalKWords=1),
            lambda c: c["models"][0].update(systemDeviceProfileId="missing"),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(case=index):
                catalog = deepcopy(self.catalog)
                mutate(catalog)
                with self.assertRaises(ValueError):
                    build.validate(catalog)

    def test_json_comments_defaults_case_and_invalid_types(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rule.json"
            path.write_text('{/* comment */ "ID":"demo", // comment\n "DisplayName":"https://example.test/*literal*/"}', encoding="utf-8")
            rule = build.read_definition(path, "rule")
            self.assertEqual("demo", rule["id"])
            self.assertEqual("https://example.test/*literal*/", rule["displayName"])
            self.assertEqual([], rule["devices"])
            for text in ('{}', 'null', '{"id":"x", "displayName":"x", "devices":null}',
                         '{"id":"x", "displayName":12}', '{"id":"x", "displayName":"x",}'):
                path.write_text(text, encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "rule.json"):
                    build.read_definition(path, "rule")

    def test_generation_and_failure_preserves_previous_output(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory) / "app"
            shutil.copytree(build.SOURCE_ROOT, app)
            output = Path(directory) / "nested" / "index.html"
            build.generate(output, app)
            html = output.read_text(encoding="utf-8")
            embedded = re.search(r'<script id="catalog-data" type="application/json">(.*?)</script>', html, re.S)[1]
            self.assertEqual(self.catalog, json.loads(embedded))
            self.assertIn((app / "site/site.js").read_text(encoding="utf-8"), html)
            self.assertIn((app / "site/site.css").read_text(encoding="utf-8"), html)
            self.assertNotRegex(html, r"__(?:CATALOG_JSON|SITE_CSS|SITE_JS|FAVICON_BASE64|GENERATED_NOTE)__")
            source = app / "definitions/models/fx5u-uc.json"
            definition = json.loads(source.read_text(encoding="utf-8"))
            definition["notes"].append('</script><script>alert(1)</script> __SITE_JS__')
            source.write_text(json.dumps(definition), encoding="utf-8")
            build.generate(output, app)
            safe = output.read_bytes()
            self.assertNotIn(b"</script><script>alert(1)", safe)
            self.assertIn(b"__SITE_JS__", safe)  # Do not substitute tokens inside definition data.
            source.write_text("broken JSON", encoding="utf-8")
            with self.assertRaises(ValueError):
                build.generate(output, app)
            self.assertEqual(safe, output.read_bytes())
            source.write_text(json.dumps(definition), encoding="utf-8")
            template = app / "site/index.template.html"
            template.write_text("missing tokens", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "トークン"):
                build.generate(output, app)
            self.assertEqual(safe, output.read_bytes())

    def test_cli_from_another_working_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, str(build.ROOT / "build.py"), "out/index.html"],
                                    cwd=directory, capture_output=True)
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue((Path(directory) / "out/index.html").is_file())


if __name__ == "__main__":
    unittest.main()
