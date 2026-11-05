using static AuthHelper;
using static Http;
using Npgsql;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Primitives;
using Microsoft.Net.Http.Headers;

static class VideoEndpoints
{
  public static void MapVideos(this WebApplication app)
  {
    app.MapPost("/upload/video", async (HttpContext ctx, NpgsqlDataSource db, ImgOptions opt) =>
    {
      var uid = await Auth(ctx, db);
      if (uid is null) return Err(401, "invalid token");

      // Must be set before the body is read.
      ctx.Features.Get<IHttpMaxRequestBodySizeFeature>()!.MaxRequestBodySize = ImgOptions.MaxVideoBytes + (1 << 20);
      if (!MediaTypeHeaderValue.TryParse(ctx.Request.ContentType, out var ct)
          || !ct.MediaType.Equals("multipart/form-data", StringComparison.OrdinalIgnoreCase)
          || StringSegment.IsNullOrEmpty(ct.Boundary))
        return Err(400, "multipart/form-data required");

      var id = Guid.NewGuid();
      var dir = Path.Combine(opt.VideoDir, uid.Value.ToString());
      var finalPath = Path.Combine(dir, $"{id}.mp4");
      var partPath = finalPath + ".part";
      string? fileName = null;
      VideoMeta meta = default;
      long size = 0;
      var wrote = false;
      var committed = false;
      try
      {
        // Stream the body to a temp file: only the "file" part is read, never held in memory.
        var reader = new MultipartReader(HeaderUtilities.RemoveQuotes(ct.Boundary).Value!, ctx.Request.Body);
        MultipartSection? section;
        while ((section = await reader.ReadNextSectionAsync(ctx.RequestAborted)) is not null)
        {
          if (!ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var cd)
              || !HeaderUtilities.RemoveQuotes(cd.Name).Equals("file", StringComparison.Ordinal)
              || !cd.FileName.HasValue)
            continue;

          Directory.CreateDirectory(dir);
          wrote = true;
          await using (var fs = new FileStream(partPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
          {
            var buf = new byte[81920];
            int r;
            while ((r = await section.Body.ReadAsync(buf, ctx.RequestAborted)) > 0)
            {
              size += r;
              if (size > ImgOptions.MaxVideoBytes) return Err(413, "file too large");
              await fs.WriteAsync(buf.AsMemory(0, r), ctx.RequestAborted);
            }
          }
          fileName = HeaderUtilities.RemoveQuotes(cd.FileName).Value;
          break;
        }
        if (!wrote) return Err(400, "field 'file' is required");
        if (size == 0) return Err(400, "field 'file' is required");

        // The whole file is on disk now; Parse needs a seekable stream and may be fed hostile input.
        VideoMeta? parsed;
        try
        {
          await using var rs = new FileStream(partPath, FileMode.Open, FileAccess.Read, FileShare.Read);
          parsed = VideoInfo.Parse(rs);
        }
        catch (Exception) { parsed = null; }
        if (parsed is null) return Err(415, "only mp4 is accepted");
        meta = parsed.Value;
        if ((long)meta.W * meta.H > 8_294_400) return Err(400, "video too large (max 4K)");

        File.Move(partPath, finalPath);

        var name = Path.GetFileName(fileName ?? "");          // stored in DB only, never used as a path
        if (name.Length > 200) name = name[..200];

        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        // Atomic quota check: the row lock serializes concurrent uploads of the same user.
        await using (var q = new NpgsqlCommand(
            "UPDATE users SET used_bytes = used_bytes + $1 WHERE id = $2 AND used_bytes + $1 <= quota_bytes",
            conn, tx))
        {
          q.Parameters.AddWithValue(size);
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
          au.Parameters.AddWithValue(size);
          au.Parameters.AddWithValue(accountId);
          await au.ExecuteNonQueryAsync();
        }

        await using (var ins = new NpgsqlCommand(
            "INSERT INTO videos (id, user_id, project_id, filename, size_bytes, width, height) " +
            "VALUES ($1, $2, $3, $4, $5, $6, $7)", conn, tx))
        {
          ins.Parameters.AddWithValue(id);
          ins.Parameters.AddWithValue(uid.Value);
          ins.Parameters.AddWithValue(projectId);
          ins.Parameters.AddWithValue(name);
          ins.Parameters.AddWithValue(size);
          ins.Parameters.AddWithValue(meta.W);
          ins.Parameters.AddWithValue(meta.H);
          await ins.ExecuteNonQueryAsync();
        }
        await tx.CommitAsync();
        committed = true;

        return Results.Json(new { id, width = meta.W, height = meta.H, size_bytes = size, url = $"/v/{id}" },
            statusCode: 201);
      }
      catch (BadHttpRequestException) { return Err(413, "file too large"); }
      catch (InvalidDataException) { return Err(400, "invalid form"); }
      finally
      {
        // Files are written before the DB commit; anything but a commit removes them.
        if (!committed)
        {
          try { File.Delete(partPath); } catch { /* best effort */ }
          try { File.Delete(finalPath); } catch { /* best effort */ }
        }
      }
    }).RequireRateLimiting("video-upload");

    app.MapGet("/v/{id:guid}", async (Guid id, HttpContext ctx, NpgsqlDataSource db, ImgOptions opt) =>
    {
      long userId;
      await using (var cmd = db.CreateCommand("SELECT user_id FROM videos WHERE id = $1"))
      {
        cmd.Parameters.AddWithValue(id);
        var o = await cmd.ExecuteScalarAsync();
        if (o is null) return Err(404, "not found");
        userId = (long)o;
      }

      var path = Path.Combine(opt.VideoDir, userId.ToString(), $"{id}.mp4");
      if (!File.Exists(path)) return Err(404, "not found");

      ctx.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
      return Results.File(path, "video/mp4", enableRangeProcessing: true);
    });

    app.MapDelete("/videos/{id:guid}", async (Guid id, HttpContext ctx, NpgsqlDataSource db, ImgOptions opt) =>
    {
      var uid = await Auth(ctx, db);
      if (uid is null) return Err(401, "invalid token");

      await using var conn = await db.OpenConnectionAsync();
      await using var tx = await conn.BeginTransactionAsync();

      // The user_id condition makes other users' videos look like "not found".
      long size, projectId;
      await using (var del = new NpgsqlCommand(
          "DELETE FROM videos WHERE id = $1 AND user_id = $2 RETURNING size_bytes, project_id", conn, tx))
      {
        del.Parameters.AddWithValue(id);
        del.Parameters.AddWithValue(uid.Value);
        await using var r = await del.ExecuteReaderAsync();
        if (!await r.ReadAsync()) return Err(404, "not found");
        size = r.GetInt64(0);
        projectId = r.GetInt64(1);
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

      // File removal after commit: a failure leaves an orphan file, never a row pointing to a missing file.
      try { File.Delete(Path.Combine(opt.VideoDir, uid.Value.ToString(), $"{id}.mp4")); }
      catch (Exception e) { app.Logger.LogWarning(e, "could not delete file for video {Id}", id); }

      return Results.NoContent();
    });
  }
}
