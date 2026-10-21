FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
# Upload dir is created now so the named volume inherits the non-root owner (used in step 3).
RUN mkdir -p /data/uploads && chown app /data/uploads
COPY --from=build /out .
USER app
ENTRYPOINT ["dotnet", "ImgApi.dll"]
