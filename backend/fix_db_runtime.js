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
ALTER TABLE sorular
ADD CONSTRAINT sorular_durum_check
CHECK (
  durum IN (
    'beklemede','inceleme_bekliyor','revize_istendi','revize_gerekli',
    'dizgi_bekliyor','dizgide','inceleme_tamam','tamamlandi','arsiv'
  )
);
ALTER TABLE sorular ALTER COLUMN durum SET DEFAULT 'beklemede';

-- Zorluk değerlerini normalize et ve kısıtı güncelle
ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_zorluk_seviyesi_check;

UPDATE sorular SET zorluk_seviyesi = CASE
  WHEN zorluk_seviyesi IN ('1','2') THEN 'kolay'
  WHEN zorluk_seviyesi = '3' THEN 'orta'
  WHEN zorluk_seviyesi IN ('4','5') THEN 'zor'
  ELSE COALESCE(zorluk_seviyesi, 'orta')
END;

ALTER TABLE sorular
ADD CONSTRAINT sorular_zorluk_seviyesi_check
CHECK (zorluk_seviyesi IN ('kolay','orta','zor'));

UPDATE sorular SET durum = 'inceleme_bekliyor'
WHERE durum IN ('incelemede','inceleme','inceleme_tamamlanmadi');

UPDATE sorular SET durum = 'revize_gerekli'
WHERE durum IN ('revize','revize_bekliyor');

UPDATE sorular SET durum = 'beklemede'
WHERE durum NOT IN ('beklemede','inceleme_bekliyor','revize_istendi','revize_gerekli','dizgi_bekliyor','dizgide','inceleme_tamam','tamamlandi','arsiv');
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
