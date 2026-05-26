FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/yarn.lock* ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
RUN yarn build

FROM alpine:3.18
ARG PB_VERSION=0.38.1
ARG TARGETARCH
RUN apk add --no-cache unzip ca-certificates
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb && rm /tmp/pb.zip
WORKDIR /pb

COPY backend/pb_migrations/ ./pb_migrations
COPY backend/pb_hooks/ ./pb_hooks

COPY --from=frontend-builder /build/dist ./pb_public

EXPOSE 8090

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]