using System.Security.Cryptography;
using System.Text;

sealed class ImgproxySigner
{
  readonly byte[] key;
  readonly byte[] salt;

  public ImgproxySigner(IConfiguration cfg)
  {
    key = Convert.FromHexString(cfg["IMGPROXY_KEY"]
      ?? throw new InvalidOperationException("missing IMGPROXY_KEY"));
    salt = Convert.FromHexString(cfg["IMGPROXY_SALT"]
      ?? throw new InvalidOperationException("missing IMGPROXY_SALT"));
  }

  public string Sign(string path)
  {
    var msg = salt.Concat(Encoding.UTF8.GetBytes(path)).ToArray();
    return Convert.ToBase64String(HMACSHA256.HashData(key, msg))
      .TrimEnd('=').Replace('+', '-').Replace('/', '_');
  }
}