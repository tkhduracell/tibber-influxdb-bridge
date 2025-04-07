FROM node:22-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml tsconfig.json ./

# Install dependencies and build tools
RUN npm install -g pnpm && \
    pnpm i && \
    # Install global tsx for production
    npm install -g tsx

# Copy source files
COPY src/ ./src/

# Build the TypeScript code
RUN pnpm build

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["pnpm", "start"]