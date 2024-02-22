# Stage 1: Build TypeScript
FROM node:14 AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Create a lightweight production image
FROM node:14-alpine

WORKDIR /app

# Copy built files from the previous stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --production

# Expose the desired port
EXPOSE 3000

# Start the application
CMD [ "node", "dist/app.js" ]