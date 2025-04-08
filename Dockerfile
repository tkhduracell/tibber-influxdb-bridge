# ---- Builder Stage ----
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Enable Corepack to use pnpm
RUN corepack enable

# Copy package manager files and tsconfig
# Copy pnpm-workspace.yaml as it's present in the project
COPY package.json pnpm-lock.yaml tsconfig.json pnpm-workspace.yaml ./

# Install all dependencies (including devDependencies needed for build)
# Use --frozen-lockfile for CI/CD reliability
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/ ./src/

# Build the TypeScript code
RUN pnpm run build

# Remove development dependencies after build
RUN pnpm prune --prod

# ---- Final Stage ----
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Create a non-root user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy necessary files from the builder stage
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Switch to the non-root user
USER nodejs

# Set environment variable for production
ENV NODE_ENV=production

# Command to run the application using the built JS file
CMD [ "node", "dist/app.js" ]
