using static AuthHelper;
using static Http;
using Npgsql;
using System.Text;

static class MeEndpoints
{
  public static void MapMe(this WebApplication app)
  {
    var g = app.MapGroup("/me");
    g.MapGet("", async (HttpContext ctx, NpgsqlDataSource db) =>
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

    g.MapPost("/password", async (PasswordChange body, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var uid = await Auth(ctx, db);
      if (uid is null) return Err(401, "invalid token");

      var cur = body.CurrentPassword ?? "";
      var next = body.NewPassword ?? "";
      // Same rule as /register: bcrypt only uses the first 72 bytes.
      if (next.Length < 8 || Encoding.UTF8.GetByteCount(next) > 72 || next == cur)
        return Err(400, "invalid new password (8-72 chars, must differ from current)");

      string? hash = null;
      await using (var sel = db.CreateCommand("SELECT password_hash FROM users WHERE id = $1"))
      {
        sel.Parameters.AddWithValue(uid.Value);
        hash = await sel.ExecuteScalarAsync() as string;
      }
      if (hash is null) return Err(401, "invalid token");
      if (!BCrypt.Net.BCrypt.Verify(cur, hash)) return Err(403, "invalid credentials");

      await using var conn = await db.OpenConnectionAsync();
      await using var tx = await conn.BeginTransactionAsync();
      await using (var upd = new NpgsqlCommand("UPDATE users SET password_hash = $1 WHERE id = $2", conn, tx))
      {
        upd.Parameters.AddWithValue(BCrypt.Net.BCrypt.HashPassword(next));
        upd.Parameters.AddWithValue(uid.Value);
        await upd.ExecuteNonQueryAsync();
      }
      // Revoke every other session; keep the one making this request.
      var token = ctx.Request.Headers.Authorization.ToString()[7..];
      await using (var del = new NpgsqlCommand(
          "DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", conn, tx))
      {
        del.Parameters.AddWithValue(uid.Value);
        del.Parameters.AddWithValue(Sha256Hex(token));
        await del.ExecuteNonQueryAsync();
      }
      await tx.CommitAsync();
      return Results.NoContent();
    });

    g.MapGet("/events", async (HttpContext ctx, NpgsqlDataSource db, UserEvents events) =>
    {
      var uid = await Auth(ctx, db);
      if (uid is null) { ctx.Response.StatusCode = 401; return; }
      var sub = events.Subscribe(uid.Value);
      if (sub is null) { ctx.Response.StatusCode = 429; return; }
      var (subId, reader) = sub.Value;
      // Re-check after subscribing so a user disabled in between does not keep an open stream.
      if (await Auth(ctx, db) is null) { events.Unsubscribe(uid.Value, subId); ctx.Response.StatusCode = 401; return; }

      ctx.Response.Headers.ContentType = "text/event-stream";
      ctx.Response.Headers.CacheControl = "no-cache";
      ctx.Response.Headers["X-Accel-Buffering"] = "no";
      try
      {
        await ctx.Response.WriteAsync(": connected\n\n", ctx.RequestAborted);
        await ctx.Response.Body.FlushAsync(ctx.RequestAborted);
        while (!ctx.RequestAborted.IsCancellationRequested)
        {
          using var cts = CancellationTokenSource.CreateLinkedTokenSource(ctx.RequestAborted);
          cts.CancelAfter(TimeSpan.FromSeconds(20));
          try
          {
            if (!await reader.WaitToReadAsync(cts.Token)) break; // closed by Close()
            while (reader.TryRead(out var evt))
              await ctx.Response.WriteAsync($"event: {evt}\ndata: {{}}\n\n", ctx.RequestAborted);
          }
          catch (OperationCanceledException) when (!ctx.RequestAborted.IsCancellationRequested)
          {
            await ctx.Response.WriteAsync(": ping\n\n", ctx.RequestAborted); // keep-alive
          }
          await ctx.Response.Body.FlushAsync(ctx.RequestAborted);
        }
      }
      catch (OperationCanceledException) { }
      finally { events.Unsubscribe(uid.Value, subId); }
    });
  }
}