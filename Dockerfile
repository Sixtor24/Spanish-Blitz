FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build-time environment variables (Railway provides these)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build application
RUN pnpm run build

# Start application (PORT is provided by Railway)
CMD ["pnpm", "run", "start"]
