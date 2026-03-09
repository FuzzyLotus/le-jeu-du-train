# 🚀 Deployment Guide

This guide explains how to deploy **Le Jeu du Train** on a Linux server (like Ubuntu or Debian). This guide assumes you have a Virtual Private Server (VPS) from a provider like DigitalOcean, Hetzner, AWS, or Linode.

## 🛠️ Prerequisites

* A Linux server (Ubuntu 22.04 or 24.04 recommended)
* A domain name pointing to your server's IP address (optional but highly recommended)
* SSH access to the server

---

## Step 1: Prepare the Server

Connect to your server via SSH and update the system packages. Then, install Node.js (the runtime), Git (to download your code), and build tools (needed for the SQLite database).

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Git and build tools (required for better-sqlite3)
sudo apt install -y git curl build-essential python3

# Install Node.js (v20 LTS or v22)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
node -v
npm -v
```

## Step 2: Get the Code

Clone your repository onto the server. We'll place it in the `/var/www` directory, which is standard for web applications.

```bash
# Create a directory for your app
sudo mkdir -p /var/www/le-jeu-du-train
sudo chown -R $USER:$USER /var/www/le-jeu-du-train

# Navigate to the directory
cd /var/www/le-jeu-du-train

# Clone your code (replace with your actual git repository URL)
git clone https://github.com/YOUR_USERNAME/le-jeu-du-train.git .
```

## Step 3: Install Dependencies & Build

Install the required Node.js packages and build the React frontend for production.

```bash
# Install all dependencies
npm install

# Build the Vite frontend (creates the /dist folder)
npm run build
```

## Step 4: Configure Environment Variables

Your app needs a `.env` file to know it's running in production and to secure user sessions.

```bash
# Copy the example environment file
cp .env.example .env

# Open the .env file
nano .env
```

Edit the file to match your production environment:

```env
# Tell the server to run in production mode (serves the built frontend)
NODE_ENV=production

# The port the app will run on internally
PORT=3000

# Generate a strong random string for this! 
# You can generate one by running: openssl rand -base64 32
JWT_SECRET=your_super_secret_random_string_here

# Optional: Custom database path (defaults to ./data/game.db)
# DATABASE_PATH=/var/www/le-jeu-du-train/data/game.db
```
*(Press `Ctrl+O`, `Enter` to save, then `Ctrl+X` to exit nano).*

## Step 5: Keep the App Running Forever (PM2)

If you just run `npm start`, the app will stop when you close your SSH terminal. To keep it running in the background and restart it automatically if it crashes or the server reboots, we use **PM2**.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
pm2 start npm --name "le-jeu-du-train" -- run start

# Tell PM2 to start automatically when the server reboots
pm2 startup
# (Run the command that PM2 outputs on your screen)

# Save the current PM2 process list
pm2 save
```

Your app is now running on `http://localhost:3000` on your server!

## Step 6: Expose to the Web (Nginx Reverse Proxy)

To allow users to access the app via standard web ports (80/443) and use a domain name, we'll set up Nginx.

```bash
# Install Nginx
sudo apt install -y nginx

# Create a new configuration file for your app
sudo nano /etc/nginx/sites-available/le-jeu-du-train
```

Paste the following configuration (replace `yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Pass real IP to the app (useful for rate limiting)
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and restart Nginx:

```bash
# Enable the configuration
sudo ln -s /etc/nginx/sites-available/le-jeu-du-train /etc/nginx/sites-enabled/

# Test Nginx configuration for syntax errors
sudo nginx -t

# Restart Nginx to apply changes
sudo systemctl restart nginx
```

## Step 7: Secure with HTTPS (Free SSL via Let's Encrypt)

If you are using a domain name, you should secure it with HTTPS.

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain and install the SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot will ask for your email and automatically configure Nginx to use HTTPS and redirect HTTP traffic to HTTPS.

---

## 🔄 Maintenance & Updates

**How to update the app when you push new code to GitHub:**
```bash
cd /var/www/le-jeu-du-train
git pull origin main
npm install
npm run build
pm2 restart le-jeu-du-train
```

**Where is the database?**
The SQLite database is automatically created in the `data/game.db` folder inside your project directory. 
**To back it up**, simply copy that file:
```bash
cp /var/www/le-jeu-du-train/data/game.db ~/game-backup-$(date +%F).db
```