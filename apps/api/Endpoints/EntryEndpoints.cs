using System.Globalization;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using static AuthHelper;
using static CmsEndpoints;
using static Http;

record EntryBody(string? TypeId, JsonElement Values, int? Version);
record PublishBody(int? Version);

static class EntryEndpoints
{
  static readonly JsonSerializerOptions J = new(JsonSerializerDefaults.Web);
  const string Sel = "e.id, t.api_id, e.data::text, e.version, e.updated_at, e.published_at";
  const string From = "FROM entries e JOIN content_types t ON t.id = e.content_type_id";

  public static void MapEntries(this WebApplication app)
  {
    var g = app.MapGroup("/cms/entries");

    g.MapGet("", async (string? type, int? limit, string? before_updated, Guid? before_id, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (_, pid, _, err) = await OpenU(ctx, db);
      if (err is not null) return err;
      if ((before_updated is null) != (before_id is null)) return Err(400, "before_updated and before_id go together");
      DateTime cursor = default;
      if (before_updated is not null && !DateTime.TryParse(before_updated, CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out cursor))
        return Err(400, "invalid before_updated");

      await using var cnt = db.CreateCommand();
      cnt.CommandText = $"SELECT count(*) {From} WHERE {Filter(cnt, pid, type)}";
      ctx.Response.Headers["X-Total-Count"] = ((long)(await cnt.ExecuteScalarAsync())!).ToString();

      await using var cmd = db.CreateCommand();
      var where = Filter(cmd, pid, type);
      if (before_id is not null)
      {
        cmd.Parameters.AddWithValue(NpgsqlDbType.TimestampTz, cursor);
        cmd.Parameters.AddWithValue(before_id.Value);
        where += $" AND (e.updated_at, e.id) < (${cmd.Parameters.Count - 1}, ${cmd.Parameters.Count})";
      }
      cmd.Parameters.AddWithValue(Math.Clamp(limit ?? 50, 1, 100));
      cmd.CommandText = $"SELECT {Sel} {From} WHERE {where} ORDER BY e.updated_at DESC, e.id DESC LIMIT ${cmd.Parameters.Count}";
      await using var r = await cmd.ExecuteReaderAsync();
      var list = new List<object>();
      while (await r.ReadAsync()) list.Add(Row(r));
      return Results.Json(list);
    });

    g.MapGet("/{id:guid}", async (Guid id, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (_, pid, _, err) = await OpenU(ctx, db);
      if (err is not null) return err;
      await using var cmd = db.CreateCommand($"SELECT {Sel} {From} WHERE e.project_id = $1 AND e.id = $2");
      cmd.Parameters.AddWithValue(pid);
      cmd.Parameters.AddWithValue(id);
      await using var r = await cmd.ExecuteReaderAsync();
      return await r.ReadAsync() ? Results.Json(Row(r)) : Err(404, "entry not found");
    });

    g.MapPost("", async (EntryBody b, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (uid, pid, write, err) = await OpenU(ctx, db);
      if (err is not null) return err;
      if (!write) return Err(403, "read-only role");
      if (b.TypeId is null) return Err(400, "typeId required");
      if (b.Values.ValueKind != JsonValueKind.Object) return Err(400, "values must be an object");

      await using var tcmd = db.CreateCommand("SELECT id, fields::text FROM content_types WHERE project_id = $1 AND api_id = $2");
      tcmd.Parameters.AddWithValue(pid);
      tcmd.Parameters.AddWithValue(b.TypeId);
      long typeId; string fields;
      await using (var tr = await tcmd.ExecuteReaderAsync())
      {
        if (!await tr.ReadAsync()) return Err(400, "unknown typeId");
        typeId = tr.GetInt64(0); fields = tr.GetString(1);
      }
      if (await CheckValues(b.Values, fields, pid, db) is { } msg) return Err(400, msg);

      await using var cmd = db.CreateCommand(
          "WITH e AS (INSERT INTO entries (project_id, content_type_id, data, created_by, updated_by) " +
          $"VALUES ($1, $2, $3, $4, $4) RETURNING *) SELECT {Sel} FROM e JOIN content_types t ON t.id = e.content_type_id");
      cmd.Parameters.AddWithValue(pid);
      cmd.Parameters.AddWithValue(typeId);
      cmd.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Jsonb, Value = b.Values.GetRawText() });
      cmd.Parameters.AddWithValue(uid);
      await using var r = await cmd.ExecuteReaderAsync();
      await r.ReadAsync();
      return Results.Json(Row(r), statusCode: 201);
    });

    g.MapPut("/{id:guid}", async (Guid id, EntryBody b, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (uid, pid, write, err) = await OpenU(ctx, db);
      if (err is not null) return err;
      if (!write) return Err(403, "read-only role");
      if (b.Version is null) return Err(400, "version required");
      if (b.Values.ValueKind != JsonValueKind.Object) return Err(400, "values must be an object");

      await using var fcmd = db.CreateCommand($"SELECT t.fields::text {From} WHERE e.id = $1 AND e.project_id = $2");
      fcmd.Parameters.AddWithValue(id);
      fcmd.Parameters.AddWithValue(pid);
      if (await fcmd.ExecuteScalarAsync() is not string fields) return Err(404, "entry not found");
      if (await CheckValues(b.Values, fields, pid, db) is { } msg) return Err(400, msg);

      await using var cmd = db.CreateCommand(
          "WITH e AS (UPDATE entries SET data = $3, version = version + 1, updated_at = now(), updated_by = $4 " +
          $"WHERE id = $1 AND project_id = $2 AND version = $5 RETURNING *) SELECT {Sel} FROM e JOIN content_types t ON t.id = e.content_type_id");
      cmd.Parameters.AddWithValue(id);
      cmd.Parameters.AddWithValue(pid);
      cmd.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Jsonb, Value = b.Values.GetRawText() });
      cmd.Parameters.AddWithValue(uid);
      cmd.Parameters.AddWithValue(b.Version.Value);
      await using var r = await cmd.ExecuteReaderAsync();
      return await r.ReadAsync() ? Results.Json(Row(r)) : Err(409, "version conflict, reload the entry");
    });

    g.MapDelete("/{id:guid}", async (Guid id, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (_, pid, write, err) = await OpenU(ctx, db);
      if (err is not null) return err;
      if (!write) return Err(403, "read-only role");
      await using var cmd = db.CreateCommand("DELETE FROM entries WHERE id = $1 AND project_id = $2");
      cmd.Parameters.AddWithValue(id);
      cmd.Parameters.AddWithValue(pid);
      return await cmd.ExecuteNonQueryAsync() == 0 ? Err(404, "entry not found") : Results.NoContent();
    });

    g.MapPost("/{id:guid}/publish", async (Guid id, PublishBody b, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (_, pid, write, err) = await OpenU(ctx, db);
      if (err is not null) return err;
      if (!write) return Err(403, "read-only role");
      if (b.Version is null) return Err(400, "version required");

      await using var lcmd = db.CreateCommand(
          $"SELECT e.data::text, t.fields::text, e.version {From} WHERE e.id = $1 AND e.project_id = $2");
      lcmd.Parameters.AddWithValue(id);
      lcmd.Parameters.AddWithValue(pid);
      string data, fields; int version;
      await using (var lr = await lcmd.ExecuteReaderAsync())
      {
        if (!await lr.ReadAsync()) return Err(404, "entry not found");
        data = lr.GetString(0); fields = lr.GetString(1); version = lr.GetInt32(2);
      }
      if (version != b.Version) return Err(409, "version conflict, reload the entry");

      var values = JsonSerializer.Deserialize<JsonElement>(data);
      if (await CheckValues(values, fields, pid, db) is { } msg) return Err(400, msg);
      var missing = MissingRequired(values, fields);
      if (missing.Count > 0) return Err(400, "required fields missing: " + string.Join(", ", missing));

      await using var cmd = db.CreateCommand(
          "WITH e AS (UPDATE entries SET published_data = data, published_at = updated_at " +
          "WHERE id = $1 AND project_id = $2 AND version = $3 RETURNING *) " +
          $"SELECT {Sel} FROM e JOIN content_types t ON t.id = e.content_type_id");
      cmd.Parameters.AddWithValue(id);
      cmd.Parameters.AddWithValue(pid);
      cmd.Parameters.AddWithValue(version);
      await using var r = await cmd.ExecuteReaderAsync();
      return await r.ReadAsync() ? Results.Json(Row(r)) : Err(409, "version conflict, reload the entry");
    });

    g.MapPost("/{id:guid}/unpublish", async (Guid id, HttpContext ctx, NpgsqlDataSource db) =>
    {
      var (_, pid, write, err) = await OpenU(ctx, db);
      if (err is not null) return err;
      if (!write) return Err(403, "read-only role");
      await using var cmd = db.CreateCommand(
          "WITH e AS (UPDATE entries SET published_data = NULL, published_at = NULL " +
          "WHERE id = $1 AND project_id = $2 RETURNING *) " +
          $"SELECT {Sel} FROM e JOIN content_types t ON t.id = e.content_type_id");
      cmd.Parameters.AddWithValue(id);
      cmd.Parameters.AddWithValue(pid);
      await using var r = await cmd.ExecuteReaderAsync();
      return await r.ReadAsync() ? Results.Json(Row(r)) : Err(404, "entry not found");
    });
  }

  static async Task<(long uid, long pid, bool write, IResult? err)> OpenU(HttpContext ctx, NpgsqlDataSource db)
  {
    var uid = await Auth(ctx, db);
    if (uid is null) return (0, 0, false, Err(401, "invalid token"));
    if (await ScopeOf(db, uid.Value) is not { } s) return (0, 0, false, Err(403, "no project"));
    return (uid.Value, s.pid, s.write, null);
  }

  // $1 = project, optional $2 = type api_id; returns the WHERE fragment.
  static string Filter(NpgsqlCommand c, long pid, string? type)
  {
    c.Parameters.AddWithValue(pid);
    var w = "e.project_id = $1";
    if (type is not null)
    {
      c.Parameters.AddWithValue(type);
      w += $" AND t.api_id = ${c.Parameters.Count}";
    }
    return w;
  }

  // Required fields that are absent, null or blank in the draft.
  static List<string> MissingRequired(JsonElement data, string fieldsJson)
  {
    var missing = new List<string>();
    foreach (var f in JsonSerializer.Deserialize<List<FieldDto>>(fieldsJson, J) ?? [])
    {
      if (!f.Required) continue;
      var empty = !data.TryGetProperty(f.Id!, out var v)
          || v.ValueKind == JsonValueKind.Null
          || (v.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(v.GetString()));
      if (empty) missing.Add(f.Id!);
    }
    return missing;
  }

  // Returns an error message, or null when every provided value fits its field. Required is checked at publish.
  static async Task<string?> CheckValues(JsonElement values, string fieldsJson, long pid, NpgsqlDataSource db)
  {
    var map = (JsonSerializer.Deserialize<List<FieldDto>>(fieldsJson, J) ?? []).ToDictionary(f => f.Id!);
    foreach (var p in values.EnumerateObject())
    {
      if (!map.TryGetValue(p.Name, out var f)) return $"unknown field {p.Name}";
      var v = p.Value;
      if (v.ValueKind == JsonValueKind.Null) continue;
      var bad = f.Type switch
      {
        "text" => v.ValueKind != JsonValueKind.String || v.GetString()!.Length > 2000,
        "longText" => v.ValueKind != JsonValueKind.String || v.GetString()!.Length > 100_000,
        "number" => v.ValueKind != JsonValueKind.Number,
        "boolean" => v.ValueKind is not (JsonValueKind.True or JsonValueKind.False),
        "date" => v.ValueKind != JsonValueKind.String ||
                  !DateTimeOffset.TryParse(v.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out _),
        "json" => false,
        _ => v.ValueKind != JsonValueKind.String || !Guid.TryParse(v.GetString(), out _), // media, reference
      };
      if (bad) return $"field {p.Name}: invalid {f.Type} value";

      if (f.Type == "media" && !await Exists(db, "SELECT 1 FROM images WHERE id = $1 AND project_id = $2",
            Guid.Parse(v.GetString()!), pid))
        return $"field {p.Name}: image not found";
      if (f.Type == "reference")
      {
        var sql = $"SELECT 1 {From} WHERE e.id = $1 AND e.project_id = $2" + (f.RefTypeId is null ? "" : " AND t.api_id = $3");
        object[] args = f.RefTypeId is null ? [Guid.Parse(v.GetString()!), pid] : [Guid.Parse(v.GetString()!), pid, f.RefTypeId];
        if (!await Exists(db, sql, args)) return $"field {p.Name}: referenced entry not found";
      }
    }
    return null;
  }

  static async Task<bool> Exists(NpgsqlDataSource db, string sql, params object[] args)
  {
    await using var cmd = db.CreateCommand(sql);
    foreach (var a in args) cmd.Parameters.AddWithValue(a);
    return await cmd.ExecuteScalarAsync() is not null;
  }

  static object Row(NpgsqlDataReader r) => new
  {
    id = r.GetGuid(0),
    typeId = r.GetString(1),
    values = JsonSerializer.Deserialize<JsonElement>(r.GetString(2)),
    version = r.GetInt32(3),
    updatedAt = r.GetDateTime(4),
    publishedAt = r.IsDBNull(5) ? (DateTime?)null : r.GetDateTime(5),
  };
}