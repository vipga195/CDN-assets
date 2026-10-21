using static AuthHelper;
using static Http;
using Npgsql;
static class AdminEndpoints
{
  public static void MapAdmin(this WebApplication app)
  {
    var g = app.MapGroup("/admin");
    g.MapGet("/users", async (HttpContext ctx, NpgsqlDataSource db) =>
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
    
    g.MapPatch("/users/{id:long}", async (long id, UserPatch p, HttpContext ctx, NpgsqlDataSource db, UserEvents events) =>
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
      events.Publish(id, "me_changed");
      if (p.Disabled == true) events.Close(id);
      return Results.NoContent();
    });
  }
}