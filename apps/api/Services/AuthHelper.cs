using System.Security.Cryptography;
using System.Text;
using Npgsql;
using static Http;

static class AuthHelper
{
  public static string Sha256Hex(string s) =>
    Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();

  // Resolves "Authorization: Bearer <token>" to a user id, or null if missing/invalid/expired.
  public static async Task<long?> Auth(HttpContext ctx, NpgsqlDataSource db)
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
  public static async Task<(long? uid, IResult? err)> RequireAdmin(HttpContext ctx, NpgsqlDataSource db)
  {
    var uid = await Auth(ctx, db);
    if (uid is null) return (null, Err(401, "invalid token"));
    await using var cmd = db.CreateCommand("SELECT role FROM users WHERE id = $1");
    cmd.Parameters.AddWithValue(uid.Value);
    return (await cmd.ExecuteScalarAsync() as string) == "admin"
        ? (uid, null)
        : (null, Err(403, "admin only"));
  }
}

