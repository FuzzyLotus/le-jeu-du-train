# Le Jeu du Train

A multi-user, interactive game built with React, Express, and SQLite.

## Features

- **Multi-user Support**: Create an account and compete with others.
- **Leaderboards**: See who has the highest score in real-time.
- **Game History**: Track your past trips and performance.
- **Achievements**: Unlock medals as you play.
- **Admin Dashboard**: Manage announcements and global multipliers.

## Tech Stack

- **Frontend**: React, Tailwind CSS, Lucide Icons, Motion.
- **Backend**: Node.js, Express, Better-SQLite3.
- **Database**: SQLite (Local persistence).

## Getting Started

### Local Development

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start the development server**:
    ```bash
    npm run dev
    ```
3.  **Open the app**: Visit `http://localhost:3000`.

### Versioning & Sync Status
The app includes a versioning system to help you track updates between AI Studio and Production.
- **Version Number:** Located in `src/version.ts`.
- **Sync Status:** Displayed in the Admin Panel to confirm connection to GitHub.
- **Update Process:** When you push changes from AI Studio, update the `APP_VERSION` and `LAST_SYNC` in `src/version.ts` to keep track of your releases.

## Deployment

For detailed deployment instructions, see [DEPLOY.md](./DEPLOY.md).

## License

GNU 3
