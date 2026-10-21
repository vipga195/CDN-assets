using static AuthHelper;
using static Http;
using Npgsql;

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

    g.MapGet("/events", async (HttpContext ctx, NpgsqlDataSource db, UserEvents events) =>
    {
      var uid = await Auth(ctx, db);
      if (uid is null) { ctx.Response.StatusCode = 401; return; }
      var sub = events.Subscribe(uid.Value);
      if (sub is null) { ctx.Response.StatusCode = 429; return; }
      var (subId, reader) = sub.Value;

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