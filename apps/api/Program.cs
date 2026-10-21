using System.Security.Cryptography;
using System.Text;
using Npgsql;
using Microsoft.AspNetCore.Http.Features;
using System.Text.Json.Serialization;
using static AdminEndpoints;
using static AuthEndpoints;
using static ImageEndpoints;
using static MeEndpoints;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
var imgproxyUrl = builder.Configuration["IMGPROXY_URL"]
    ?? throw new InvalidOperationException("missing IMGPROXY_URL");

// Default body limit is small (JSON endpoints); /upload raises it for itself only.
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 1 << 20);
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = ImgOptions.MaxUploadBytes + (1 << 20));

var connStr = builder.Configuration["DB_CONN"]
    ?? throw new InvalidOperationException("missing DB_CONN");
builder.Services.AddSingleton(NpgsqlDataSource.Create(connStr));

builder.Services.AddSingleton<UserEvents>();
builder.Services.AddSingleton<ImgOptions>();
builder.Services.AddSingleton<ImgproxySigner>();

builder.Services.AddRateLimiter(o =>
{
  o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
  o.AddConcurrencyLimiter("upload", c =>
  {
    c.PermitLimit = 8;
    c.QueueLimit = 20;
    c.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
  });
});

var app = builder.Build();
app.UseRateLimiter();

var imgHttp = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

// URL-safe base64 of HMAC-SHA256(key, salt + path), without padding.


// Verified against on unknown emails so login timing does not reveal which emails exist.
var dummyHash = BCrypt.Net.BCrypt.HashPassword("dummy-password");

app.MapGet("/healthz", () => "ok");

app.MapAuth();
app.MapMe();
app.MapImages();
app.MapAdmin();
app.Run();

record Creds(string? Email, string? Password);
record UserPatch([property: JsonPropertyName("quota_bytes")] long? QuotaBytes, bool? Disabled);
