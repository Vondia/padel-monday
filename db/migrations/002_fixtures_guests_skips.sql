-- Multiple guests per match, skipped weeks, and an editable fixture list.

BEGIN;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_reason text,
  ADD COLUMN IF NOT EXISTS team_1_player_a_guest text,
  ADD COLUMN IF NOT EXISTS team_1_player_b_guest text,
  ADD COLUMN IF NOT EXISTS team_2_player_a_guest text,
  ADD COLUMN IF NOT EXISTS team_2_player_b_guest text;

ALTER TABLE matches
  ALTER COLUMN team_1_player_a_id DROP NOT NULL,
  ALTER COLUMN team_2_player_a_id DROP NOT NULL,
  ALTER COLUMN team_1_sets_won DROP NOT NULL,
  ALTER COLUMN team_2_sets_won DROP NOT NULL;

UPDATE matches
SET team_1_player_b_guest = btrim(guest_name)
WHERE team_1_player_b_id IS NULL
  AND guest_name IS NOT NULL
  AND team_1_player_b_guest IS NULL;

UPDATE matches
SET team_2_player_b_guest = btrim(guest_name)
WHERE team_2_player_b_id IS NULL
  AND guest_name IS NOT NULL
  AND team_2_player_b_guest IS NULL;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_score_check;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_guest_name_check;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_distinct_players;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_team_1_a_slot;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_team_1_b_slot;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_team_2_a_slot;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_team_2_b_slot;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_has_player;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_skip_scores;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_skip_reason_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_score_check CHECK (
    skipped
    OR (team_1_sets_won = 2 AND team_2_sets_won = 0)
    OR (team_1_sets_won = 2 AND team_2_sets_won = 1)
    OR (team_1_sets_won = 1 AND team_2_sets_won = 2)
    OR (team_1_sets_won = 0 AND team_2_sets_won = 2)
  ),
  ADD CONSTRAINT matches_skip_scores CHECK (
    (NOT skipped AND team_1_sets_won IS NOT NULL AND team_2_sets_won IS NOT NULL)
    OR (skipped AND team_1_sets_won IS NULL AND team_2_sets_won IS NULL)
  ),
  ADD CONSTRAINT matches_skip_reason_check CHECK (
    (skipped AND (skip_reason IS NULL OR char_length(btrim(skip_reason)) BETWEEN 1 AND 160))
    OR (NOT skipped AND skip_reason IS NULL)
  ),
  ADD CONSTRAINT matches_team_1_a_slot CHECK (
    skipped
    OR (team_1_player_a_id IS NOT NULL AND team_1_player_a_guest IS NULL)
    OR (
      team_1_player_a_id IS NULL
      AND team_1_player_a_guest IS NOT NULL
      AND char_length(btrim(team_1_player_a_guest)) > 0
    )
  ),
  ADD CONSTRAINT matches_team_1_b_slot CHECK (
    skipped
    OR (team_1_player_b_id IS NOT NULL AND team_1_player_b_guest IS NULL)
    OR (
      team_1_player_b_id IS NULL
      AND team_1_player_b_guest IS NOT NULL
      AND char_length(btrim(team_1_player_b_guest)) > 0
    )
  ),
  ADD CONSTRAINT matches_team_2_a_slot CHECK (
    skipped
    OR (team_2_player_a_id IS NOT NULL AND team_2_player_a_guest IS NULL)
    OR (
      team_2_player_a_id IS NULL
      AND team_2_player_a_guest IS NOT NULL
      AND char_length(btrim(team_2_player_a_guest)) > 0
    )
  ),
  ADD CONSTRAINT matches_team_2_b_slot CHECK (
    skipped
    OR (team_2_player_b_id IS NOT NULL AND team_2_player_b_guest IS NULL)
    OR (
      team_2_player_b_id IS NULL
      AND team_2_player_b_guest IS NOT NULL
      AND char_length(btrim(team_2_player_b_guest)) > 0
    )
  ),
  ADD CONSTRAINT matches_has_player CHECK (
    skipped
    OR team_1_player_a_id IS NOT NULL
    OR team_1_player_b_id IS NOT NULL
    OR team_2_player_a_id IS NOT NULL
    OR team_2_player_b_id IS NOT NULL
  ),
  ADD CONSTRAINT matches_distinct_players CHECK (
    skipped
    OR (
      (team_1_player_a_id IS NULL OR team_1_player_b_id IS NULL OR team_1_player_a_id <> team_1_player_b_id)
      AND (team_1_player_a_id IS NULL OR team_2_player_a_id IS NULL OR team_1_player_a_id <> team_2_player_a_id)
      AND (team_1_player_a_id IS NULL OR team_2_player_b_id IS NULL OR team_1_player_a_id <> team_2_player_b_id)
      AND (team_1_player_b_id IS NULL OR team_2_player_a_id IS NULL OR team_1_player_b_id <> team_2_player_a_id)
      AND (team_1_player_b_id IS NULL OR team_2_player_b_id IS NULL OR team_1_player_b_id <> team_2_player_b_id)
      AND (team_2_player_a_id IS NULL OR team_2_player_b_id IS NULL OR team_2_player_a_id <> team_2_player_b_id)
    )
  );

ALTER TABLE matches ADD COLUMN IF NOT EXISTS amsterdam_day date;

UPDATE matches
SET amsterdam_day = (timezone('Europe/Amsterdam', date))::date
WHERE amsterdam_day IS NULL;

ALTER TABLE matches ALTER COLUMN amsterdam_day SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS matches_one_per_amsterdam_day ON matches (amsterdam_day);

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
  IF NEW.skipped THEN
    RETURN NEW;
  END IF;

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

CREATE TABLE IF NOT EXISTS fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  played_at timestamptz NOT NULL,
  amsterdam_day date NOT NULL,
  team_1_player_a_id uuid REFERENCES players (id),
  team_1_player_a_guest text,
  team_1_player_b_id uuid REFERENCES players (id),
  team_1_player_b_guest text,
  team_2_player_a_id uuid REFERENCES players (id),
  team_2_player_a_guest text,
  team_2_player_b_id uuid REFERENCES players (id),
  team_2_player_b_guest text,
  CONSTRAINT fixtures_day_unique UNIQUE (amsterdam_day),
  CONSTRAINT fixtures_team_1_a_slot CHECK (
    (team_1_player_a_id IS NOT NULL AND team_1_player_a_guest IS NULL)
    OR (
      team_1_player_a_id IS NULL
      AND team_1_player_a_guest IS NOT NULL
      AND char_length(btrim(team_1_player_a_guest)) > 0
    )
  ),
  CONSTRAINT fixtures_team_1_b_slot CHECK (
    (team_1_player_b_id IS NOT NULL AND team_1_player_b_guest IS NULL)
    OR (
      team_1_player_b_id IS NULL
      AND team_1_player_b_guest IS NOT NULL
      AND char_length(btrim(team_1_player_b_guest)) > 0
    )
  ),
  CONSTRAINT fixtures_team_2_a_slot CHECK (
    (team_2_player_a_id IS NOT NULL AND team_2_player_a_guest IS NULL)
    OR (
      team_2_player_a_id IS NULL
      AND team_2_player_a_guest IS NOT NULL
      AND char_length(btrim(team_2_player_a_guest)) > 0
    )
  ),
  CONSTRAINT fixtures_team_2_b_slot CHECK (
    (team_2_player_b_id IS NOT NULL AND team_2_player_b_guest IS NULL)
    OR (
      team_2_player_b_id IS NULL
      AND team_2_player_b_guest IS NOT NULL
      AND char_length(btrim(team_2_player_b_guest)) > 0
    )
  ),
  CONSTRAINT fixtures_has_player CHECK (
    team_1_player_a_id IS NOT NULL
    OR team_1_player_b_id IS NOT NULL
    OR team_2_player_a_id IS NOT NULL
    OR team_2_player_b_id IS NOT NULL
  ),
  CONSTRAINT fixtures_distinct_players CHECK (
    (team_1_player_a_id IS NULL OR team_1_player_b_id IS NULL OR team_1_player_a_id <> team_1_player_b_id)
    AND (team_1_player_a_id IS NULL OR team_2_player_a_id IS NULL OR team_1_player_a_id <> team_2_player_a_id)
    AND (team_1_player_a_id IS NULL OR team_2_player_b_id IS NULL OR team_1_player_a_id <> team_2_player_b_id)
    AND (team_1_player_b_id IS NULL OR team_2_player_a_id IS NULL OR team_1_player_b_id <> team_2_player_a_id)
    AND (team_1_player_b_id IS NULL OR team_2_player_b_id IS NULL OR team_1_player_b_id <> team_2_player_b_id)
    AND (team_2_player_a_id IS NULL OR team_2_player_b_id IS NULL OR team_2_player_a_id <> team_2_player_b_id)
  )
);

COMMIT;
