(async()=>{
  const { Client } = require('pg');
  const conn = 'postgresql://soru_havuzu_92j0_user:VZduIHPBOhngXmaLAdjUzxHnrlE5Vu4A@dpg-d5map8l6ubrc73a4fe3g-a.virginia-postgres.render.com/soru_havuzu_92j0?sslmode=require';
  const client = new Client({ connectionString: conn });
  await client.connect();
  // Genişletilmiş durum listesini koruyarak sadece eski/hatalı değerleri normalize et
  const queries = [
    // Eski inceleme durum adlarını yeniye çevir
    "UPDATE sorular SET durum='inceleme_bekliyor' WHERE durum IN ('incelemede','inceleme','inceleme_tamamlanmadi')",
    // Eski revize adları
    "UPDATE sorular SET durum='revize_gerekli' WHERE durum IN ('revize','revize_bekliyor')",
    // Dizgi tamam -> dizgide (geçici)
    "UPDATE sorular SET durum='dizgide' WHERE durum='dizgi_tamam'",
    // Tanımsız durumları beklemede'ye çek; alan/dil inceleme/onay durumlarını koru
    \"UPDATE sorular SET durum='beklemede' WHERE durum IS NULL OR TRIM(LOWER(durum)) NOT IN ('beklemede','dizgi_bekliyor','dizgide','dizgi_tamam','alan_incelemede','alan_onaylandi','dil_incelemede','dil_onaylandi','revize_istendi','revize_gerekli','inceleme_bekliyor','incelemede','inceleme_tamam','tamamlandi','arsiv')\"
  ];
  for (const q of queries) {
    const res = await client.query(q);
    console.log('ok', res.rowCount);
  }
  await client.end();
})();
