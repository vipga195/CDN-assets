using static AuthHelper;
using static Http;
using Npgsql;
using System.Text;
using System.Security.Cryptography;

static class AuthEndpoints
{
  static readonly string dummyHash = BCrypt.Net.BCrypt.HashPassword("dummy-password");
  public static void MapAuth(this WebApplication app)
  {
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
  
    // Idempotent: unknown or expired tokens also return 204.
    app.MapPost("/logout", async (HttpContext ctx, NpgsqlDataSource db) =>
    {
      var h = ctx.Request.Headers.Authorization.ToString();
      if (!h.StartsWith("Bearer ") || h.Length <= 7) return Err(401, "invalid token");
      await using var cmd = db.CreateCommand("DELETE FROM sessions WHERE token_hash = $1");
      cmd.Parameters.AddWithValue(Sha256Hex(h[7..]));
      await cmd.ExecuteNonQueryAsync();
      return Results.NoContent();
    });
  }
}