🎾 Padel Monday League
A custom-built Next.js web application for our 5-person padel group. This app automates our weekly Monday match scheduling, tracks our ongoing leaderboard, and definitively proves who is the best (and who owes the next round of drinks).

🏆 The Squad
Olivier, Karel, Sander, Klaas, and Pim. (Guest players supported upon request!)

✨ Key Features
Smart Match Scheduler: Automatically generates balanced 2v2 teams for upcoming Mondays and clearly highlights which of the 5 players has the "Resting Week".

Dynamic Leaderboard: Ranks players based on a custom best-of-3 set scoring system.

The Penalty Box & Glory: Highlights the player on a winning streak (🔥 On Fire) and shames the "Loser of the Month" who has to buy the first round of drinks.

Match History: A historical log of all past clashes and set scores.

Admin Dashboard: A protected area to submit weekly match results (which automatically updates the leaderboard points), manually override schedules for last-minute cancellations, and add temporary guest players.

📊 Scoring System
Points are awarded based on the outcome of a Best-of-3 match:

3 Points: Win (2-0)

2 Points: Win (2-1)

1 Point: Loss (1-2)

0 Points: Loss (0-2)

🛠 Tech Stack
Frontend: Next.js, React, Tailwind CSS, Lucide Icons

Database: Neon (PostgreSQL)

Deployment: Vercel

🚀 Local Development
Clone the repository.

Run npm install to install dependencies.

Set up a Neon Postgres database and add your connection string to a .env file.

Run neon run -- npm run dev to start the development server.
