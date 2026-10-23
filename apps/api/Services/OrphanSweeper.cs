using Npgsql;
using NpgsqlTypes;

// Finds (and optionally deletes) upload files that have no row in `images`: left behind by a crash
// between writing the file and the DB commit, or by a failed delete after commit.
// Layout: {UploadDir}/{userId}/{imageId}.{ext}. Uploads write the final name directly (no temp file),
// so the minimum-age check is the only protection for in-flight uploads.
sealed class OrphanSweeper : BackgroundService
{
  const int BatchSize = 200;
  static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);

  readonly NpgsqlDataSource db;
  readonly ImgOptions opt;
  readonly ILogger<OrphanSweeper> log;
  readonly TimeSpan interval;
  readonly TimeSpan minAge;
  readonly bool delete;

  public OrphanSweeper(NpgsqlDataSource db, ImgOptions opt, IConfiguration cfg, ILogger<OrphanSweeper> log)
  {
    this.db = db;
    this.opt = opt;
    this.log = log;
    interval = TimeSpan.FromHours(Math.Max(cfg.GetValue("ORPHAN_SWEEP_INTERVAL_HOURS", 6.0), 0.01));
    minAge = TimeSpan.FromHours(Math.Max(cfg.GetValue("ORPHAN_MIN_AGE_HOURS", 24.0), 0));
    delete = cfg.GetValue("ORPHAN_SWEEP_DELETE", false);
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    try
    {
      await Task.Delay(StartupDelay, stoppingToken);
      while (!stoppingToken.IsCancellationRequested)
      {
        try { await SweepAsync(stoppingToken); }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        catch (Exception e) { log.LogError(e, "orphan sweep failed"); }
        await Task.Delay(interval, stoppingToken);
      }
    }
    catch (OperationCanceledException) { /* shutting down */ }
  }

  async Task SweepAsync(CancellationToken ct)
  {
    var root = opt.UploadDir;
    if (!Directory.Exists(root)) { log.LogWarning("orphan sweep: upload dir {Dir} not found", root); return; }

    long scanned = 0, orphans = 0, bytes = 0, deleted = 0;
    var batch = new List<(Guid Id, string Path)>(BatchSize);

    async Task FlushAsync()
    {
      if (batch.Count == 0) return;
      // A throw here propagates to the loop: nothing is deleted when the DB cannot be queried.
      var known = await ExistingIdsAsync(batch.Select(b => b.Id).ToArray(), ct);
      foreach (var (id, path) in batch)
      {
        if (known.Contains(id)) continue;
        try
        {
          var fi = new FileInfo(path);
          // Re-check right before acting: the file may be gone, replaced or too fresh by now.
          if (!fi.Exists || fi.LinkTarget is not null || !IsOld(fi)) continue;
          var size = fi.Length;
          orphans++;
          bytes += size;
          if (!delete)
          {
            log.LogInformation("orphan sweep (dry run): would delete {Path} ({Size} bytes)", path, size);
            continue;
          }
          fi.Delete();
          deleted++;
          log.LogInformation("orphan sweep: deleted {Path} ({Size} bytes)", path, size);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
          log.LogWarning(e, "orphan sweep: could not process {Path}", path);
        }
      }
      batch.Clear();
    }

    foreach (var userDir in Directory.EnumerateDirectories(root))
    {
      ct.ThrowIfCancellationRequested();
      var dirName = Path.GetFileName(userDir);
      if (dirName.Length == 0 || !dirName.All(char.IsAsciiDigit)) continue;
      if (new DirectoryInfo(userDir).LinkTarget is not null) continue; // never follow symlinked dirs

      foreach (var file in Directory.EnumerateFiles(userDir))
      {
        ct.ThrowIfCancellationRequested();
        if (!Guid.TryParse(Path.GetFileNameWithoutExtension(file), out var id)) continue;
        var fi = new FileInfo(file);
        if (fi.LinkTarget is not null || !IsOld(fi)) continue;

        scanned++;
        batch.Add((id, file));
        if (batch.Count >= BatchSize) await FlushAsync();
      }
    }
    await FlushAsync();

    log.LogInformation(
      "orphan sweep done: scanned={Scanned} orphans={Orphans} bytes={Bytes} deleted={Deleted} mode={Mode}",
      scanned, orphans, bytes, deleted, delete ? "delete" : "dry-run");
  }

  bool IsOld(FileInfo fi) => DateTime.UtcNow - fi.LastWriteTimeUtc > minAge;

  async Task<HashSet<Guid>> ExistingIdsAsync(Guid[] ids, CancellationToken ct)
  {
    await using var cmd = db.CreateCommand("SELECT id FROM images WHERE id = ANY($1)");
    cmd.Parameters.Add(new NpgsqlParameter { Value = ids, NpgsqlDbType = NpgsqlDbType.Array | NpgsqlDbType.Uuid });
    var set = new HashSet<Guid>();
    await using var r = await cmd.ExecuteReaderAsync(ct);
    while (await r.ReadAsync(ct)) set.Add(r.GetGuid(0));
    return set;
  }
}
