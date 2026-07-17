using MelsecParam.App.Models;

namespace MelsecParam.App.Services;

public static class CapacityCalculator
{
    public static CapacityCalculationResult Calculate(
        PlcModelDefinition model,
        DeviceRuleSetDefinition ruleSet,
        MemoryOptionDefinition memoryOption,
        IReadOnlyDictionary<string, long> points,
        IReadOnlyDictionary<string, double>? areaCapacityKWords = null)
    {
        if (!model.AllowedMemoryOptionIds.Contains(memoryOption.Id, StringComparer.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                $"{memoryOption.Id} は {model.DisplayName} で選択できるオプションではありません。",
                nameof(memoryOption));
        }

        var errors = new List<string>();
        var usedWords = model.Areas.ToDictionary(x => x.Id, x => (double)x.OverheadWords, StringComparer.OrdinalIgnoreCase);

        foreach (var baseDevice in ruleSet.Devices)
        {
            model.DeviceOverrides.TryGetValue(baseDevice.Symbol, out var item);
            if (item?.Hidden == true)
            {
                continue;
            }

            var device = Merge(baseDevice, item);
            var value = points.TryGetValue(device.Symbol, out var supplied) ? supplied : device.DefaultPoints;
            if (value < 0)
            {
                errors.Add($"{device.Symbol}: 0以上を入力してください。");
                value = 0;
            }
            if (value > device.MaxPoints)
            {
                errors.Add($"{device.Symbol}: 最大{device.MaxPoints:N0}点を超えています。");
            }
            if (value % device.SettingUnit != 0)
            {
                errors.Add($"{device.Symbol}: {device.SettingUnit:N0}点単位で入力してください。");
            }

            usedWords[device.AreaId] += value * (device.WordCostPerPoint + device.BitCostPerPoint / 16d);
        }

        var results = new Dictionary<string, AreaCalculationResult>(StringComparer.OrdinalIgnoreCase);
        foreach (var area in model.Areas)
        {
            var maxKWords = area.MaxKWords;
            if (area.ExpandWithMemory)
            {
                maxKWords += memoryOption.SharedMemoryAddedKWords;
            }
            if (area.CapacityFromMemoryOption)
            {
                maxKWords = memoryOption.FileCapacityOverrideKPoints
                    ?? (maxKWords + memoryOption.FileCapacityAddedKPoints);
            }
            if (area.AbsoluteMaxKWords is not null)
            {
                maxKWords = Math.Min(maxKWords, area.AbsoluteMaxKWords.Value);
            }

            var selectedKWords = areaCapacityKWords?.TryGetValue(area.Id, out var selected) == true
                ? selected
                : area.DefaultKWords;
            selectedKWords = Math.Clamp(selectedKWords, area.MinKWords, maxKWords);
            var capacityWords = selectedKWords * 1024d;
            var percent = capacityWords <= 0
                ? (usedWords[area.Id] <= 0 ? 0 : double.PositiveInfinity)
                : usedWords[area.Id] / capacityWords * 100d;
            var status = percent > 100d ? "over" : percent >= 90d ? "warning" : "ok";

            results[area.Id] = new AreaCalculationResult
            {
                UsedWords = usedWords[area.Id],
                CapacityWords = capacityWords,
                Percent = percent,
                Status = status
            };
        }

        return new CapacityCalculationResult { Areas = results, Errors = errors };
    }

    private static DeviceDefinition Merge(DeviceDefinition source, DeviceOverrideDefinition? item) => new()
    {
        Symbol = source.Symbol,
        Name = item?.Name ?? source.Name,
        AreaId = item?.AreaId ?? source.AreaId,
        Kind = source.Kind,
        Radix = source.Radix,
        DefaultPoints = item?.DefaultPoints ?? source.DefaultPoints,
        SettingUnit = item?.SettingUnit ?? source.SettingUnit,
        MaxPoints = item?.MaxPoints ?? source.MaxPoints,
        Fixed = item?.Fixed ?? source.Fixed,
        BitCostPerPoint = source.BitCostPerPoint,
        WordCostPerPoint = source.WordCostPerPoint
    };
}
