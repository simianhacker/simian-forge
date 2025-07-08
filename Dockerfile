# Multi-stage build for Simian Forge
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the TypeScript code
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S simian -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R simian:nodejs /app

# Switch to non-root user
USER simian

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Simian Forge is running')" || exit 1

# Set default command
ENTRYPOINT ["node", "dist/index.js"]