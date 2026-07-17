namespace MelsecParam.App.Models;

public sealed class DefinitionCatalogData
{
    public required IReadOnlyList<PlcModelDefinition> Models { get; init; }
    public required IReadOnlyList<DeviceRuleSetDefinition> RuleSets { get; init; }
    public required IReadOnlyList<MemoryOptionDefinition> MemoryOptions { get; init; }
    public required IReadOnlyList<StorageOptionDefinition> StorageOptions { get; init; }
    public required IReadOnlyList<SystemDeviceProfileDefinition> SystemDeviceProfiles { get; init; }
}

public sealed class PlcModelDefinition
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string Series { get; init; }
    public required string EngineeringTool { get; init; }
    public required string RuleSetId { get; init; }
    public IReadOnlyList<string> ModelNames { get; init; } = [];
    public IReadOnlyList<CapacityAreaDefinition> Areas { get; init; } = [];
    public double? SharedMemoryBaseKWords { get; init; }
    public IReadOnlyList<string> SharedAreaIds { get; init; } = [];
    public IReadOnlyList<string> AllowedMemoryOptionIds { get; init; } = ["none"];
    public IReadOnlyList<string> AllowedStorageOptionIds { get; init; } = ["none"];
    public IReadOnlyDictionary<string, DeviceOverrideDefinition> DeviceOverrides { get; init; }
        = new Dictionary<string, DeviceOverrideDefinition>();
    public IReadOnlyList<ManualReferenceDefinition> Sources { get; init; } = [];
    public IReadOnlyList<string> Notes { get; init; } = [];
    public double? ProgramCapacityKSteps { get; init; }
    public string? ProgramCapacityText { get; init; }
    public IReadOnlyList<MemoryDriveDefinition> MemoryDrives { get; init; } = [];
    public string? SystemDeviceProfileId { get; init; }
    public IReadOnlyList<AuxiliaryDeviceDefinition> AuxiliaryDevices { get; init; } = [];
}

public sealed class MemoryDriveDefinition
{
    public string Drive { get; init; } = "";
    public required string DisplayName { get; init; }
    public double? CapacityKBytes { get; init; }
    public string? CapacityText { get; init; }
    public bool ExpandWithMemory { get; init; }
    public string? Note { get; init; }
}

public sealed class AuxiliaryDeviceDefinition
{
    public required string Symbol { get; init; }
    public required string DisplayName { get; init; }
    public long? Points { get; init; }
    public string? PointsText { get; init; }
    public string? Range { get; init; }
}

public sealed class SystemDeviceProfileDefinition
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public IReadOnlyList<AuxiliaryDeviceDefinition> Devices { get; init; } = [];
}

public sealed class CapacityAreaDefinition
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public double DefaultKWords { get; init; }
    public double MinKWords { get; init; }
    public double MaxKWords { get; init; }
    public double? AbsoluteMaxKWords { get; init; }
    public bool Configurable { get; init; }
    public bool ExpandWithMemory { get; init; }
    public bool CapacityFromMemoryOption { get; init; }
    public int OverheadWords { get; init; }
    public string UnitLabel { get; init; } = "Kワード";
}

public sealed class DeviceRuleSetDefinition
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public IReadOnlyList<DeviceDefinition> Devices { get; init; } = [];
}

public sealed class DeviceDefinition
{
    public required string Symbol { get; init; }
    public required string Name { get; init; }
    public required string AreaId { get; init; }
    public string Kind { get; init; } = "word";
    public int Radix { get; init; } = 10;
    public int DefaultPoints { get; init; }
    public int SettingUnit { get; init; } = 1;
    public long MaxPoints { get; init; } = int.MaxValue;
    public bool Fixed { get; init; }
    public double BitCostPerPoint { get; init; }
    public double WordCostPerPoint { get; init; }
}

public sealed class DeviceOverrideDefinition
{
    public string? Name { get; init; }
    public string? AreaId { get; init; }
    public int? DefaultPoints { get; init; }
    public int? SettingUnit { get; init; }
    public long? MaxPoints { get; init; }
    public bool? Fixed { get; init; }
    public bool? Hidden { get; init; }
}

public sealed class MemoryOptionDefinition
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string Kind { get; init; }
    public double SizeMBytes { get; init; }
    public double SharedMemoryAddedKWords { get; init; }
    public double FileCapacityAddedKPoints { get; init; }
    public double? FileCapacityOverrideKPoints { get; init; }
    public string? ProductName { get; init; }
    public string? SupersedesProductName { get; init; }
    public string? Note { get; init; }
}

public sealed class StorageOptionDefinition
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public double CapacityGBytes { get; init; }
    public string? ProductName { get; init; }
    public string? Note { get; init; }
}

public sealed class ManualReferenceDefinition
{
    public required string Manual { get; init; }
    public IReadOnlyList<string> Pages { get; init; } = [];
}

public sealed class CapacityCalculationResult
{
    public required IReadOnlyDictionary<string, AreaCalculationResult> Areas { get; init; }
    public required IReadOnlyList<string> Errors { get; init; }
}

public sealed class AreaCalculationResult
{
    public double UsedWords { get; init; }
    public double CapacityWords { get; init; }
    public double Percent { get; init; }
    public required string Status { get; init; }
}
