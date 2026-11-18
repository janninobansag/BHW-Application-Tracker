CREATE TABLE puroks (
  id TEXT PRIMARY KEY NOT NULL,
  barangay_id TEXT NOT NULL REFERENCES barangays(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (barangay_id, name)
);

CREATE TABLE purok_assignments (
  user_id TEXT NOT NULL REFERENCES users(id),
  purok_id TEXT NOT NULL REFERENCES puroks(id),
  PRIMARY KEY (user_id, purok_id)
);

ALTER TABLE children ADD COLUMN purok_id TEXT REFERENCES puroks(id);

INSERT INTO puroks (id, barangay_id, name, created_at)
SELECT 'unspecified-' || id, id,
  CASE WHEN lower(name) = 'tulay' THEN 'Hermit Crab' ELSE 'Purok not specified' END,
  created_at FROM barangays;

UPDATE children
SET purok_id = 'unspecified-' || barangay_id
WHERE purok_id IS NULL;

INSERT OR IGNORE INTO purok_assignments (user_id, purok_id)
SELECT a.user_id, p.id
FROM assignments a JOIN puroks p ON p.barangay_id = a.barangay_id;
