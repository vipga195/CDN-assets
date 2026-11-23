sealed class ImgOptions
{
  public const long MaxUploadBytes = 20 * 1024 * 1024;
  public const long MaxVideoBytes = 100 * 1024 * 1024; // Cloudflare free plan caps request bodies at 100 MB

  public string UploadDir { get; }
  public string VideoDir { get; }
  public string ProxyUrl { get; }
  public int SmallMaxSide { get; }
  public int SmallQuality { get; }
  public double SmallScale { get; }
  public int NormalQuality { get; }

  public ImgOptions(IConfiguration cfg)
  {
    UploadDir = cfg["UPLOAD_DIR"] ?? "/data/uploads";
    // Non-numeric subfolder: OrphanSweeper only walks all-digit user folders, so videos are never swept.
    VideoDir = cfg["VIDEO_DIR"] ?? Path.Combine(UploadDir, "videos");
    ProxyUrl = cfg["IMGPROXY_URL"]
      ?? throw new InvalidOperationException("missing IMGPROXY_URL");
    SmallMaxSide = cfg.GetValue("SMALL_MAX_SIDE", 512);
    SmallQuality = cfg.GetValue("SMALL_QUALITY", 60);
    SmallScale = cfg.GetValue("SMALL_SCALE", 0.75);
    NormalQuality = cfg.GetValue("NORMAL_QUALITY", 80);
  }
}