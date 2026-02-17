import React from 'react';

export const STATUS_LABELS = {
  beklemede: 'Hazırlanıyor (Yazarın Panelinde)',
  dizgi_bekliyor: 'Dizgi Sırasında',
  dizgide: 'Dizgi İşleminde (Dizgi Biriminde)',
  dizgi_tamam: 'Dizgi Tamamlandı (Onay Bekliyor)',
  alan_incelemede: 'Alan İncelemede (Konu Uzmanında)',
  alan_onaylandi: 'Alan Onaylı (Dil Kontrolü Bekliyor)',
  dil_incelemede: 'Dil İncelemede (Dil Uzmanında)',
  dil_onaylandi: 'Dil Onaylı (Branş Onayı Bekliyor)',
  tamamlandi: 'Tamamlandı (Havuzda)',
  revize_gerekli: 'Revize Gerekli (Yediden Yazarda)',
  revize_istendi: 'Revize İstendi (Dizgi Düzeltmesinde)',
  inceleme_bekliyor: 'İnceleme Sırasında',
  incelemede: 'İnceleme Sürecinde',
  inceleme_tamam: 'İnceleme Tamamlandı',
};

export const formatLogDescription = (desc) => {
  if (!desc) return desc;
  let text = String(desc);

  // Status çevirileri - En uzun anahtardan başla ki çakışma olmasın
  const sortedKeys = Object.keys(STATUS_LABELS).sort((a, b) => b.length - a.length);

  sortedKeys.forEach(key => {
    const label = STATUS_LABELS[key];
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    text = text.replace(regex, label);
  });

  // Bazı genel düzenlemeler
  text = text.replace(/Durum:/g, 'Yeni Durum:');
  text = text.replace(/Not:/g, '📝 Not:');

  return text;
};

export const translateKey = (key) => {
  const dictionary = {
    // Ayarlar (Settings)
    'site_basligi': 'Site Başlığı',
    'bakim_modu': 'Bakım Modu',
    'kayit_acik': 'Kullanıcı Kaydı',
    'iletisim_email': 'İletişim E-Posta Adresi',
    'duyuru_aktif': 'Genel Duyuru Durumu',
    'duyuru_mesaji': 'Genel Duyuru Mesajı',
    'panel_duyuru_aktif': 'Panel Duyuru Durumu',
    'panel_duyuru_baslik': 'Panel Duyuru Başlığı',
    'panel_duyuru_mesaj': 'Panel Duyuru Mesajı',
    'panel_duyuru_tip': 'Panel Duyuru Tipi',
    'footer_metni': 'Alt Bilgi (Footer) Metni',

    // İşlem Türleri (Action Types)
    'soru_ekleme': 'Soru Ekleme',
    'soru_guncelleme': 'Soru Güncelleme',
    'soru_silme': 'Soru Silme',
    'durum_degisikligi': 'Durum Değişikliği',
    'dizgi_yukleme': 'Dizgi Yükleme',
    'dizgi_bitirme': 'Dizgi Bitirme',
    'login': 'Giriş Yapıldı',

    // Roller (Roles)
    'admin': 'Yönetici',
    'koordinator': 'Koordinatör',
    'soru_yazici': 'Soru Yazarı',
    'dizgici': 'Dizgi Birimi',
    'incelemeci': 'İnceleme Birimi',
    ...STATUS_LABELS
  };

  if (dictionary[key]) return dictionary[key];

  return key.replace(/_/g, ' ').split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

export const getDurumBadge = (durum) => {
  const badges = {
    beklemede: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100',
    dizgi_bekliyor: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-100',
    dizgide: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100',
    dizgi_tamam: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200',
    alan_incelemede: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-orange-50 text-orange-700 border border-orange-200',
    alan_onaylandi: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-200',
    dil_incelemede: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-sky-50 text-sky-700 border border-sky-200',
    dil_onaylandi: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-cyan-50 text-cyan-700 border border-cyan-200',
    tamamlandi: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-600 text-white border border-green-700 shadow-sm',
    revize_gerekli: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-700 border border-rose-200',
    revize_istendi: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-700 border border-rose-200',
    inceleme_bekliyor: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100',
    incelemede: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100',
    inceleme_tamam: 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-teal-50 text-teal-700 border border-teal-200',
  };

  return <span className={badges[durum] || 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-gray-50 text-gray-500'}>{STATUS_LABELS[durum] || durum}</span>;
};

export const generateExportHtml = (selectedData) => {
  let htmlContent = `
    <html>
    <head>
      <title>Soru Sistemi Dışa Aktarımı</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
      <style>
        body { font-family: 'Times New Roman', serif; padding: 40px; }
        .soru-item { margin-bottom: 30px; page-break-inside: avoid; border-bottom: 1px dashed #ccc; padding-bottom: 20px; }
        .soru-metni { font-size: 16px; margin-bottom: 15px; }
        .secenekler { margin-left: 20px; }
        .secenek { margin-bottom: 5px; }
        .soru-gorsel { max-width: 300px; display: block; margin: 10px 0; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px;">
        <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">Yazdır / PDF Olarak Kaydet</button>
      </div>
      <h1>Seçilen Sorular (${selectedData.length})</h1>
  `;

  selectedData.forEach((soru, index) => {
    htmlContent += `
        <div class="soru-item">
          <div class="soru-no"><strong>Soru ${index + 1}</strong> <span style="font-size:12px; color: #666;">(#${soru.id})</span></div>
          ${soru.fotograf_konumu === 'ust' && soru.fotograf_url ? `<img src="${soru.fotograf_url}" class="soru-gorsel" />` : ''}
          <div class="soru-metni">${soru.soru_metni.replace(/\n/g, '<br>')}</div>
          ${soru.fotograf_konumu === 'alt' && soru.fotograf_url ? `<img src="${soru.fotograf_url}" class="soru-gorsel" />` : ''}
          <div class="secenekler">
            ${soru.secenek_a ? `<div class="secenek">A) ${soru.secenek_a}</div>` : ''}
            ${soru.secenek_b ? `<div class="secenek">B) ${soru.secenek_b}</div>` : ''}
            ${soru.secenek_c ? `<div class="secenek">C) ${soru.secenek_c}</div>` : ''}
            ${soru.secenek_d ? `<div class="secenek">D) ${soru.secenek_d}</div>` : ''}
            ${soru.secenek_e ? `<div class="secenek">E) ${soru.secenek_e}</div>` : ''}
          </div>
          <div style="margin-top: 10px; font-size: 12px; color: #999;">
             Doğru Cevap: <strong>${soru.dogru_cevap || '-'}</strong> | 
             Zorluk: ${soru.zorluk_seviyesi || '-'} | 
             Kazanım: ${soru.kazanim || '-'}
          </div>
        </div>
      `;
  });

  htmlContent += `
     <script>
       document.addEventListener("DOMContentLoaded", function() {
          renderMathInElement(document.body, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ]
          });
       });
     </script>
    </body>
    </html>
  `;
  return htmlContent;
};
