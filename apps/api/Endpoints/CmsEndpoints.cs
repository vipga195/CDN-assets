using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Npgsql;
using NpgsqlTypes;
using static AuthHelper;
using static Http;

record FieldDto(string? Id, string? Name, string? Type, bool Required,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? RefTypeId);
record TypeBody(string? Id, string? Name, string? Description, string? DisplayFieldId, List<FieldDto>? Fields);

static class CmsEndpoints
{
  static readonly JsonSerializerOptions J = new(JsonSerializerDefaults.Web);
  static readonly Regex ApiId = new("^[a-zA-Z][a-zA-Z0-9_]{0,63}$", RegexOptions.Compiled);
  static readonly string[] FieldTypes = ["text", "longText", "number", "boolean", "date", "json", "media", "reference"];
  const string Cols = "api_id, name, description, display_field, fields::text, version, updated_at";

  public static void MapCms(this WebApplication app)
  {
    var g = app.MapGroup("/cms/content-types");

    g.MapGet("", async (HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (pid, _, err) = await Open(ctx, db);
      if (err is not null) return err;
      await using var cmd = db.CreateCommand($"SELECT {Cols} FROM content_types WHERE project_id = $1 ORDER BY name");
      cmd.Parameters.AddWithValue(pid);
      await using var r = await cmd.ExecuteReaderAsync();
      var list = new List<object>();
      while (await r.ReadAsync()) list.Add(Row(r));
      return Results.Json(list);
    });

    g.MapGet("/{id}", async (string id, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (pid, _, err) = await Open(ctx, db);
      if (err is not null) return err;
      await using var cmd = db.CreateCommand($"SELECT {Cols} FROM content_types WHERE project_id = $1 AND api_id = $2");
      cmd.Parameters.AddWithValue(pid);
      cmd.Parameters.AddWithValue(id);
      await using var r = await cmd.ExecuteReaderAsync();
      return await r.ReadAsync() ? Results.Json(Row(r)) : Err(404, "content type not found");
    });

    g.MapPost("", async (TypeBody b, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (pid, write, err) = await Open(ctx, db);
      if (err is not null) return err;
      if (!write) return Err(403, "read-only role");
      if (b.Id is null || !ApiId.IsMatch(b.Id)) return Err(400, "id must match ^[a-zA-Z][a-zA-Z0-9_]{0,63}$");
      if (Validate(b) is { } msg) return Err(400, msg);
      try
      {
        await using var cmd = db.CreateCommand(
            "INSERT INTO content_types (project_id, api_id, name, description, display_field, fields) " +
            $"VALUES ($1, $2, $3, $4, $5, $6) RETURNING {Cols}");
        Fill(cmd, pid, b.Id, b);
        await using var r = await cmd.ExecuteReaderAsync();
        await r.ReadAsync();
        return Results.Json(Row(r), statusCode: 201);
      }
      catch (PostgresException e) when (e.SqlState == "23505") { return Err(409, "id already exists"); }
    });

    g.MapPut("/{id}", async (string id, TypeBody b, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (pid, write, err) = await Open(ctx, db);
      if (err is not null) return err;
      if (!write) return Err(403, "read-only role");
      if (Validate(b) is { } msg) return Err(400, msg);
      await using var cmd = db.CreateCommand(
          "UPDATE content_types SET name = $3, description = $4, display_field = $5, fields = $6, " +
          $"version = version + 1, updated_at = now() WHERE project_id = $1 AND api_id = $2 RETURNING {Cols}");
      Fill(cmd, pid, id, b);
      await using var r = await cmd.ExecuteReaderAsync();
      return await r.ReadAsync() ? Results.Json(Row(r)) : Err(404, "content type not found");
    });

    g.MapDelete("/{id}", async (string id, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (pid, write, err) = await Open(ctx, db);
      if (err is not null) return err;
      if (!write) return Err(403, "read-only role");
      try
      {
        await using var cmd = db.CreateCommand("DELETE FROM content_types WHERE project_id = $1 AND api_id = $2");
        cmd.Parameters.AddWithValue(pid);
        cmd.Parameters.AddWithValue(id);
        return await cmd.ExecuteNonQueryAsync() == 0 ? Err(404, "content type not found") : Results.NoContent();
      }
      catch (PostgresException e) when (e.SqlState == "23503") { return Err(409, "delete its entries first"); }
    });
  }

  // First project of the user and whether their role may write.
  internal static async Task<(long pid, bool write)?> ScopeOf(NpgsqlDataSource db, long uid)
  {
    await using var cmd = db.CreateCommand(
        "SELECT project_id, role FROM project_members WHERE user_id = $1 ORDER BY created_at, project_id LIMIT 1");
    cmd.Parameters.AddWithValue(uid);
    await using var r = await cmd.ExecuteReaderAsync();
    if (!await r.ReadAsync()) return null;
    return (r.GetInt64(0), r.GetString(1) != "viewer");
  }

  static async Task<(long pid, bool write, IResult? err)> Open(HttpContext ctx, NpgsqlDataSource db)
  {
    var uid = await Auth(ctx, db);
    if (uid is null) return (0, false, Err(401, "invalid token"));
    return await ScopeOf(db, uid.Value) is { } s ? (s.pid, s.write, null) : (0, false, Err(403, "no project"));
  }

  // Parameters $1..$6 in the order shared by INSERT and UPDATE.
  static void Fill(NpgsqlCommand cmd, long pid, string apiId, TypeBody b)
  {
    cmd.Parameters.AddWithValue(pid);
    cmd.Parameters.AddWithValue(apiId);
    cmd.Parameters.AddWithValue(b.Name!.Trim());
    cmd.Parameters.AddWithValue(b.Description ?? "");
    cmd.Parameters.AddWithValue((object?)(string.IsNullOrEmpty(b.DisplayFieldId) ? null : b.DisplayFieldId) ?? DBNull.Value);
    cmd.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Jsonb, Value = JsonSerializer.Serialize(b.Fields ?? [], J) });
  }

  static string? Validate(TypeBody b)
  {
    if (b.Name is null || b.Name.Trim().Length is < 1 or > 100) return "name must be 1-100 chars";
    if ((b.Description ?? "").Length > 500) return "description max 500 chars";
    var fields = b.Fields ?? [];
    if (fields.Count > 50) return "max 50 fields";
    var seen = new HashSet<string>();
    foreach (var f in fields)
    {
      if (f.Id is null || !ApiId.IsMatch(f.Id)) return "invalid field id";
      if (!seen.Add(f.Id)) return $"duplicate field id {f.Id}";
      if (f.Name is null || f.Name.Trim().Length is < 1 or > 100) return $"field {f.Id}: name must be 1-100 chars";
      if (f.Type is null || !FieldTypes.Contains(f.Type)) return $"field {f.Id}: invalid type";
      if (f.RefTypeId is not null && (f.Type != "reference" || !ApiId.IsMatch(f.RefTypeId)))
        return $"field {f.Id}: invalid refTypeId";
    }
    if (fields.Count > 0 && (b.DisplayFieldId is null || !seen.Contains(b.DisplayFieldId)))
      return "displayFieldId must be a field id";
    return null;
  }

  static object Row(NpgsqlDataReader r) => new
  {
    id = r.GetString(0),
    name = r.GetString(1),
    description = r.GetString(2),
    displayFieldId = r.IsDBNull(3) ? "" : r.GetString(3),
    fields = JsonSerializer.Deserialize<JsonElement>(r.GetString(4)),
    version = r.GetInt32(5),
    updatedAt = r.GetDateTime(6),
  };
}