# Padel Monday League

A Next.js app for a five-player padel group. It plans the Monday matches, keeps the leaderboard, and shows who is buying the next round.

## The squad

Olivier, Karel, Sander, Klaas, and Pim. Guests can fill in, and they do not earn points.

## Features

- **Match schedule.** Balanced 2v2 lineups for the Monday nights, with the resting player called out. Lineups can be edited, and extra dates can be added.
- **Leaderboard.** Players ranked by points from best-of-three sets.
- **Penalty box.** Last month's biggest loser carries into the new month. This month's biggest loser is on the hot seat. Two wins in a row light the flame.
- **Podium.** The all-time top three, with a link through to the full rankings.
- **Match history.** Every saved score, plus weeks that were skipped.
- **Admin.** A PIN-protected area to save a result, skip a week, change a lineup, add a match, or remove a result so the points come back off the board.

## Scoring

| Score | Result | Points |
| --- | --- | --- |
| 2–0 | Win | 3 |
| 2–1 | Win | 2 |
| 1–2 | Loss | 1 |
| 0–2 | Loss | 0 |

## Tech stack

- **Frontend:** Next.js, React, Tailwind CSS, Lucide
- **Database:** Neon (Postgres)
- **Deployment:** Vercel

## Local development

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Add the Neon connection string and `ADMIN_PINCODE` to `.env`.
4. Start the app:

   ```bash
   npm run dev
   ```
