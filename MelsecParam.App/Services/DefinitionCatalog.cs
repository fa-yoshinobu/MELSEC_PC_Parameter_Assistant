using System.Text.Json;
using MelsecParam.App.Models;

namespace MelsecParam.App.Services;

public sealed class DefinitionCatalog
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip
    };

    private DefinitionCatalog(DefinitionCatalogData data)
    {
        Data = data;
    }

    public DefinitionCatalogData Data { get; }

    public static DefinitionCatalog Load(string contentRootPath)
    {
        var definitionRoot = Path.Combine(contentRootPath, "Definitions");
        var ruleSets = LoadDirectory<DeviceRuleSetDefinition>(Path.Combine(definitionRoot, "RuleSets"));
        var models = LoadDirectory<PlcModelDefinition>(Path.Combine(definitionRoot, "Models"));
        var systemDeviceProfiles = LoadDirectory<SystemDeviceProfileDefinition>(Path.Combine(definitionRoot, "SystemDeviceProfiles"));
        var options = LoadFile<OptionFileDefinition>(Path.Combine(definitionRoot, "memory-options.json"));

        Validate(models, ruleSets, systemDeviceProfiles, options);

        return new DefinitionCatalog(new DefinitionCatalogData
        {
            Models = models.OrderBy(x => x.Series).ThenBy(x => x.DisplayName).ToArray(),
            RuleSets = ruleSets.OrderBy(x => x.Id).ToArray(),
            MemoryOptions = options.MemoryOptions,
            StorageOptions = options.StorageOptions,
            SystemDeviceProfiles = systemDeviceProfiles.OrderBy(x => x.Id).ToArray()
        });
    }

    private static IReadOnlyList<T> LoadDirectory<T>(string path)
    {
        if (!Directory.Exists(path))
        {
            throw new InvalidOperationException($"定義フォルダーがありません: {path}");
        }

        return Directory.GetFiles(path, "*.json")
            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
            .Select(LoadFile<T>)
            .ToArray();
    }

    private static T LoadFile<T>(string path)
    {
        try
        {
            var value = JsonSerializer.Deserialize<T>(File.ReadAllText(path), JsonOptions);
            return value ?? throw new InvalidOperationException("JSONの内容が空です。");
        }
        catch (Exception ex) when (ex is JsonException or IOException or InvalidOperationException)
        {
            throw new InvalidOperationException($"定義ファイルを読み込めません: {path}", ex);
        }
    }

    private static void Validate(
        IReadOnlyList<PlcModelDefinition> models,
        IReadOnlyList<DeviceRuleSetDefinition> ruleSets,
        IReadOnlyList<SystemDeviceProfileDefinition> systemDeviceProfiles,
        OptionFileDefinition options)
    {
        EnsureUnique(models.Select(x => x.Id), "PLC型式定義");
        EnsureUnique(ruleSets.Select(x => x.Id), "ルールセット");
        EnsureUnique(systemDeviceProfiles.Select(x => x.Id), "システムデバイスプロファイル");
        EnsureUnique(options.MemoryOptions.Select(x => x.Id), "メモリーオプション");
        EnsureUnique(options.StorageOptions.Select(x => x.Id), "ストレージオプション");

        var ruleSetMap = ruleSets.ToDictionary(x => x.Id, StringComparer.OrdinalIgnoreCase);
        var memoryIds = options.MemoryOptions.Select(x => x.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var storageIds = options.StorageOptions.Select(x => x.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var systemDeviceProfileIds = systemDeviceProfiles.Select(x => x.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var ruleSet in ruleSets)
        {
            EnsureUnique(ruleSet.Devices.Select(x => x.Symbol), $"{ruleSet.Id}のデバイス");
            if (ruleSet.Devices.Any(x => x.SettingUnit <= 0 || x.MaxPoints < 0))
            {
                throw new InvalidOperationException($"{ruleSet.Id}: 設定単位または最大点数が不正です。");
            }
        }

        foreach (var model in models)
        {
            if (!ruleSetMap.TryGetValue(model.RuleSetId, out var ruleSet))
            {
                throw new InvalidOperationException($"{model.Id}: ルールセット {model.RuleSetId} がありません。");
            }

            EnsureUnique(model.Areas.Select(x => x.Id), $"{model.Id}の容量エリア");
            var areaIds = model.Areas.Select(x => x.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (model.Areas.Count == 0 || model.Areas.Any(x => x.MinKWords < 0 || x.MaxKWords < x.MinKWords))
            {
                throw new InvalidOperationException($"{model.Id}: 容量エリアの設定が不正です。");
            }

            foreach (var device in ruleSet.Devices)
            {
                var areaId = model.DeviceOverrides.TryGetValue(device.Symbol, out var item) && item.AreaId is not null
                    ? item.AreaId
                    : device.AreaId;
                var hidden = item?.Hidden == true;
                if (!hidden && !areaIds.Contains(areaId))
                {
                    throw new InvalidOperationException($"{model.Id}: デバイス {device.Symbol} のエリア {areaId} がありません。");
                }
            }

            foreach (var id in model.AllowedMemoryOptionIds)
            {
                if (!memoryIds.Contains(id))
                {
                    throw new InvalidOperationException($"{model.Id}: メモリーオプション {id} がありません。");
                }
            }

            if (!model.AllowedMemoryOptionIds.Contains("none", StringComparer.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"{model.Id}: 装着なし(none)を選択可能にしてください。");
            }

            foreach (var id in model.AllowedStorageOptionIds)
            {
                if (!storageIds.Contains(id))
                {
                    throw new InvalidOperationException($"{model.Id}: ストレージオプション {id} がありません。");
                }
            }


            if (model.AllowedStorageOptionIds.Any(id => !id.Equals("none", StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException($"{model.Id}: SDカードはバックアップ専用のため選択可能にできません。");
            }

            if (model.SystemDeviceProfileId is not null && !systemDeviceProfileIds.Contains(model.SystemDeviceProfileId))
            {
                throw new InvalidOperationException($"{model.Id}: システムデバイスプロファイル {model.SystemDeviceProfileId} がありません。");
            }
        }
    }

    private static void EnsureUnique(IEnumerable<string> values, string label)
    {
        var duplicate = values.GroupBy(x => x, StringComparer.OrdinalIgnoreCase).FirstOrDefault(x => x.Count() > 1);
        if (duplicate is not null)
        {
            throw new InvalidOperationException($"{label}に重複IDがあります: {duplicate.Key}");
        }
    }

    private sealed class OptionFileDefinition
    {
        public IReadOnlyList<MemoryOptionDefinition> MemoryOptions { get; init; } = [];
        public IReadOnlyList<StorageOptionDefinition> StorageOptions { get; init; } = [];
    }
}
