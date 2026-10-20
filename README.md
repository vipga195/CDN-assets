# image-optimization-cdn

PoC học tập: dịch vụ CDN ảnh. User đăng ký, upload png/jpg (quota 50GB/user) và nhận lại ảnh đã chuyển sang
webp/avif theo trình duyệt; ảnh nhỏ bị giảm quality và scale mạnh hơn. Chạy local bằng Docker Compose.

```
client -> nginx :8090 (cache theo avif/webp/orig) -> api (.NET 8) -> postgres
                                                        \-> imgproxy (ký URL) -> thư mục ảnh gốc (HDD)
```

| Service | Công nghệ | Vai trò |
|---|---|---|
| nginx | 1.27 | reverse proxy + `proxy_cache` cho `/i/`, cache key gồm định dạng |
| api | ASP.NET Core Minimal API (.NET 8), Npgsql, BCrypt | đăng ký, đăng nhập, upload, quota, ký URL imgproxy |
| imgproxy | v3 (libvips) | resize + convert webp/avif |
| postgres | 16 | users, sessions, images |

## Chạy

1. `cp .env.example .env`, điền `POSTGRES_PASSWORD`, `IMGPROXY_KEY`, `IMGPROXY_SALT` (`openssl rand -hex 32`).
2. Sửa `source:` của hai bind mount trong `docker-compose.yml` (hiện là `/Volumes/Media 1/imgcdn-uploads`, đường dẫn riêng của máy dev; thư mục phải tồn tại vì `create_host_path: false`).
3. `docker compose up -d --build`
4. Kiểm tra: `curl localhost:8090/healthz` trả `ok`. Cổng `8090` (cổng 8080 của máy dev đang bị app khác chiếm).

## API

| Route | Auth | Việc |
|---|---|---|
| `GET /healthz` | không | `ok` |
| `POST /register` | không | `{email, password}` (mật khẩu 8-72 byte) |
| `POST /login` | không | trả `{token}` (hạn 7 ngày, `Authorization: Bearer <token>`) |
| `GET /me` | có | `email`, `quota_bytes`, `used_bytes` |
| `POST /upload` | có | multipart field `file`; png/jpeg theo nội dung, tối đa 20MB và 50 megapixel; 413 khi vượt quota |
| `GET /images` | có | 100 ảnh mới nhất của user |
| `DELETE /images/{id}` | có | xoá ảnh, hoàn quota, xoá file |
| `GET /i/{id}?w=&fmt=` | không (biết UUID) | ảnh đã xử lý; `w` thuộc 64/128/256/512/1024/2048; `fmt` thuộc avif/webp/orig, mặc định theo `Accept` |

Ví dụ:

```bash
curl -s -X POST localhost:8090/register -H 'Content-Type: application/json' -d '{"email":"a@x.com","password":"12345678"}'
TOKEN=$(curl -s -X POST localhost:8090/login -H 'Content-Type: application/json' -d '{"email":"a@x.com","password":"12345678"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -s -X POST localhost:8090/upload -H "Authorization: Bearer $TOKEN" -F file=@photo.jpg
curl -s -D- -o /dev/null -H 'Accept: image/avif' "localhost:8090/i/<id>?w=512"   # X-Cache: MISS rồi HIT
```

## Quy tắc xử lý ảnh

- Không phóng to: chiều rộng ra = min(`w`, chiều rộng gốc).
- Ảnh nhỏ (cạnh dài <= `SMALL_MAX_SIDE`): scale `SMALL_SCALE`, quality `SMALL_QUALITY`; ảnh khác dùng `NORMAL_QUALITY`; avif thấp hơn 10.
- Cấu hình (biến môi trường của `api`, có mặc định): `SMALL_MAX_SIDE=512`, `SMALL_QUALITY=60`, `SMALL_SCALE=0.75`, `NORMAL_QUALITY=80`.
- Header phản hồi: `X-Cache` (nginx), `X-Small-Image`, `Cache-Control: public, max-age=31536000, immutable`.

## Đo mức tiết kiệm

```bash
EMAIL=a@x.com PASSWORD=12345678 W=512 ./scripts/measure.sh anh1.jpg anh2.png
```

Script upload từng ảnh, tải bản gốc/webp/avif ở chiều rộng `W`, in bảng % giảm so với file upload, rồi xoá ảnh (quota về lại như trước). Kết quả đã đo (2026-10-20, `W=512`, ảnh hình nền hệ thống):

| Ảnh | Gốc (byte) | webp | avif |
|---|---:|---:|---:|
| jpg 2400px | 880.601 | giảm 95,9% | giảm 96,1% |
| jpg 600px | 74.698 | giảm 56,6% | giảm 58,0% |
| png 1200px | 1.473.752 | giảm 97,3% | giảm 97,5% |
| png 300px (ảnh nhỏ) | 96.159 | giảm 94,6% | giảm 96,0% |

Phần lớn mức giảm đến từ thu nhỏ kích thước; riêng đổi định dạng JPEG sang webp/avif cho thêm khoảng 8-20%, PNG ảnh chụp sang webp/avif giảm khoảng 88%.

## Đã làm

- Hạ tầng compose, SQL, nginx cache theo định dạng.
- Đăng ký, đăng nhập (token lưu hash), `/me`.
- Upload + quota nguyên tử, ảnh lưu trên HDD ngoài bằng bind mount.
- Giao ảnh qua imgproxy với URL ký, whitelist chiều rộng, quy tắc ảnh nhỏ.
- Xoá ảnh hoàn quota, script đo.

## Tồn đọng / giới hạn đã biết

- **Cache sau khi xoá**: biến thể đã cache vẫn được phục vụ đến khi hết hạn (nginx 7 ngày, trình duyệt 1 năm do `immutable`). Cần cơ chế purge theo URL khi lên production; PoC xoá thủ công bằng `docker compose up -d --force-recreate nginx`.
- **File mồ côi**: nếu tiến trình chết giữa lúc ghi file và commit DB (hoặc xoá file thất bại), file có thể còn thừa trên đĩa; chưa có job dọn.
- **Đường dẫn HDD cố định** trong `docker-compose.yml`; nên chuyển thành biến môi trường.
- Ảnh công khai nếu biết UUID; chưa có ảnh riêng tư.
- Chưa có: rate limit, HTTPS, xác thực email, đổi mật khẩu, thu hồi session, giao diện web, ảnh gif/svg/heic.
- Chưa có test tự động; kiểm thử hiện là script/curl thủ công.
- Chưa đặt Cloudflare phía trước: cache key của Cloudflare phải tách theo định dạng (xem `nginx/nginx.conf`, map `$img_fmt`).
- Lưu trữ cục bộ một máy; lên production nên dùng object storage (S3/R2), tách control plane (tài khoản, quota, billing) và data plane (giao ảnh).
- Bảng `images` / `used_bytes` sẽ lệch nếu xoá file hoặc volume bằng tay.

## Lưu ý vận hành

- `db/init.sql` chỉ chạy khi volume `pgdata` còn trống.
- `docker compose down -v` xoá dữ liệu Postgres (ảnh nằm trên HDD, không bị xoá).
- `appsettings.json` đặt `Microsoft.AspNetCore: Warning` nên không có log từng request; đổi sang `Information` khi cần debug.
