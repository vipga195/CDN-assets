public readonly record struct VideoMeta(string Mime, string Ext, int W, int H);

public static class VideoInfo
{
    const long MaxMoov = 16 * 1024 * 1024;

    // Returns null when the stream is not an MP4 with a video track.
    public static VideoMeta? Parse(Stream s)
    {
        try
        {
            long len = s.Length;
            var h = new byte[16];
            s.Position = 0;
            s.ReadExactly(h, 0, 8);
            if (!Is(h, 4, "ftyp")) return null;

            // Walk top-level boxes by header only, seeking past payloads, to find moov.
            long pos = 0;
            while (pos + 8 <= len)
            {
                s.Position = pos;
                s.ReadExactly(h, 0, 8);
                long size = BeU32(h, 0), hs = 8;
                if (size == 1)
                {
                    if (pos + 16 > len) return null;
                    s.ReadExactly(h, 8, 8);
                    size = (long)(((ulong)BeU32(h, 8) << 32) | BeU32(h, 12));
                    hs = 16;
                }
                else if (size == 0) size = len - pos;
                if (size < hs || pos + size > len) return null;

                if (Is(h, 4, "moov"))
                {
                    long n = size - hs;
                    if (n > MaxMoov) return null;
                    var buf = new byte[n];
                    s.Position = pos + hs;
                    s.ReadExactly(buf, 0, (int)n);
                    return FromMoov(buf);
                }
                pos += size;
            }
        }
        catch (Exception e) when (e is IOException or ArgumentException) { }
        return null;
    }

    static VideoMeta? FromMoov(byte[] m)
    {
        long pos = 0;
        while (Next(m, ref pos, m.Length, "trak", out long ts, out long te))
        {
            long q = ts;
            if (!Next(m, ref q, te, "tkhd", out long ps, out long pe)) continue;
            // tkhd: width/height are 16.16 fixed-point, offsets depend on the version byte.
            if (ps >= pe) continue;
            long o = m[ps] == 1 ? 88 : 76;
            if (ps + o + 8 > pe) continue;
            int w = (int)(BeU32(m, ps + o) >> 16), h = (int)(BeU32(m, ps + o + 4) >> 16);
            if (w > 0 && h > 0) return new VideoMeta("video/mp4", "mp4", w, h);
        }
        return null;
    }

    // Finds the next child box of the given type in b[pos..end); pos moves past it.
    static bool Next(byte[] b, ref long pos, long end, string type, out long ps, out long pe)
    {
        ps = pe = 0;
        while (pos + 8 <= end)
        {
            long size = BeU32(b, pos), hs = 8;
            if (size == 1)
            {
                if (pos + 16 > end) return false;
                size = (long)(((ulong)BeU32(b, pos + 8) << 32) | BeU32(b, pos + 12));
                hs = 16;
            }
            else if (size == 0) size = end - pos;
            if (size < hs || pos + size > end) return false;

            long start = pos;
            pos += size;
            if (Is(b, start + 4, type)) { ps = start + hs; pe = start + size; return true; }
        }
        return false;
    }

    static bool Is(byte[] b, long o, string t) =>
        b[o] == t[0] && b[o + 1] == t[1] && b[o + 2] == t[2] && b[o + 3] == t[3];

    static uint BeU32(byte[] b, long o) =>
        ((uint)b[o] << 24) | ((uint)b[o + 1] << 16) | ((uint)b[o + 2] << 8) | b[o + 3];
}
