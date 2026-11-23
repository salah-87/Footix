# --- Footix API image ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies first: this layer is cached until package*.json changes
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public

# Never run as root inside the container
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "src/server.js"]
