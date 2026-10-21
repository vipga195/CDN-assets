public readonly record struct ImgMeta(string Mime, string Ext, int W, int H);

public static class ImageInfo
{
    // Returns null when the bytes are not a valid PNG or JPEG.
    public static ImgMeta? Parse(byte[] b)
    {
        if (b.Length > 24 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
            && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A)
        {
            // PNG: IHDR chunk starts at byte 8; width/height are big-endian int32 at 16 and 20.
            int w = BeInt32(b, 16), h = BeInt32(b, 20);
            return w > 0 && h > 0 ? new ImgMeta("image/png", "png", w, h) : null;
        }

        if (b.Length > 4 && b[0] == 0xFF && b[1] == 0xD8)
        {
            // JPEG: walk the marker segments until a Start-Of-Frame (SOF) marker.
            int i = 2;
            while (i + 4 <= b.Length)
            {
                if (b[i] != 0xFF) { i++; continue; }
                byte m = b[i + 1];
                if (m == 0xFF) { i++; continue; }                          // fill byte
                if (m == 0x01 || (m >= 0xD0 && m <= 0xD8)) { i += 2; continue; } // no length field
                if (m == 0xD9) break;                                      // end of image
                int len = (b[i + 2] << 8) | b[i + 3];
                if (len < 2) return null;
                bool sof = m >= 0xC0 && m <= 0xCF && m != 0xC4 && m != 0xC8 && m != 0xCC;
                if (sof)
                {
                    if (i + 9 > b.Length) return null;
                    int h = (b[i + 5] << 8) | b[i + 6];
                    int w = (b[i + 7] << 8) | b[i + 8];
                    return w > 0 && h > 0 ? new ImgMeta("image/jpeg", "jpg", w, h) : null;
                }
                i += 2 + len;
            }
        }
        return null;
    }

    static int BeInt32(byte[] b, int o) =>
        (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
}
