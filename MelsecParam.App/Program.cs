using MelsecParam.App.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddSingleton(sp =>
    DefinitionCatalog.Load(builder.Environment.ContentRootPath));

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseRouting();
app.UseAuthorization();

app.MapStaticAssets();
app.MapGet("/api/catalog", (DefinitionCatalog catalog) => Results.Ok(catalog.Data));
app.MapRazorPages()
   .WithStaticAssets();

app.Run();

public partial class Program;
