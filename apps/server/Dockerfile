FROM node:20-alpine AS build

WORKDIR /app

# Install only server deps
COPY package.json ./
RUN npm install

# Copy tsconfig and source
COPY tsconfig.json ./tsconfig.json
COPY src ./src

# Build to dist
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app

# Copy runtime files
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=8080
ENV WS_PATH=/ws
EXPOSE 8080

CMD ["node","dist/index.js"]
