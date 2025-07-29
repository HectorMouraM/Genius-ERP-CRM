# 1. Base Image: Use a lightweight Node.js image
FROM node:20-alpine AS base

# 2. Set Working Directory
WORKDIR /app

# 3. Install dependencies
COPY package.json ./
# Use npm ci for faster, more reliable builds in CI/CD environments
RUN npm ci

# 4. Copy application code
COPY . .

# 5. Build the Next.js application
RUN npm run build

# 6. Production Image: Use a minimal image for the final stage
FROM node:20-alpine AS runner
WORKDIR /app

# Copy built assets from the 'base' stage
COPY --from=base /app/public ./public
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json

# Expose the port the app runs on (Next.js default is 3000)
EXPOSE 3000

# Set the user to a non-root user for better security
USER node

# The command to run the application
CMD ["npm", "start"]
