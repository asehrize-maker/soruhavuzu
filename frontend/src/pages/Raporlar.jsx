import { useState, useEffect } from 'react';
import { soruAPI } from '../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Raporlar() {
  const [loading, setLoading] = useState(false);
  const [raporTipi, setRaporTipi] = useState('haftalik');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [raporData, setRaporData] = useState(null);

  useEffect(() => {
    // Varsayılan tarih aralığını ayarla
    setDefaultDates();
  }, [raporTipi]);

  const setDefaultDates = () => {
    const bugun = new Date();
    const bitisTarih = bugun.toISOString().split('T')[0];
    
    let baslangicTarih;
    if (raporTipi === 'haftalik') {
      const gecenHafta = new Date(bugun);
      gecenHafta.setDate(bugun.getDate() - 7);
      baslangicTarih = gecenHafta.toISOString().split('T')[0];
    } else if (raporTipi === 'aylik') {
      const gecenAy = new Date(bugun);
      gecenAy.setMonth(bugun.getMonth() - 1);
      baslangicTarih = gecenAy.toISOString().split('T')[0];
    } else {
      // Özel tarih aralığı
      const gecen30Gun = new Date(bugun);
      gecen30Gun.setDate(bugun.getDate() - 30);
      baslangicTarih = gecen30Gun.toISOString().split('T')[0];
    }
    
    setBaslangic(baslangicTarih);
    setBitis(bitisTarih);
  };

  const loadRapor = async () => {
    if (!baslangic || !bitis) {
      alert('Lütfen başlangıç ve bitiş tarihi seçin');
      return;
    }

    setLoading(true);
    try {
      const response = await soruAPI.getRapor({
        baslangic,
        bitis,
        tip: raporTipi
      });
      setRaporData(response.data.data);
    } catch (error) {
      console.error('Rapor yüklenirken hata:', error);
      alert('Rapor yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!raporData) {
      alert('Önce rapor oluşturun');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Başlık
    doc.setFontSize(20);
    doc.text('Soru Havuzu Analiz Raporu', pageWidth / 2, 15, { align: 'center' });
    
    // Dönem bilgisi
    doc.setFontSize(12);
    doc.text(`Rapor Dönemi: ${formatDate(raporData.donem.baslangic)} - ${formatDate(raporData.donem.bitis)}`, 14, 25);
    doc.text(`Rapor Tipi: ${raporData.donem.tip === 'haftalik' ? 'Haftalık' : raporData.donem.tip === 'aylik' ? 'Aylık' : 'Özel Dönem'}`, 14, 32);
    
    let yPos = 45;

    // Genel İstatistikler
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Genel İstatistikler', 14, yPos);
    yPos += 7;
    
    doc.autoTable({
      startY: yPos,
      head: [['Metrik', 'Değer']],
      body: [
        ['Toplam Soru', raporData.genel.toplam_soru || 0],
        ['Tamamlanan', raporData.genel.tamamlanan || 0],
        ['Bekleyen', raporData.genel.bekleyen || 0],
        ['Devam Eden', raporData.genel.devam_eden || 0],
        ['Reddedilen', raporData.genel.reddedilen || 0],
        ['Fotoğraflı Soru', raporData.genel.fotografli || 0],
        ['LaTeX\'li Soru', raporData.genel.latexli || 0],
      ],
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] },
    });
    
    yPos = doc.lastAutoTable.finalY + 10;

    // Zorluk Dağılımı
    if (yPos > 240) {
      doc.addPage();
      yPos = 15;
    }
    
    doc.setFontSize(14);
    doc.text('Zorluk Dağılımı', 14, yPos);
    yPos += 7;
    
    doc.autoTable({
      startY: yPos,
      head: [['Seviye', 'Adet']],
      body: [
        ['Kolay', raporData.genel.kolay || 0],
        ['Orta', raporData.genel.orta || 0],
        ['Zor', raporData.genel.zor || 0],
      ],
      theme: 'grid',
      headStyles: { fillColor: [40, 167, 69] },
    });
    
    yPos = doc.lastAutoTable.finalY + 10;

    // Branş Performansı
    if (raporData.branslar && raporData.branslar.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 15;
      }
      
      doc.setFontSize(14);
      doc.text('Branş Performansı', 14, yPos);
      yPos += 7;
      
      doc.autoTable({
        startY: yPos,
        head: [['Branş', 'Ekip', 'Toplam', 'Tamamlanan', 'Bekleyen', 'Ort. Süre (Saat)']],
        body: raporData.branslar.map(b => [
          b.brans_adi,
          b.ekip_adi,
          b.toplam_soru || 0,
          b.tamamlanan || 0,
          b.bekleyen || 0,
          b.ortalama_sure_saat || '-'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [255, 193, 7] },
        styles: { fontSize: 9 },
      });
      
      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Kullanıcı Performansı (Top 10)
    if (raporData.kullanicilar && raporData.kullanicilar.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 15;
      }
      
      doc.setFontSize(14);
      doc.text('En Aktif Soru Yazıcılar', 14, yPos);
      yPos += 7;
      
      doc.autoTable({
        startY: yPos,
        head: [['Kullanıcı', 'Branş', 'Oluşturulan', 'Tamamlanan', 'Başarı %']],
        body: raporData.kullanicilar.slice(0, 10).map(k => [
          k.ad_soyad,
          k.brans_adi,
          k.olusturulan_soru || 0,
          k.tamamlanan || 0,
          k.basari_orani || 0
        ]),
        theme: 'striped',
        headStyles: { fillColor: [23, 162, 184] },
        styles: { fontSize: 9 },
      });
      
      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Dizgici Performansı (Top 10)
    if (raporData.dizgiciler && raporData.dizgiciler.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 15;
      }
      
      doc.setFontSize(14);
      doc.text('En Verimli Dizgiciler', 14, yPos);
      yPos += 7;
      
      doc.autoTable({
        startY: yPos,
        head: [['Dizgici', 'Branş', 'Tamamlanan', 'Ort. Süre (Saat)', 'Reddedilen']],
        body: raporData.dizgiciler.slice(0, 10).map(d => [
          d.ad_soyad,
          d.brans_adi,
          d.tamamlanan_soru || 0,
          d.ortalama_sure_saat || '-',
          d.reddedilen || 0
        ]),
        theme: 'striped',
        headStyles: { fillColor: [220, 53, 69] },
        styles: { fontSize: 9 },
      });
    }

    // Dosyayı kaydet
    const fileName = `rapor_${raporData.donem.baslangic}_${raporData.donem.bitis}.pdf`;
    doc.save(fileName);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const calculatePercentage = (value, total) => {
    if (!total || total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📊 Analiz ve Raporlar</h1>
        <p className="mt-2 text-gray-600">Detaylı performans raporları oluşturun ve PDF olarak indirin</p>
      </div>

      {/* Rapor Ayarları */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Rapor Ayarları</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Rapor Tipi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rapor Tipi
            </label>
            <select
              value={raporTipi}
              onChange={(e) => setRaporTipi(e.target.value)}
              className="input"
            >
              <option value="haftalik">Haftalık</option>
              <option value="aylik">Aylık</option>
              <option value="ozel">Özel Tarih Aralığı</option>
            </select>
          </div>

          {/* Başlangıç Tarihi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
              className="input"
            />
          </div>

          {/* Bitiş Tarihi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={bitis}
              onChange={(e) => setBitis(e.target.value)}
              className="input"
            />
          </div>

          {/* Butonlar */}
          <div className="flex items-end gap-2">
            <button
              onClick={loadRapor}
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Yükleniyor...' : '🔍 Rapor Oluştur'}
            </button>
            {raporData && (
              <button
                onClick={exportToPDF}
                className="btn bg-red-600 hover:bg-red-700 text-white"
                title="PDF İndir"
              >
                📄 PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Rapor İçeriği */}
      {loading && (
        <div className="card text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Rapor hazırlanıyor...</p>
        </div>
      )}

      {!loading && raporData && (
        <div className="space-y-6">
          {/* Genel İstatistikler */}
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Genel İstatistikler</h2>
              <span className="text-sm text-gray-500">
                {formatDate(raporData.donem.baslangic)} - {formatDate(raporData.donem.bitis)}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow">
                <div className="text-3xl font-bold">{raporData.genel.toplam_soru || 0}</div>
                <div className="text-sm opacity-90">Toplam Soru</div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow">
                <div className="text-3xl font-bold">{raporData.genel.tamamlanan || 0}</div>
                <div className="text-sm opacity-90">Tamamlanan</div>
                <div className="text-xs opacity-75 mt-1">
                  %{calculatePercentage(raporData.genel.tamamlanan, raporData.genel.toplam_soru)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-4 rounded-lg shadow">
                <div className="text-3xl font-bold">{raporData.genel.bekleyen || 0}</div>
                <div className="text-sm opacity-90">Bekleyen</div>
                <div className="text-xs opacity-75 mt-1">
                  %{calculatePercentage(raporData.genel.bekleyen, raporData.genel.toplam_soru)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow">
                <div className="text-3xl font-bold">{raporData.genel.devam_eden || 0}</div>
                <div className="text-sm opacity-90">Devam Eden</div>
                <div className="text-xs opacity-75 mt-1">
                  %{calculatePercentage(raporData.genel.devam_eden, raporData.genel.toplam_soru)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-gray-100 p-3 rounded">
                <div className="text-sm text-gray-600">Reddedilen</div>
                <div className="text-2xl font-bold text-red-600">{raporData.genel.reddedilen || 0}</div>
              </div>

              <div className="bg-gray-100 p-3 rounded">
                <div className="text-sm text-gray-600">Fotoğraflı</div>
                <div className="text-2xl font-bold text-purple-600">{raporData.genel.fotografli || 0}</div>
              </div>

              <div className="bg-gray-100 p-3 rounded">
                <div className="text-sm text-gray-600">LaTeX'li</div>
                <div className="text-2xl font-bold text-indigo-600">{raporData.genel.latexli || 0}</div>
              </div>

              <div className="bg-gray-100 p-3 rounded">
                <div className="text-sm text-gray-600">Toplam İçerik</div>
                <div className="text-2xl font-bold text-blue-600">
                  {(raporData.genel.fotografli || 0) + (raporData.genel.latexli || 0)}
                </div>
              </div>
            </div>

            {/* Zorluk Seviyesi */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Zorluk Dağılımı</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Kolay</span>
                    <span className="font-medium">{raporData.genel.kolay || 0}</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${calculatePercentage(raporData.genel.kolay, raporData.genel.toplam_soru)}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Orta</span>
                    <span className="font-medium">{raporData.genel.orta || 0}</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${calculatePercentage(raporData.genel.orta, raporData.genel.toplam_soru)}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Zor</span>
                    <span className="font-medium">{raporData.genel.zor || 0}</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${calculatePercentage(raporData.genel.zor, raporData.genel.toplam_soru)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Branş Performansı */}
          {raporData.branslar && raporData.branslar.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Branş Bazında Performans</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branş</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ekip</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Toplam</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tamamlanan</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bekleyen</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Devam Eden</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ort. Süre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {raporData.branslar.map((brans, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{brans.brans_adi}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{brans.ekip_adi}</td>
                        <td className="px-4 py-3 text-sm text-center font-semibold">{brans.toplam_soru || 0}</td>
                        <td className="px-4 py-3 text-sm text-center text-green-600">{brans.tamamlanan || 0}</td>
                        <td className="px-4 py-3 text-sm text-center text-yellow-600">{brans.bekleyen || 0}</td>
                        <td className="px-4 py-3 text-sm text-center text-orange-600">{brans.devam_eden || 0}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                          {brans.ortalama_sure_saat ? `${brans.ortalama_sure_saat}h` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kullanıcı Performansı */}
          {raporData.kullanicilar && raporData.kullanicilar.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">En Aktif Soru Yazıcılar (Top 10)</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kullanıcı</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branş</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Oluşturulan</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tamamlanan</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Reddedilen</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Başarı %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {raporData.kullanicilar.slice(0, 10).map((kullanici, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-bold text-gray-400">{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium">{kullanici.ad_soyad}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{kullanici.brans_adi}</td>
                        <td className="px-4 py-3 text-sm text-center font-semibold">{kullanici.olusturulan_soru || 0}</td>
                        <td className="px-4 py-3 text-sm text-center text-green-600">{kullanici.tamamlanan || 0}</td>
                        <td className="px-4 py-3 text-sm text-center text-red-600">{kullanici.reddedilen || 0}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            kullanici.basari_orani >= 80 ? 'bg-green-100 text-green-800' :
                            kullanici.basari_orani >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {kullanici.basari_orani || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dizgici Performansı */}
          {raporData.dizgiciler && raporData.dizgiciler.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">En Verimli Dizgiciler (Top 10)</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-purple-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dizgici</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branş</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tamamlanan</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ort. Süre (Saat)</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Reddedilen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {raporData.dizgiciler.slice(0, 10).map((dizgici, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-bold text-gray-400">{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium">{dizgici.ad_soyad}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{dizgici.brans_adi}</td>
                        <td className="px-4 py-3 text-sm text-center font-semibold">{dizgici.tamamlanan_soru || 0}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            dizgici.ortalama_sure_saat && dizgici.ortalama_sure_saat < 24 ? 'bg-green-100 text-green-800' :
                            dizgici.ortalama_sure_saat && dizgici.ortalama_sure_saat < 48 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {dizgici.ortalama_sure_saat ? `${dizgici.ortalama_sure_saat}h` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-red-600">{dizgici.reddedilen || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Günlük Trend */}
          {raporData.trend && raporData.trend.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Günlük Aktivite Grafiği</h2>
              <div className="space-y-2">
                {raporData.trend.map((gun, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-gray-600">{formatDate(gun.tarih)}</div>
                    <div className="flex-1">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Oluşturulan: {gun.olusturulan}</div>
                          <div className="bg-blue-200 rounded-full h-3" style={{ width: `${(gun.olusturulan / Math.max(...raporData.trend.map(t => t.olusturulan || 0))) * 100}%` }}></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Tamamlanan: {gun.tamamlanan}</div>
                          <div className="bg-green-200 rounded-full h-3" style={{ width: `${(gun.tamamlanan / Math.max(...raporData.trend.map(t => t.tamamlanan || 0))) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !raporData && (
        <div className="card text-center py-12">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-600">Rapor oluşturmak için yukarıdaki ayarları yapıp "Rapor Oluştur" butonuna tıklayın</p>
        </div>
      )}
    </div>
  );
}
