using static AuthHelper;
using static Http;
using Npgsql;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Http.Features;

static class ImageEndpoints
{
  static readonly HttpClient imgHttp = new() { Timeout = TimeSpan.FromSeconds(30) };
  public static void MapImages(this WebApplication app)
  {
    app.MapPost("/upload", async (HttpContext ctx, NpgsqlDataSource db, ImgOptions opt) =>
    {
      var uid = await Auth(ctx, db);
      if (uid is null) return Err(401, "invalid token");

      // Must be set before the body is read.
      ctx.Features.Get<IHttpMaxRequestBodySizeFeature>()!.MaxRequestBodySize = ImgOptions.MaxUploadBytes + (1 << 20);
      if (!ctx.Request.HasFormContentType) return Err(400, "multipart/form-data required");

      IFormFile? file;
      try { file = (await ctx.Request.ReadFormAsync()).Files["file"]; }
      catch (BadHttpRequestException) { return Err(413, "file too large"); }
      catch (InvalidDataException) { return Err(400, "invalid form"); }
      if (file is null || file.Length == 0) return Err(400, "field 'file' is required");
      if (file.Length > ImgOptions.MaxUploadBytes) return Err(413, "file too large");

      var data = new byte[file.Length];
      await using (var s = file.OpenReadStream()) await s.ReadExactlyAsync(data);

      // Trust the bytes, not the client-supplied content type or extension.
      var meta = ImageInfo.Parse(data);
      if (meta is null) return Err(415, "only png and jpeg are accepted");
      var (mime, ext, w, h) = meta.Value;
      if ((long)w * h > 50_000_000) return Err(400, "image too large (max 50 megapixels)");

      var id = Guid.NewGuid();
      var dir = Path.Combine(opt.UploadDir, uid.Value.ToString());
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

    app.MapGet("/i/{id:guid}", async (Guid id, int? w, string? fmt, HttpContext ctx, NpgsqlDataSource db, ImgOptions opt, ImgproxySigner signer) =>
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
      bool small = Math.Max(srcW, srcH) <= opt.SmallMaxSide;
      int outW = small ? Math.Max(1, (int)(target * opt.SmallScale)) : target;
      int quality = small ? opt.SmallQuality : opt.NormalQuality;

      // ?fmt= wins, otherwise the normalized Accept value that nginx sends in X-Img-Fmt.
      var want = (fmt ?? ctx.Request.Headers["X-Img-Fmt"].ToString()).ToLowerInvariant();
      if (fmt is not null && want is not ("avif" or "webp" or "orig"))
        return Err(400, "fmt must be avif, webp or orig");
      var outExt = want switch { "avif" => "avif", "webp" => "webp", _ => srcExt };
      if (outExt == "avif") quality = Math.Max(1, quality - 10);

      var path = $"/rs:fit:{outW}:0/el:0/q:{quality}/plain/local:///{userId}/{id}.{srcExt}@{outExt}";
      using var resp = await imgHttp.GetAsync($"{opt.ProxyUrl}/{signer.Sign(path)}{path}");
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

    app.MapDelete("/images/{id:guid}", async (Guid id, HttpContext ctx, NpgsqlDataSource db, ImgOptions opt) =>
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
      try { File.Delete(Path.Combine(opt.UploadDir, uid.Value.ToString(), $"{id}.{ext}")); }
      catch (Exception e) { app.Logger.LogWarning(e, "could not delete file for image {Id}", id); }

      return Results.NoContent();
    });
  }
}