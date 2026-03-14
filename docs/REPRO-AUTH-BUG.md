# Reproduce: “Friend” sees “You” after DB reset

## Goal
After a DB wipe, the user who had been “user 1” (friend) still has an old token. When they refresh, the server accepts that token and returns the **new** user 1 (you). So the friend’s UI shows your name — that’s the bug.

## Prerequisites
- Server running: `npm run dev`
- Two different “browsers”: e.g. **Chrome** and **Chrome Incognito**, or **Firefox** and **Chrome**

## Step-by-step

### 1. “Friend” becomes the first user
- Open the app in **Browser A** (e.g. incognito): `http://localhost:3000`
- You should see **Login / Sign up**
- **Sign up** with e.g. username `friend`, display name `Friend`, password `password123`
- You are now the only user → **user 1 (admin)**
- **Leave this tab open.** Do not close it and do not refresh yet.

### 2. Wipe the database
- **Stop the server** (Ctrl+C in the terminal where `npm run dev` is running)
- From project root run:
  ```bash
  rm -f data/game.db data/game.db-wal data/game.db-shm
  ```
- **Start the server again:** `npm run dev`

### 3. “You” become the new user 1
- Open the app in **Browser B** (e.g. normal window): `http://localhost:3000`
- You should see **Login / Sign up** (new DB = no users)
- **Sign up** with e.g. username `me`, display name `Me`, password `password123`
- You are now the first (and only) user in the new DB → **user 1 (admin)**

### 4. Reproduce the bug
- Go back to **Browser A** (the tab that was still open, logged in as `friend`)
- **Refresh the page** (F5 or Reload)
- **Bug:** The UI should now show **Me** (your account), not **Friend** — as if the friend were logged into your account.

### 5. Finish
- Press **Proceed** or **Mark as fixed** in Cursor so logs can be analyzed and the fix applied.

---

## Notes
- **Private window:** If you use “private” as “friend”, use it only for steps 1 and 4. Don’t sign up again in that same private window after the wipe, or you’ll just be the new user 1 there (expected).
- **Fresh private window:** With no prior login, a new private window should always show the **login page**, not admin. If you see admin without ever logging in there, that’s a different issue.
