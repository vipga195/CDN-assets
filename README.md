# image-optimization-cdn

PoC học tập: dịch vụ CDN ảnh. User đăng ký, upload png/jpg (quota 50GB/user) và nhận lại ảnh đã chuyển sang
webp/avif theo trình duyệt; ảnh nhỏ bị giảm quality và scale mạnh hơn. Chạy local bằng Docker Compose.

## Công nghệ

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Proxy và cache | nginx 1.27 (`proxy_cache`) | cache ảnh cho `/i/`, cache key gồm định dạng (avif/webp/orig) |
| API | ASP.NET Core Minimal API (.NET 8), Npgsql, BCrypt.Net-Next | đăng ký, đăng nhập, upload, quota, ký URL imgproxy |
| Xử lý ảnh | imgproxy v3 (libvips) | resize + convert webp/avif, chỉ nhận URL có chữ ký |
| Cơ sở dữ liệu | PostgreSQL 16 | users, sessions, images; schema nhiều tenant (plans, accounts, projects, project_members, api_keys, image_aliases) |
| Đóng gói | Docker Compose | toàn bộ stack |

```
client -> nginx :8090 (cache theo avif/webp/orig) -> api (.NET 8) -> postgres
                                                        \-> imgproxy (ký URL) -> thư mục ảnh gốc (bind mount)
```

## Cấu trúc thư mục

```
apps/api/        ASP.NET Core API (.NET 8)
infra/nginx/     cấu hình nginx (cache + reverse proxy)
infra/db/        schema Postgres (init.sql) và migrations/ (002_roles_and_multitenant.sql)
scripts/         measure.sh (đo mức tiết kiệm dung lượng)
docker-compose.yml   .env.example
```

Ghi chú riêng của máy dev (đường dẫn, cổng, kết quả đo, dọn dữ liệu thử) nằm ở thư mục `personal/`, không commit.

## Yêu cầu

- Docker với Compose v2.
- Một thư mục trống trên máy để lưu ảnh gốc (bind mount; phải tồn tại trước vì `create_host_path: false`).

## Chạy

1. `cp .env.example .env`, điền `POSTGRES_PASSWORD`, `IMGPROXY_KEY`, `IMGPROXY_SALT` (`openssl rand -hex 32` cho hai giá trị sau).
2. Trong `docker-compose.yml`, đặt `source:` của hai bind mount (service `api` và `imgproxy`) tới thư mục lưu ảnh của bạn.
3. `docker compose up -d --build`
4. Kiểm tra: `curl localhost:8090/healthz` trả `ok`.

## Kiểm thử

```bash
dotnet test apps/api.Tests
```

Hiện mới có test cho `UserEvents`.

## API

| Route | Auth | Việc |
|---|---|---|
| `GET /healthz` | không | `ok` |
| `POST /register` | không | `{email, password}` (mật khẩu 8-72 byte) |
| `POST /login` | không | trả `{token}` (hạn 7 ngày, `Authorization: Bearer <token>`); 403 nếu tài khoản bị khoá |
| `GET /me` | có | `email`, `quota_bytes`, `used_bytes`, `role` |
| `POST /upload` | có | multipart field `file`; png/jpeg theo nội dung, tối đa 20MB và 50 megapixel; 413 khi vượt quota |
| `GET /images` | có | 100 ảnh mới nhất của user |
| `DELETE /images/{id}` | có | xoá ảnh, hoàn quota, xoá file |
| `GET /i/{id}?w=&fmt=` | không (biết UUID) | ảnh đã xử lý; `w` thuộc 64/128/256/512/1024/2048; `fmt` thuộc avif/webp/orig, mặc định theo `Accept` |
| `GET /admin/users` | admin | danh sách user: `id`, `email`, `role`, `disabled`, `quota_bytes`, `used_bytes`, `created_at` (401 không token, 403 không phải admin) |
| `PATCH /admin/users/{id}` | admin | `{"quota_bytes": n, "disabled": bool}` (một hoặc cả hai); 204, 404 nếu không có user, 400 nếu body sai hoặc tự khoá chính mình. Khoá user xoá hết session của họ |

API CMS (tenant = project đầu tiên của user; vai trò `viewer` chỉ đọc, `editor`/`admin` được ghi):

| Route | Việc |
|---|---|
| `GET /cms/content-types`, `GET /cms/content-types/{id}` | danh sách / chi tiết content type |
| `POST /cms/content-types` | tạo `{id, name, description, displayFieldId, fields[]}`; field type: text, longText, number, boolean, date, json, media, reference |
| `PUT /cms/content-types/{id}` | sửa; 409 nếu đổi `type` của field khi đã có entry |
| `DELETE /cms/content-types/{id}` | xoá; 409 nếu còn entry |
| `GET /cms/entries?type=&limit=&before_updated=&before_id=` | phân trang theo `(updated_at, id)` giảm dần, header `X-Total-Count` |
| `GET /cms/entries/{id}`, `DELETE /cms/entries/{id}` | chi tiết / xoá |
| `POST /cms/entries`, `PUT /cms/entries/{id}` | `{typeId, values, version}`; PUT khoá lạc quan theo `version` (409 khi lệch); key của field đã bị xoá khỏi content type sẽ bị bỏ khi lưu |
| `POST /cms/entries/{id}/publish`, `POST /cms/entries/{id}/unpublish` | publish chụp bản nháp vào `published_data` (kiểm tra field bắt buộc, `version` phải khớp); chưa có API đọc công khai |

Khi đăng ký, mỗi user được tạo kèm một account (gói `default`), một project `Default` và là `admin` của project đó. Upload và xoá ảnh cập nhật cả `users.used_bytes` lẫn `accounts.used_bytes`.

Ví dụ:

```bash
curl -s -X POST localhost:8090/register -H 'Content-Type: application/json' -d '{"email":"you@example.com","password":"<password>"}'
TOKEN=$(curl -s -X POST localhost:8090/login -H 'Content-Type: application/json' -d '{"email":"you@example.com","password":"<password>"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -s -X POST localhost:8090/upload -H "Authorization: Bearer $TOKEN" -F file=@photo.jpg
curl -s -D- -o /dev/null -H 'Accept: image/avif' "localhost:8090/i/<id>?w=512"   # X-Cache: MISS rồi HIT
```

### Tạo tài khoản admin đầu tiên

Không có API để tự đăng ký admin (cố ý, tránh leo quyền). Đăng ký bình thường, rồi nâng quyền bằng SQL:

```bash
docker compose exec -T postgres psql -U imgcdn -d imgcdn \
  -c "UPDATE users SET role='admin' WHERE email='you@example.com'"
```

## Quy tắc xử lý ảnh

- Không phóng to: chiều rộng ra = min(`w`, chiều rộng gốc).
- Ảnh nhỏ (cạnh dài <= `SMALL_MAX_SIDE`): scale `SMALL_SCALE`, quality `SMALL_QUALITY`; ảnh khác dùng `NORMAL_QUALITY`; avif thấp hơn 10.
- Giới hạn AVIF: ảnh đầu ra có cạnh dưới khoảng 16px (đo 2026-10-21: cạnh 15px ra JPEG, 18px ra AVIF; chưa thử 16 và 17px) thì imgproxy trả `image/jpeg` dù yêu cầu `fmt=avif` hoặc `Accept: image/avif`. Phản hồi vẫn `200` và `Content-Type` đúng với nội dung nên trình duyệt hiển thị bình thường; chưa tìm ra nguyên nhân bên trong imgproxy.
- Cấu hình (biến môi trường của `api`, có mặc định): `SMALL_MAX_SIDE=512`, `SMALL_QUALITY=60`, `SMALL_SCALE=0.75`, `NORMAL_QUALITY=80`.
- Header phản hồi: `X-Cache` (nginx), `X-Small-Image`, `Cache-Control: public, max-age=31536000, immutable`.

## Đo mức tiết kiệm

```bash
EMAIL=you@example.com PASSWORD='your-password' W=512 ./scripts/measure.sh anh1.jpg anh2.png
```

Script upload từng ảnh, tải bản gốc/webp/avif ở chiều rộng `W`, in bảng % giảm so với file upload, rồi xoá ảnh (quota về lại như trước). Mức giảm phụ thuộc ảnh: phần lớn đến từ thu nhỏ kích thước; riêng đổi định dạng cho thêm vài đến vài chục phần trăm với JPEG, và nhiều hơn với PNG ảnh chụp.

## Tính năng đã có

- Hạ tầng compose, SQL, nginx cache theo định dạng.
- Đăng ký, đăng nhập (token lưu dạng hash), `/me`.
- Upload + quota nguyên tử, lưu ảnh bằng bind mount.
- Giao ảnh qua imgproxy với URL ký, whitelist chiều rộng, quy tắc ảnh nhỏ.
- Xoá ảnh hoàn quota, script đo.
- Vai trò admin (`users.role`, `users.disabled`), `/admin/users`, khoá/mở user (bước B).
- Giao diện admin (`apps/admin`, Next.js, chạy container riêng qua nginx `/admin/`): đăng nhập bằng cookie httpOnly, thư viện ảnh (upload, copy link, xoá, quota), cập nhật quota/khoá user theo thời gian thực (SSE), trang Users cho admin (đổi quota, khoá/mở user) (bước C-F).
- Schema nhiều tenant (migration 002): gói > account > project > thành viên, API key, alias, ảnh nháp/xuất bản. API mới dùng account/project mặc định cho mỗi user; chưa có endpoint cho project, thành viên hay API key.
- CMS (migration 003): content type, entry nháp/publish, màn hình `/content-model` và `/content` trong admin. Migration 003 chạy bằng tay trên DB đã có dữ liệu, giống 002 (xem Lưu ý vận hành).

## Kế hoạch

- Giai đoạn 2: API project, thành viên, API key, ảnh nháp/xuất bản, upload hàng loạt (xem ADR `multi-tenant-projects-plans-api-keys` trong KB).

## Tồn đọng / giới hạn đã biết

- **Cache sau khi xoá**: biến thể đã cache vẫn được phục vụ đến khi hết hạn (nginx 7 ngày, trình duyệt 1 năm do `immutable`). Cần cơ chế purge theo URL khi lên production; PoC xoá thủ công bằng `docker compose up -d --force-recreate nginx`.
- **File mồ côi**: nếu tiến trình chết giữa lúc ghi file và commit DB (hoặc xoá file thất bại), file có thể còn thừa trên đĩa; chưa có job dọn.
- Đường dẫn thư mục ảnh đang đặt cứng trong `docker-compose.yml`; nên chuyển thành biến môi trường.
- Ảnh công khai nếu biết UUID; chưa có ảnh riêng tư.
- Chưa có: rate limit, HTTPS, xác thực email, đổi mật khẩu, thu hồi session, ảnh gif/svg/heic.
- Chưa có test tự động; kiểm thử hiện là script/curl thủ công.
- Admin: `NEXT_PUBLIC_CDN_URL` nhúng lúc build (mặc định `http://localhost:8090`); trang Users và thư viện ảnh chưa phân trang; chưa đổi role hay xoá user trong giao diện.
- Chưa đặt Cloudflare phía trước: cache key của Cloudflare phải tách theo định dạng (xem `infra/nginx/nginx.conf`, map `$img_fmt`).
- Lưu trữ cục bộ một máy; lên production nên dùng object storage (S3/R2), tách control plane (tài khoản, quota, billing) và data plane (giao ảnh).
- Bảng `images` / `used_bytes` sẽ lệch nếu xoá file hoặc volume bằng tay.
- Quota và dung lượng đang được lưu hai nơi (`users.quota_bytes`/`used_bytes` và `accounts.quota_override_bytes`/`used_bytes`); API vẫn kiểm quota theo `users`. Cần migration sau để bỏ cột cũ khi API đọc hoàn toàn từ `accounts`.
- `images.project_id` là `NOT NULL`: user tạo trực tiếp bằng SQL (không qua `/register`) phải có sẵn account và project, nếu không upload trả 500.

## Lưu ý vận hành

- `infra/db/init.sql` và `infra/db/migrations/*.sql` (mount vào `docker-entrypoint-initdb.d`) chỉ chạy khi volume `pgdata` còn trống.
- Nâng cấp database đã có dữ liệu: sao lưu rồi chạy migration bằng tay. Migration nằm trong một transaction và chỉ chạy được một lần (chạy lại báo `relation "plans" already exists` và rollback). Sau đó build lại API.

  ```bash
  docker compose exec -T postgres pg_dump -U imgcdn imgcdn > backup.sql
  docker compose exec -T postgres psql -U imgcdn -d imgcdn -v ON_ERROR_STOP=1 \
    < infra/db/migrations/002_roles_and_multitenant.sql
  docker compose up -d --build api
  ```
- `docker compose down -v` xoá dữ liệu Postgres (ảnh nằm ở thư mục bind mount, không bị xoá).
- `appsettings.json` đặt `Microsoft.AspNetCore: Warning` nên không có log từng request; đổi sang `Information` khi cần debug.
