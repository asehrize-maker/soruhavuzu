(async()=>{
  const { Client } = require('pg');
  const conn = 'postgresql://soru_havuzu_92j0_user:VZduIHPBOhngXmaLAdjUzxHnrlE5Vu4A@dpg-d5map8l6ubrc73a4fe3g-a.virginia-postgres.render.com/soru_havuzu_92j0?sslmode=require';
  const client = new Client({ connectionString: conn });
  await client.connect();
  const queries = [
    "UPDATE sorular SET durum='inceleme_bekliyor' WHERE durum IN ('alan_incelemede','dil_incelemede','alan_onaylandi','dil_onaylandi')",
    "UPDATE sorular SET durum='dizgide' WHERE durum='dizgi_tamam'",
    "UPDATE sorular SET durum='beklemede' WHERE durum IS NULL OR TRIM(LOWER(durum)) NOT IN ('beklemede','inceleme_bekliyor','revize_istendi','revize_gerekli','dizgi_bekliyor','dizgide','inceleme_tamam','tamamlandi','arsiv')"
  ];
  for (const q of queries) {
    const res = await client.query(q);
    console.log('ok', res.rowCount);
  }
  await client.end();
})();
