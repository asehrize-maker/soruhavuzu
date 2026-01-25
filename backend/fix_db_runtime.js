import pkg from 'pg';
const { Client } = pkg;
const sql = `
ALTER TABLE kullanicilar
  ADD COLUMN IF NOT EXISTS inceleme_alanci BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS inceleme_dilci  BOOLEAN DEFAULT false;

UPDATE kullanicilar
SET rol = 'incelemeci', inceleme_alanci = true
WHERE rol = 'alan_incelemeci';

UPDATE kullanicilar
SET rol = 'incelemeci', inceleme_dilci = true
WHERE rol = 'dil_incelemeci';

UPDATE kullanicilar
SET inceleme_alanci = false, inceleme_dilci = false
WHERE rol <> 'incelemeci';

ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_durum_check;
-- Güncel ve genişletilmiş durum listesi (workflow v2 + dizgi_tamam)
ALTER TABLE sorular
ADD CONSTRAINT sorular_durum_check
CHECK (
  durum IN (
    'beklemede',
    'dizgi_bekliyor',
    'dizgide',
    'dizgi_tamam',
    'alan_incelemede',
    'alan_onaylandi',
    'dil_incelemede',
    'dil_onaylandi',
    'revize_istendi',
    'revize_gerekli',
    'inceleme_bekliyor',
    'incelemede',
    'inceleme_tamam',
    'tamamlandi',
    'arsiv'
  )
);
ALTER TABLE sorular ALTER COLUMN durum SET DEFAULT 'beklemede';

-- Zorluk değerini 5 kademeli smallint'e çevir
ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_zorluk_seviyesi_check;

ALTER TABLE sorular
  ALTER COLUMN zorluk_seviyesi TYPE SMALLINT USING (
    CASE
      WHEN zorluk_seviyesi ~ '^[0-9]+$' THEN LEAST(GREATEST(zorluk_seviyesi::INT,1),5)
      WHEN zorluk_seviyesi IN ('kolay','cok kolay','çok kolay') THEN 2
      WHEN zorluk_seviyesi = 'orta' THEN 3
      WHEN zorluk_seviyesi = 'zor' THEN 4
      ELSE 3
    END
  );

UPDATE sorular SET zorluk_seviyesi = 2 WHERE zorluk_seviyesi IS NULL;

ALTER TABLE sorular
ADD CONSTRAINT sorular_zorluk_seviyesi_check
CHECK (zorluk_seviyesi BETWEEN 1 AND 5);

-- Eski veya hatalı durumları normalize et, ancak dil/alan inceleme aşamalarını koru
UPDATE sorular SET durum = 'inceleme_bekliyor'
WHERE durum IN ('incelemede','inceleme','inceleme_tamamlanmadi');

UPDATE sorular SET durum = 'revize_gerekli'
WHERE durum IN ('revize','revize_bekliyor');

-- Sadece tanımsız durumları beklemede'ye çek (tüm geniş listeyi koru)
UPDATE sorular SET durum = 'beklemede'
WHERE durum NOT IN (
  'beklemede','dizgi_bekliyor','dizgide','dizgi_tamam',
  'alan_incelemede','alan_onaylandi','dil_incelemede','dil_onaylandi',
  'revize_istendi','revize_gerekli',
  'inceleme_bekliyor','incelemede','inceleme_tamam',
  'tamamlandi','arsiv'
);
`;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ DB fix applied');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ DB fix failed:', e.message);
  } finally {
    await client.end();
  }
}
run();
