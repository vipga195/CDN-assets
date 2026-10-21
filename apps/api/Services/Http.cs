
static class Http
{
  public static IResult Err(int code, string msg) => Results.Json(new { error = msg }, statusCode: code);
}