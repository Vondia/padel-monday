-- League tables for the five-player Monday group.
-- Scoring runs in the database: inserting a match updates player points,
-- matches played, and the current win streak.

BEGIN;

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(btrim(name)) > 0),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  matches_played integer NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  current_win_streak integer NOT NULL DEFAULT 0 CHECK (current_win_streak >= 0)
);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date timestamptz NOT NULL,
  team_1_player_a_id uuid NOT NULL REFERENCES players (id),
  team_1_player_b_id uuid REFERENCES players (id),
  team_2_player_a_id uuid NOT NULL REFERENCES players (id),
  team_2_player_b_id uuid REFERENCES players (id),
  guest_name text,
  team_1_sets_won integer NOT NULL,
  team_2_sets_won integer NOT NULL,
  CONSTRAINT matches_score_check CHECK (
    (team_1_sets_won = 2 AND team_2_sets_won = 0)
    OR (team_1_sets_won = 2 AND team_2_sets_won = 1)
    OR (team_1_sets_won = 1 AND team_2_sets_won = 2)
    OR (team_1_sets_won = 0 AND team_2_sets_won = 2)
  ),
  CONSTRAINT matches_distinct_players CHECK (
    team_1_player_a_id IS DISTINCT FROM team_1_player_b_id
    AND team_1_player_a_id IS DISTINCT FROM team_2_player_a_id
    AND team_1_player_a_id IS DISTINCT FROM team_2_player_b_id
    AND (team_1_player_b_id IS NULL OR (
      team_1_player_b_id IS DISTINCT FROM team_2_player_a_id
      AND team_1_player_b_id IS DISTINCT FROM team_2_player_b_id
    ))
    AND (team_2_player_b_id IS NULL OR team_2_player_a_id IS DISTINCT FROM team_2_player_b_id)
  ),
  CONSTRAINT matches_guest_name_check CHECK (
    (
      team_1_player_b_id IS NOT NULL
      AND team_2_player_b_id IS NOT NULL
      AND guest_name IS NULL
    )
    OR (
      guest_name IS NOT NULL
      AND char_length(btrim(guest_name)) > 0
      AND (team_1_player_b_id IS NULL) <> (team_2_player_b_id IS NULL)
    )
  )
);

CREATE INDEX IF NOT EXISTS matches_date_idx ON matches (date DESC);
CREATE INDEX IF NOT EXISTS matches_team_1_player_a_idx ON matches (team_1_player_a_id);
CREATE INDEX IF NOT EXISTS matches_team_1_player_b_idx ON matches (team_1_player_b_id);
CREATE INDEX IF NOT EXISTS matches_team_2_player_a_idx ON matches (team_2_player_a_id);
CREATE INDEX IF NOT EXISTS matches_team_2_player_b_idx ON matches (team_2_player_b_id);

INSERT INTO players (name)
VALUES ('Olivier'), ('Karel'), ('Sander'), ('Klaas'), ('Pim')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION apply_match_result()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  team_1_points integer;
  team_2_points integer;
  team_1_won boolean;
BEGIN
  IF NEW.team_1_sets_won = 2 AND NEW.team_2_sets_won = 0 THEN
    team_1_points := 3;
    team_2_points := 0;
    team_1_won := true;
  ELSIF NEW.team_1_sets_won = 2 AND NEW.team_2_sets_won = 1 THEN
    team_1_points := 2;
    team_2_points := 1;
    team_1_won := true;
  ELSIF NEW.team_1_sets_won = 1 AND NEW.team_2_sets_won = 2 THEN
    team_1_points := 1;
    team_2_points := 2;
    team_1_won := false;
  ELSIF NEW.team_1_sets_won = 0 AND NEW.team_2_sets_won = 2 THEN
    team_1_points := 0;
    team_2_points := 3;
    team_1_won := false;
  ELSE
    RAISE EXCEPTION 'Unsupported set score %-%', NEW.team_1_sets_won, NEW.team_2_sets_won;
  END IF;

  UPDATE players
  SET
    points = points + team_1_points,
    matches_played = matches_played + 1,
    current_win_streak = CASE
      WHEN team_1_won THEN current_win_streak + 1
      ELSE 0
    END
  WHERE id IN (NEW.team_1_player_a_id, NEW.team_1_player_b_id);

  UPDATE players
  SET
    points = points + team_2_points,
    matches_played = matches_played + 1,
    current_win_streak = CASE
      WHEN team_1_won THEN 0
      ELSE current_win_streak + 1
    END
  WHERE id IN (NEW.team_2_player_a_id, NEW.team_2_player_b_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_apply_result ON matches;
CREATE TRIGGER matches_apply_result
AFTER INSERT ON matches
FOR EACH ROW
EXECUTE FUNCTION apply_match_result();

COMMIT;
