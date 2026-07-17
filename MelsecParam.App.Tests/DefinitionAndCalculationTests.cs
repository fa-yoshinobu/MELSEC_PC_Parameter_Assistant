using MelsecParam.App.Models;
using MelsecParam.App.Services;

namespace MelsecParam.App.Tests;

public sealed class DefinitionAndCalculationTests
{
    private static readonly string AppRoot = FindAppRoot();
    private static readonly DefinitionCatalog Catalog = DefinitionCatalog.Load(AppRoot);

    [Fact]
    public void Catalog_loads_all_model_json_and_only_allows_backup_excluded_storage()
    {
        var jsonCount = Directory.GetFiles(Path.Combine(AppRoot, "Definitions", "Models"), "*.json").Length;

        Assert.Equal(jsonCount, Catalog.Data.Models.Count);
        Assert.All(Catalog.Data.Models, model =>
        {
            Assert.Contains("none", model.AllowedMemoryOptionIds);
            Assert.Equal(["none"], model.AllowedStorageOptionIds);
        });
    }

    [Fact]
    public void GxWorks2_reference_sheet_is_39_point_2_kwords()
    {
        var result = CalculateDefaults("qnudv-q04");

        Assert.Equal(40_148d, result.Areas["device"].UsedWords, precision: 6);
        Assert.Equal(39.20703125d, result.Areas["device"].UsedWords / 1024d, precision: 8);
        Assert.Equal("warning", result.Areas["device"].Status);
    }

    [Fact]
    public void GxWorks3_reference_sheet_is_38_point_4_kwords_including_overhead()
    {
        var result = CalculateDefaults("iqr-r04");

        Assert.Equal(39_296d, result.Areas["device"].UsedWords, precision: 6);
        Assert.Equal(38.375d, result.Areas["device"].UsedWords / 1024d, precision: 8);
        Assert.Equal("warning", result.Areas["device"].Status);
    }

    [Fact]
    public void Setting_unit_error_is_reported()
    {
        var model = Model("iqr-r04");
        var result = CapacityCalculator.Calculate(model, RuleSet(model), Memory("none"),
            new Dictionary<string, long> { ["M"] = 12_289 });

        Assert.Contains(result.Errors, error => error.Contains("M:") && error.Contains("64点単位"));
    }

    [Fact]
    public void Model_rejects_memory_option_not_listed_in_its_json()
    {
        var model = Model("process-r08");

        var exception = Assert.Throws<ArgumentException>(() =>
            CapacityCalculator.Calculate(model, RuleSet(model), Memory("iqr-sram-1mb"),
                new Dictionary<string, long>()));

        Assert.Contains("選択できるオプションではありません", exception.Message);
    }

    [Fact]
    public void Q_successor_cards_keep_their_predecessor_relation()
    {
        Assert.Equal("Q2MEM-1MBS", Memory("q-sram-card-1mb").SupersedesProductName);
        Assert.Equal("Q2MEM-2MBS", Memory("q-sram-card-2mb").SupersedesProductName);
    }

    [Fact]
    public void Every_model_default_is_valid_and_within_each_area_capacity()
    {
        foreach (var model in Catalog.Data.Models)
        {
            var result = CapacityCalculator.Calculate(model, RuleSet(model), Memory("none"),
                new Dictionary<string, long>());

            Assert.Empty(result.Errors);
            Assert.All(result.Areas, area => Assert.NotEqual("over", area.Value.Status));
        }
    }

    [Fact]
    public void Qnudv_8mb_cassette_adds_full_capacity_to_standard_ram()
    {
        var model = Model("qnudv-q26");
        var result = CapacityCalculator.Calculate(model, RuleSet(model), Memory("q-sram-cassette-8mb"),
            new Dictionary<string, long> { ["ZR"] = 4_736 * 1024L },
            new Dictionary<string, double> { ["file"] = 4_736 });

        Assert.Equal(4_736 * 1024d, result.Areas["file"].CapacityWords);
        Assert.Equal(100d, result.Areas["file"].Percent, precision: 6);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void Every_model_has_program_memory_and_auxiliary_specifications()
    {
        var profileIds = Catalog.Data.SystemDeviceProfiles.Select(x => x.Id).ToHashSet();

        Assert.All(Catalog.Data.Models, model =>
        {
            Assert.True(model.ProgramCapacityKSteps is not null || !string.IsNullOrWhiteSpace(model.ProgramCapacityText),
                $"{model.Id}: プログラム容量がありません。");
            Assert.NotEmpty(model.MemoryDrives);
            Assert.True(model.AuxiliaryDevices.Count > 0 ||
                        (model.SystemDeviceProfileId is not null && profileIds.Contains(model.SystemDeviceProfileId)),
                $"{model.Id}: 補助デバイス仕様がありません。");
        });
    }

    [Fact]
    public void Latest_mx_manual_values_are_loaded()
    {
        var mxr300 = Model("mx-r300");
        var mxr500 = Model("mx-r500");
        var mxfProfile = Catalog.Data.SystemDeviceProfiles.Single(x => x.Id == "mx-f");

        Assert.Equal(65_536d, mxr300.SharedMemoryBaseKWords);
        Assert.Equal(131_072d, mxr500.SharedMemoryBaseKWords);
        Assert.Equal(102_400d, mxr300.MemoryDrives.Single(x => x.Drive == "0").CapacityKBytes);
        Assert.Equal(262_144d, mxr500.MemoryDrives.Single(x => x.Drive == "3").CapacityKBytes);
        Assert.Equal(10_000L, mxfProfile.Devices.Single(x => x.Symbol == "SM").Points);
        Assert.Equal(256L, mxfProfile.Devices.Single(x => x.Symbol == "I").Points);
    }

    [Fact]
    public void Iql_startup_manual_memory_values_are_loaded()
    {
        var l04 = Model("iql-l04");
        var l08 = Model("iql-l08");
        var l16 = Model("iql-l16");

        Assert.Equal(40d, l04.ProgramCapacityKSteps);
        Assert.Equal(80d, l08.ProgramCapacityKSteps);
        Assert.Equal(160d, l16.ProgramCapacityKSteps);
        Assert.Equal(2_048d, l04.MemoryDrives.Single(x => x.Drive == "4").CapacityKBytes);
        Assert.Equal(5_120d, l08.MemoryDrives.Single(x => x.Drive == "4").CapacityKBytes);
        Assert.Equal(10_240d, l16.MemoryDrives.Single(x => x.Drive == "4").CapacityKBytes);
    }

    [Fact]
    public void Fx5u_starts_with_documentation_ready_default_device_points()
    {
        var ruleSet = RuleSet(Model("fx5u-uc"));

        Assert.Equal(7_680, ruleSet.Devices.Single(x => x.Symbol == "M").DefaultPoints);
        Assert.Equal(512, ruleSet.Devices.Single(x => x.Symbol == "T").DefaultPoints);
        Assert.Equal(8_000, ruleSet.Devices.Single(x => x.Symbol == "D").DefaultPoints);
        Assert.Equal(32_768, ruleSet.Devices.Single(x => x.Symbol == "R").DefaultPoints);
    }

    private static CapacityCalculationResult CalculateDefaults(string modelId)
    {
        var model = Model(modelId);
        return CapacityCalculator.Calculate(model, RuleSet(model), Memory("none"),
            new Dictionary<string, long>());
    }

    private static PlcModelDefinition Model(string id) => Catalog.Data.Models.Single(x => x.Id == id);
    private static DeviceRuleSetDefinition RuleSet(PlcModelDefinition model) =>
        Catalog.Data.RuleSets.Single(x => x.Id == model.RuleSetId);
    private static MemoryOptionDefinition Memory(string id) => Catalog.Data.MemoryOptions.Single(x => x.Id == id);

    private static string FindAppRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "MelsecParam.App", "Definitions");
            if (Directory.Exists(candidate)) return Path.GetDirectoryName(candidate)!;
            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("MelsecParam.App/Definitions が見つかりません。");
    }
}
