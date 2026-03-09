# Le Jeu du Train 🚂

A multi-user, interactive web application built with React, Express, and SQLite. Track your trips, cross level crossings, earn points, and compete on the leaderboard!

## 🌟 Features

- **Live Tracking**: Track your trips in real-time using GPS.
- **Trip Planner**: Plan routes and estimate level crossings.
- **Manual Entry**: Log your past trips manually.
- **Leaderboards**: Compete globally or with friends.
- **Achievements**: Unlock medals and titles as you play.
- **Admin Dashboard**: Manage users, monitor activity, and configure the game.
- **PWA Support**: Install the app on your phone for a native-like experience.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Zustand, Lucide Icons, Motion.
- **Backend**: Node.js, Express, Better-SQLite3.
- **Database**: SQLite (Local persistence).

## 🚀 Getting Started

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/le-jeu-du-train.git
   cd le-jeu-du-train
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Copy the example environment file and configure it:
   ```bash
   cp .env.example .env
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open the app**: Visit `http://localhost:3000` in your browser.

## 📦 Deployment

For detailed deployment instructions, including setting up a production server with PM2 and Nginx, see [DEPLOY.md](./DEPLOY.md).

## 📄 License

This project is licensed under the MIT License.
