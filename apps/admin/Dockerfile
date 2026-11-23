FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_CDN_URL
ENV NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_LOGO_ID
ENV NEXT_PUBLIC_LOGO_ID=$NEXT_PUBLIC_LOGO_ID
ARG NEXT_PUBLIC_OG_IMAGE_ID
ENV NEXT_PUBLIC_OG_IMAGE_ID=$NEXT_PUBLIC_OG_IMAGE_ID
ARG SITE_URL
ENV SITE_URL=$SITE_URL
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]