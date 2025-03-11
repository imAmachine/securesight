# Stage 1: Build the React app using Node.js and NPM
FROM node:16-alpine AS build

WORKDIR /app/frontend

# Copy only package files first for better caching
COPY frontend/package.json frontend/package-lock.json ./

# Use cache mount to speed up dependency installation
RUN --mount=type=cache,target=/root/.npm \
    npm ci --silent

# Copy only necessary source files (excluding unnecessary files like tests, docs, etc.)
COPY frontend/public public
COPY frontend/src src

# Build the application
RUN npm run build

# Stage 2: Serve the built app using NGINX
FROM nginx:alpine AS final

# Set working directory
WORKDIR /usr/share/nginx/html

# Copy built app from the build stage
COPY --from=build /app/frontend/build ./

# Copy NGINX configuration (optional, if custom config is needed)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Set ownership and permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && chmod -R 755 /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
