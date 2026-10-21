sealed class ImgOptions
{
  public const long MaxUploadBytes = 20 * 1024 * 1024;

  public string UploadDir { get; }
  public string ProxyUrl { get; }
  public int SmallMaxSide { get; }
  public int SmallQuality { get; }
  public double SmallScale { get; }
  public int NormalQuality { get; }

  public ImgOptions(IConfiguration cfg)
  {
    UploadDir = cfg["UPLOAD_DIR"] ?? "/data/uploads";
    ProxyUrl = cfg["IMGPROXY_URL"]
      ?? throw new InvalidOperationException("missing IMGPROXY_URL");
    SmallMaxSide = cfg.GetValue("SMALL_MAX_SIDE", 512);
    SmallQuality = cfg.GetValue("SMALL_QUALITY", 60);
    SmallScale = cfg.GetValue("SMALL_SCALE", 0.75);
    NormalQuality = cfg.GetValue("NORMAL_QUALITY", 80);
  }
}