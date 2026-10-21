using System.Security.Cryptography;
using System.Text;
using Npgsql;
using Microsoft.AspNetCore.Http.Features;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
const long MaxUploadBytes = 20 * 1024 * 1024;
var uploadDir = builder.Configuration["UPLOAD_DIR"] ?? "/data/uploads";
// imgproxy connection + signing material (hex-encoded in env).
var imgproxyUrl = builder.Configuration["IMGPROXY_URL"]
    ?? throw new InvalidOperationException("missing IMGPROXY_URL");
var imgKey = Convert.FromHexString(builder.Configuration["IMGPROXY_KEY"]
    ?? throw new InvalidOperationException("missing IMGPROXY_KEY"));
var imgSalt = Convert.FromHexString(builder.Configuration["IMGPROXY_SALT"]
    ?? throw new InvalidOperationException("missing IMGPROXY_SALT"));

// Small-image rule (tunable via env, defaults match the plan).
var smallMaxSide = builder.Configuration.GetValue("SMALL_MAX_SIDE", 512);
var smallQuality = builder.Configuration.GetValue("SMALL_QUALITY", 60);
var smallScale = builder.Configuration.GetValue("SMALL_SCALE", 0.75);
var normalQuality = builder.Configuration.GetValue("NORMAL_QUALITY", 80);

// Default body limit is small (JSON endpoints); /upload raises it for itself only.
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 1 << 20);
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = MaxUploadBytes + (1 << 20));

var connStr = builder.Configuration["DB_CONN"]
    ?? throw new InvalidOperationException("missing DB_CONN");
builder.Services.AddSingleton(NpgsqlDataSource.Create(connStr));
var app = builder.Build();

var imgHttp = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

// URL-safe base64 of HMAC-SHA256(key, salt + path), without padding.
string Sign(string path)
{
    var msg = imgSalt.Concat(Encoding.UTF8.GetBytes(path)).ToArray();
    return Convert.ToBase64String(HMACSHA256.HashData(imgKey, msg))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

// Verified against on unknown emails so login timing does not reveal which emails exist.
var dummyHash = BCrypt.Net.BCrypt.HashPassword("dummy-password");

static string Sha256Hex(string s) =>
    Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();

static IResult Err(int code, string msg) => Results.Json(new { error = msg }, statusCode: code);

// Resolves "Authorization: Bearer <token>" to a user id, or null if missing/invalid/expired.
static async Task<long?> Auth(HttpContext ctx, NpgsqlDataSource db)
{
    var h = ctx.Request.Headers.Authorization.ToString();
    if (!h.StartsWith("Bearer ") || h.Length <= 7) return null;
    await using var cmd = db.CreateCommand(
        "SELECT s.user_id FROM sessions s JOIN users u ON u.id = s.user_id " +
        "WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.disabled");
    cmd.Parameters.AddWithValue(Sha256Hex(h[7..]));
    return await cmd.ExecuteScalarAsync() as long?;
}

// Returns (adminId, null) or (null, error result). Role is read from the DB on every call.
static async Task<(long? uid, IResult? err)> RequireAdmin(HttpContext ctx, NpgsqlDataSource db)
{
    var uid = await Auth(ctx, db);
    if (uid is null) return (null, Err(401, "invalid token"));
    await using var cmd = db.CreateCommand("SELECT role FROM users WHERE id = $1");
    cmd.Parameters.AddWithValue(uid.Value);
    return (await cmd.ExecuteScalarAsync() as string) == "admin"
        ? (uid, null)
        : (null, Err(403, "admin only"));
}

app.MapGet("/healthz", () => "ok");

app.MapPost("/register", async (Creds c, NpgsqlDataSource db) =>
{
    var email = (c.Email ?? "").Trim().ToLowerInvariant();
    var pw = c.Password ?? "";
    // bcrypt only uses the first 72 bytes, so reject longer passwords explicitly.
    if (!email.Contains('@') || pw.Length < 8 || Encoding.UTF8.GetByteCount(pw) > 72)
        return Err(400, "invalid email or password (8-72 chars)");

    try
    {
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        long id;
        await using (var cmd = new NpgsqlCommand(
            "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id", conn, tx))
        {
            cmd.Parameters.AddWithValue(email);
            cmd.Parameters.AddWithValue(BCrypt.Net.BCrypt.HashPassword(pw));
            id = (long)(await cmd.ExecuteScalarAsync())!;
        }

        // Every new user gets one account, one "Default" project, and is its admin.
        await using (var org = new NpgsqlCommand(
            "WITH a AS (INSERT INTO accounts (owner_user_id, plan_code) VALUES ($1, 'default') RETURNING id), " +
            "p AS (INSERT INTO projects (account_id, name) SELECT id, 'Default' FROM a RETURNING id) " +
            "INSERT INTO project_members (project_id, user_id, role) SELECT id, $1, 'admin' FROM p", conn, tx))
        {
            org.Parameters.AddWithValue(id);
            await org.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();
        return Results.Json(new { id, email }, statusCode: 201);
    }
    catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
    {
        return Err(409, "email already registered");
    }
});

app.MapPost("/login", async (Creds c, NpgsqlDataSource db) =>
{
    var email = (c.Email ?? "").Trim().ToLowerInvariant();
    var pw = c.Password ?? "";

    long id = 0;
    string? hash = null;
    bool disabled = false;
    await using (var cmd = db.CreateCommand("SELECT id, password_hash, disabled FROM users WHERE email = $1"))
    {
        cmd.Parameters.AddWithValue(email);
        await using var r = await cmd.ExecuteReaderAsync();
        if (await r.ReadAsync()) { id = r.GetInt64(0); hash = r.GetString(1); disabled = r.GetBoolean(2); }
    }

    if (hash is null)
    {
        BCrypt.Net.BCrypt.Verify(pw, dummyHash);
        return Err(401, "invalid credentials");
    }
    if (!BCrypt.Net.BCrypt.Verify(pw, hash)) return Err(401, "invalid credentials");
    if (disabled) return Err(403, "account disabled");

    var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    // Only the hash is stored, so a DB leak does not expose usable tokens.
    await using var ins = db.CreateCommand(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)");
    ins.Parameters.AddWithValue(Sha256Hex(token));
    ins.Parameters.AddWithValue(id);
    ins.Parameters.AddWithValue(DateTime.UtcNow.AddDays(7));
    await ins.ExecuteNonQueryAsync();
    return Results.Json(new { token });
});

app.MapGet("/me", async (HttpContext ctx, NpgsqlDataSource db) =>
{
    var uid = await Auth(ctx, db);
    if (uid is null) return Err(401, "invalid token");

    await using var cmd = db.CreateCommand(
        "SELECT email, quota_bytes, used_bytes, role FROM users WHERE id = $1");
    cmd.Parameters.AddWithValue(uid.Value);
    await using var r = await cmd.ExecuteReaderAsync();
    if (!await r.ReadAsync()) return Err(401, "invalid token");
    return Results.Json(new { email = r.GetString(0), quota_bytes = r.GetInt64(1), used_bytes = r.GetInt64(2), role = r.GetString(3) });
});

app.MapPost("/upload", async (HttpContext ctx, NpgsqlDataSource db) =>
{
    var uid = await Auth(ctx, db);
    if (uid is null) return Err(401, "invalid token");

    // Must be set before the body is read.
    ctx.Features.Get<IHttpMaxRequestBodySizeFeature>()!.MaxRequestBodySize = MaxUploadBytes + (1 << 20);
    if (!ctx.Request.HasFormContentType) return Err(400, "multipart/form-data required");

    IFormFile? file;
    try { file = (await ctx.Request.ReadFormAsync()).Files["file"]; }
    catch (BadHttpRequestException) { return Err(413, "file too large"); }
    catch (InvalidDataException) { return Err(400, "invalid form"); }
    if (file is null || file.Length == 0) return Err(400, "field 'file' is required");
    if (file.Length > MaxUploadBytes) return Err(413, "file too large");

    var data = new byte[file.Length];
    await using (var s = file.OpenReadStream()) await s.ReadExactlyAsync(data);

    // Trust the bytes, not the client-supplied content type or extension.
    var meta = ImageInfo.Parse(data);
    if (meta is null) return Err(415, "only png and jpeg are accepted");
    var (mime, ext, w, h) = meta.Value;
    if ((long)w * h > 50_000_000) return Err(400, "image too large (max 50 megapixels)");

    var id = Guid.NewGuid();
    var dir = Path.Combine(uploadDir, uid.Value.ToString());
    var path = Path.Combine(dir, $"{id}.{ext}");
    var name = Path.GetFileName(file.FileName);          // stored in DB only, never used as a path
    if (name.Length > 200) name = name[..200];

    await using var conn = await db.OpenConnectionAsync();
    await using var tx = await conn.BeginTransactionAsync();

    // Atomic quota check: the row lock serializes concurrent uploads of the same user.

    await using (var q = new NpgsqlCommand(
        "UPDATE users SET used_bytes = used_bytes + $1 WHERE id = $2 AND used_bytes + $1 <= quota_bytes",
        conn, tx))
    {
        q.Parameters.AddWithValue((long)data.Length);
        q.Parameters.AddWithValue(uid.Value);
        if (await q.ExecuteNonQueryAsync() == 0) return Err(413, "quota exceeded"); // tx rolls back on dispose
    }

    long projectId, accountId;
    await using (var pq = new NpgsqlCommand(
        "SELECT p.id, p.account_id FROM projects p JOIN accounts a ON a.id = p.account_id " +
        "WHERE a.owner_user_id = $1 ORDER BY p.id LIMIT 1", conn, tx))
    {
        pq.Parameters.AddWithValue(uid.Value);
        await using var pr = await pq.ExecuteReaderAsync();
        if (!await pr.ReadAsync()) return Err(500, "user has no default project");
        projectId = pr.GetInt64(0);
        accountId = pr.GetInt64(1);
    }

    await using (var au = new NpgsqlCommand(
        "UPDATE accounts SET used_bytes = used_bytes + $1 WHERE id = $2", conn, tx))
    {
        au.Parameters.AddWithValue((long)data.Length);
        au.Parameters.AddWithValue(accountId);
        await au.ExecuteNonQueryAsync();
    }

    await using (var ins = new NpgsqlCommand(
        "INSERT INTO images (id, user_id, project_id, filename, mime, ext, size_bytes, width, height) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", conn, tx))
    {
        ins.Parameters.AddWithValue(id);
        ins.Parameters.AddWithValue(uid.Value);
        ins.Parameters.AddWithValue(projectId);
        ins.Parameters.AddWithValue(name);
        ins.Parameters.AddWithValue(mime);
        ins.Parameters.AddWithValue(ext);
        ins.Parameters.AddWithValue((long)data.Length);
        ins.Parameters.AddWithValue(w);
        ins.Parameters.AddWithValue(h);
        await ins.ExecuteNonQueryAsync();
    }
    // Write the file before commit: if writing fails, the DB changes roll back and quota is untouched.
    try
    {
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(path, data);
        await tx.CommitAsync();
    }
    catch
    {
        try { File.Delete(path); } catch { /* best effort */ }
        throw;
    }

    return Results.Json(new { id, width = w, height = h, size_bytes = data.Length, url = $"/i/{id}" },
        statusCode: 201);
});

app.MapGet("/images", async (HttpContext ctx, NpgsqlDataSource db) =>
{
    var uid = await Auth(ctx, db);
    if (uid is null) return Err(401, "invalid token");

    await using var cmd = db.CreateCommand(
        "SELECT id, filename, size_bytes, width, height, created_at FROM images " +
        "WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100");
    cmd.Parameters.AddWithValue(uid.Value);
    await using var r = await cmd.ExecuteReaderAsync();
    var list = new List<object>();
    while (await r.ReadAsync())
        list.Add(new
        {
            id = r.GetGuid(0),
            filename = r.GetString(1),
            size_bytes = r.GetInt64(2),
            width = r.GetInt32(3),
            height = r.GetInt32(4),
            created_at = r.GetDateTime(5)
        });
    return Results.Json(list);
});

app.MapGet("/i/{id:guid}", async (Guid id, int? w, string? fmt, HttpContext ctx, NpgsqlDataSource db) =>
{
    long userId = 0; string srcExt = ""; int srcW = 0, srcH = 0;
    await using (var cmd = db.CreateCommand("SELECT user_id, ext, width, height FROM images WHERE id = $1"))
    {
        cmd.Parameters.AddWithValue(id);
        await using var r = await cmd.ExecuteReaderAsync();
        if (!await r.ReadAsync()) return Err(404, "not found");
        userId = r.GetInt64(0); srcExt = r.GetString(1); srcW = r.GetInt32(2); srcH = r.GetInt32(3);
    }

    // Only whitelisted widths, so clients cannot create unlimited cache variants.
    int[] allowed = [64, 128, 256, 512, 1024, 2048];
    int target;
    if (w is null) target = allowed.Where(a => a <= srcW).DefaultIfEmpty(allowed[0]).Max();
    else if (!allowed.Contains(w.Value)) return Err(400, "w must be one of 64,128,256,512,1024,2048");
    else target = w.Value;
    target = Math.Min(target, srcW); // never upscale

    // Small images: shrink further and lower the quality.
    bool small = Math.Max(srcW, srcH) <= smallMaxSide;
    int outW = small ? Math.Max(1, (int)(target * smallScale)) : target;
    int quality = small ? smallQuality : normalQuality;

    // ?fmt= wins, otherwise the normalized Accept value that nginx sends in X-Img-Fmt.
    var want = (fmt ?? ctx.Request.Headers["X-Img-Fmt"].ToString()).ToLowerInvariant();
    if (fmt is not null && want is not ("avif" or "webp" or "orig"))
        return Err(400, "fmt must be avif, webp or orig");
    var outExt = want switch { "avif" => "avif", "webp" => "webp", _ => srcExt };
    if (outExt == "avif") quality = Math.Max(1, quality - 10);

    var path = $"/rs:fit:{outW}:0/el:0/q:{quality}/plain/local:///{userId}/{id}.{srcExt}@{outExt}";
    using var resp = await imgHttp.GetAsync($"{imgproxyUrl}/{Sign(path)}{path}");
    if (!resp.IsSuccessStatusCode)
    {
        app.Logger.LogWarning("imgproxy returned {Status} for {Path}", (int)resp.StatusCode, path);
        return Err(502, "image processing failed");
    }

    var bytes = await resp.Content.ReadAsByteArrayAsync();
    ctx.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
    ctx.Response.Headers["X-Small-Image"] = small ? "true" : "false";
    if (fmt is null) ctx.Response.Headers.Vary = "Accept";
    return Results.File(bytes, resp.Content.Headers.ContentType?.ToString() ?? "application/octet-stream");
});

app.MapDelete("/images/{id:guid}", async (Guid id, HttpContext ctx, NpgsqlDataSource db) =>
{
    var uid = await Auth(ctx, db);
    if (uid is null) return Err(401, "invalid token");

    await using var conn = await db.OpenConnectionAsync();
    await using var tx = await conn.BeginTransactionAsync();

    // The user_id condition makes other users' images look like "not found".
    long size, projectId; string ext;
    await using (var del = new NpgsqlCommand(
        "DELETE FROM images WHERE id = $1 AND user_id = $2 RETURNING size_bytes, ext, project_id", conn, tx))
    {
        del.Parameters.AddWithValue(id);
        del.Parameters.AddWithValue(uid.Value);
        await using var r = await del.ExecuteReaderAsync();
        if (!await r.ReadAsync()) return Err(404, "not found");
        size = r.GetInt64(0);
        ext = r.GetString(1);
        projectId = r.GetInt64(2);
    }

    await using (var upd = new NpgsqlCommand(
        "UPDATE users SET used_bytes = GREATEST(used_bytes - $1, 0) WHERE id = $2", conn, tx))
    {
        upd.Parameters.AddWithValue(size);
        upd.Parameters.AddWithValue(uid.Value);
        await upd.ExecuteNonQueryAsync();
    }

    await using (var acc = new NpgsqlCommand(
    "UPDATE accounts SET used_bytes = GREATEST(used_bytes - $1, 0) " +
    "WHERE id = (SELECT account_id FROM projects WHERE id = $2)", conn, tx))
    {
        acc.Parameters.AddWithValue(size);
        acc.Parameters.AddWithValue(projectId);
        await acc.ExecuteNonQueryAsync();
    }
    await tx.CommitAsync();

    // File removal after commit: a failure leaves an orphan file (wasted space),
    // never a DB row that points to a missing file.
    try { File.Delete(Path.Combine(uploadDir, uid.Value.ToString(), $"{id}.{ext}")); }
    catch (Exception e) { app.Logger.LogWarning(e, "could not delete file for image {Id}", id); }

    return Results.NoContent();
});

app.MapGet("/admin/users", async (HttpContext ctx, NpgsqlDataSource db) =>
{
    var (_, err) = await RequireAdmin(ctx, db);
    if (err is not null) return err;

    await using var cmd = db.CreateCommand(
        "SELECT id, email, role, disabled, quota_bytes, used_bytes, created_at FROM users ORDER BY id");
    await using var r = await cmd.ExecuteReaderAsync();
    var list = new List<object>();
    while (await r.ReadAsync())
        list.Add(new
        {
            id = r.GetInt64(0),
            email = r.GetString(1),
            role = r.GetString(2),
            disabled = r.GetBoolean(3),
            quota_bytes = r.GetInt64(4),
            used_bytes = r.GetInt64(5),
            created_at = r.GetDateTime(6)
        });
    return Results.Json(list);
});

app.MapPatch("/admin/users/{id:long}", async (long id, UserPatch p, HttpContext ctx, NpgsqlDataSource db) =>
{
    var (adminId, err) = await RequireAdmin(ctx, db);
    if (err is not null) return err;
    if (p.QuotaBytes is null && p.Disabled is null) return Err(400, "nothing to update");
    if (p.QuotaBytes < 0) return Err(400, "quota_bytes must be >= 0");
    if (id == adminId && p.Disabled == true) return Err(400, "cannot disable yourself");

    await using var conn = await db.OpenConnectionAsync();
    await using var tx = await conn.BeginTransactionAsync();

    await using (var upd = new NpgsqlCommand(
        "UPDATE users SET quota_bytes = COALESCE($1, quota_bytes), disabled = COALESCE($2, disabled) WHERE id = $3",
        conn, tx))
    {
        upd.Parameters.AddWithValue((object?)p.QuotaBytes ?? DBNull.Value);
        upd.Parameters.AddWithValue((object?)p.Disabled ?? DBNull.Value);
        upd.Parameters.AddWithValue(id);
        if (await upd.ExecuteNonQueryAsync() == 0) return Err(404, "user not found");
    }

    // Keep the new account quota in sync until /upload reads from accounts.
    if (p.QuotaBytes is not null)
    {
        await using var acc = new NpgsqlCommand(
            "UPDATE accounts SET quota_override_bytes = $1 WHERE owner_user_id = $2", conn, tx);
        acc.Parameters.AddWithValue(p.QuotaBytes.Value);
        acc.Parameters.AddWithValue(id);
        await acc.ExecuteNonQueryAsync();
    }

    // Disabling also kills existing sessions.
    if (p.Disabled == true)
    {
        await using var del = new NpgsqlCommand("DELETE FROM sessions WHERE user_id = $1", conn, tx);
        del.Parameters.AddWithValue(id);
        await del.ExecuteNonQueryAsync();
    }

    await tx.CommitAsync();
    return Results.NoContent();
});

app.Run();

record Creds(string? Email, string? Password);
record UserPatch([property: JsonPropertyName("quota_bytes")] long? QuotaBytes, bool? Disabled);
