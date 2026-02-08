import React from 'react';

export const STATUS_LABELS = {
  beklemede: 'Hazırlanıyor',
  dizgi_bekliyor: 'Dizgi Bekliyor',
  dizgide: 'Dizgide',
  dizgi_tamam: 'Dizgi Tamamlandı',
  alan_incelemede: 'Alan İncelemede',
  alan_onaylandi: 'Alan Onaylı (Branşta)',
  dil_incelemede: 'Dil İncelemede',
  dil_onaylandi: 'Dil Onaylı (Branşta)',
  tamamlandi: 'Tamamlandı',
  revize_gerekli: 'Revize Gerekli',
  revize_istendi: 'Revize İstendi',
  inceleme_bekliyor: 'İnceleme Bekliyor',
  incelemede: 'İncelemede',
  inceleme_tamam: 'İnceleme Tamamlandı',
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
    'incelemeci': 'İnceleme Birimi'
  };

  if (dictionary[key]) return dictionary[key];

  return key.replace(/_/g, ' ').split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

export const getDurumBadge = (durum) => {
  const badges = {
    beklemede: 'badge badge-warning',
    dizgi_bekliyor: 'badge bg-purple-100 text-purple-700',
    dizgide: 'badge badge-info',
    dizgi_tamam: 'badge bg-emerald-100 text-emerald-700 border border-emerald-200',
    alan_incelemede: 'badge bg-orange-100 text-orange-700 border border-orange-200',
    alan_onaylandi: 'badge bg-indigo-100 text-indigo-700 border border-indigo-200',
    dil_incelemede: 'badge bg-blue-100 text-blue-700 border border-blue-200',
    dil_onaylandi: 'badge bg-cyan-100 text-cyan-700 border border-cyan-200',
    tamamlandi: 'badge badge-success',
    revize_gerekli: 'badge badge-error',
    revize_istendi: 'badge badge-error',
    inceleme_bekliyor: 'badge badge-primary',
    incelemede: 'badge badge-primary',
    inceleme_tamam: 'badge bg-teal-100 text-teal-700',
  };

  return <span className={badges[durum] || 'badge'}>{STATUS_LABELS[durum] || durum}</span>;
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
