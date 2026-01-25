import { useState, useEffect } from 'react';
import { soruAPI } from '../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  ChartBarIcon,
  ArrowDownTrayIcon,
  DocumentChartBarIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CameraIcon,
  CodeBracketIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ClockIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

export default function Raporlar() {
  const [loading, setLoading] = useState(false);
  const [raporTipi, setRaporTipi] = useState('haftalik');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [raporData, setRaporData] = useState(null);
  const [yedekLoading, setYedekLoading] = useState(false);

  useEffect(() => {
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
      const response = await soruAPI.getRapor({ baslangic, bitis, tip: raporTipi });
      setRaporData(response.data.data);
    } catch (error) {
      alert('Rapor yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!raporData) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(20);
    doc.text('Soru Havuzu Analiz Raporu', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Rapor Dönemi: ${formatDate(raporData.donem.baslangic)} - ${formatDate(raporData.donem.bitis)}`, 14, 25);
    doc.save(`rapor_${raporData.donem.baslangic}_${raporData.donem.bitis}.pdf`);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const calculatePercentage = (value, total) => {
    if (!total || total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  const downloadYedek = async () => {
    setYedekLoading(true);
    try {
      const response = await soruAPI.getYedek();
      const yedekData = response.data.data;
      const jsonStr = JSON.stringify(yedekData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soru_havuzu_yedek_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Yedek indirilirken hata oluştu');
    } finally {
      setYedekLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <DocumentChartBarIcon className="w-12 h-12 text-indigo-600" strokeWidth={2.5} />
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Analiz ve Raporlar</h1>
          </div>
          <p className="text-gray-500 font-medium">Sistemin performansını ölçün, verimlilik raporları oluşturun ve veritabanı yedeği alın.</p>
        </div>
        <button
          onClick={downloadYedek}
          disabled={yedekLoading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-8 py-4 font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-100 flex items-center gap-2 active:scale-95"
        >
          {yedekLoading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ArrowDownTrayIcon className="w-5 h-5" />}
          TAM YEDEK İNDİR (JSON)
        </button>
      </div>

      {/* FILTERS CARD */}
      <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-gray-200/50 border border-gray-50 space-y-8 animate-scale-up">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-6">
          <CalendarDaysIcon className="w-6 h-6 text-indigo-500" />
          <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase">Rapor Konfigürasyonu</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Zaman Dilimi</label>
            <select
              value={raporTipi}
              onChange={(e) => setRaporTipi(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
            >
              <option value="haftalik">Son 7 Gün (Haftalık)</option>
              <option value="aylik">Son 30 Gün (Aylık)</option>
              <option value="ozel">Özel Tarih Aralığı Belirle</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Başlangıç Tarihi</label>
            <input
              type="date"
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Bitiş Tarihi</label>
            <input
              type="date"
              value={bitis}
              onChange={(e) => setBitis(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={loadRapor}
              disabled={loading}
              className="w-full bg-gray-900 border border-black hover:bg-black text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <MagnifyingGlassIcon className="w-5 h-5" />}
              {loading ? 'ANALİZ EDİLİYOR' : 'ANALİZİ BAŞLAT'}
            </button>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      {raporData && (
        <div className="space-y-10 animate-fade-in">
          {/* STATS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-50 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-gray-900 group-hover:scale-110 transition-transform"><ChartBarIcon className="w-20 h-20" /></div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Dönem Toplamı</p>
                <h3 className="text-4xl font-black text-gray-900">{raporData.genel.toplam_soru || 0}</h3>
              </div>
            </div>
            <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-20"><CheckCircleIcon className="w-20 h-20" /></div>
              <div className="relative z-10">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Onaylanan / Tamamlanan</p>
                <h3 className="text-4xl font-black">{raporData.genel.tamamlanan || 0}</h3>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 bg-white/20 h-1 rounded-full"><div className="bg-white h-full rounded-full" style={{ width: `${calculatePercentage(raporData.genel.tamamlanan, raporData.genel.toplam_soru)}%` }}></div></div>
                  <span className="text-[10px] font-black">%{calculatePercentage(raporData.genel.tamamlanan, raporData.genel.toplam_soru)}</span>
                </div>
              </div>
            </div>
            <div className="bg-amber-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-amber-100/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-20"><ExclamationCircleIcon className="w-20 h-20" /></div>
              <div className="relative z-10">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Süreci Devam Eden</p>
                <h3 className="text-4xl font-black">{raporData.genel.devam_eden || 0}</h3>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 bg-white/20 h-1 rounded-full"><div className="bg-white h-full rounded-full" style={{ width: `${calculatePercentage(raporData.genel.devam_eden, raporData.genel.toplam_soru)}%` }}></div></div>
                  <span className="text-[10px] font-black">%{calculatePercentage(raporData.genel.devam_eden, raporData.genel.toplam_soru)}</span>
                </div>
              </div>
            </div>
            <div className="bg-rose-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-rose-100/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-20"><TrashIcon className="w-20 h-20" /></div>
              <div className="relative z-10">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Reddedilen / Silinen</p>
                <h3 className="text-4xl font-black">{raporData.genel.reddedilen || 0}</h3>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 bg-white/20 h-1 rounded-full"><div className="bg-white h-full rounded-full" style={{ width: `${calculatePercentage(raporData.genel.reddedilen, raporData.genel.toplam_soru)}%` }}></div></div>
                  <span className="text-[10px] font-black">%{calculatePercentage(raporData.genel.reddedilen, raporData.genel.toplam_soru)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* BRANCH PERFORMANCE */}
            <div className="bg-white rounded-[3rem] shadow-xl shadow-gray-200/50 border border-gray-50 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3"><AcademicCapIcon className="w-6 h-6 text-blue-500" /> Branş Bazlı Verimlilik</h3>
                {raporData && <button onClick={exportToPDF} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors shadow-sm"><ArrowDownTrayIcon className="w-5 h-5 text-gray-400" /></button>}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-50">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Branş</th>
                      <th className="px-4 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Toplam</th>
                      <th className="px-4 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Başarı %</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Ort. Süre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {raporData.branslar.map((brans, i) => (
                      <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="text-sm font-black text-gray-900">{brans.brans_adi}</div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{brans.ekip_adi || 'Genel'}</div>
                        </td>
                        <td className="px-4 py-5 text-center text-sm font-black text-gray-700">{brans.toplam_soru || 0}</td>
                        <td className="px-4 py-5 text-center">
                          <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-100">%{calculatePercentage(brans.tamamlanan, brans.toplam_soru)}</span>
                        </td>
                        <td className="px-8 py-5 text-right text-xs font-bold text-gray-500 italic">
                          {brans.ortalama_sure_saat ? `${brans.ortalama_sure_saat} Saat` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PERSONNEL PERFORMANCE */}
            <div className="bg-white rounded-[3rem] shadow-xl shadow-gray-200/50 border border-gray-50 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3"><UserGroupIcon className="w-6 h-6 text-indigo-500" /> Personel Skor Tablosu</h3>
                <div className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black tracking-widest">TOP 10</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-50">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Personel</th>
                      <th className="px-4 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Üretim</th>
                      <th className="px-4 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Kalite %</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {raporData.kullanicilar.slice(0, 10).map((k, i) => (
                      <tr key={i} className="hover:bg-indigo-50/20 transition-colors group">
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="text-sm font-black text-gray-900">{k.ad_soyad}</div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{k.brans_adi}</div>
                        </td>
                        <td className="px-4 py-5 text-center text-sm font-black text-gray-700">{k.olusturulan_soru || 0}</td>
                        <td className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-black text-gray-900">%{k.basari_orani || 0}</span>
                            <div className="w-12 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden"><div className={`h-full ${k.basari_orani >= 80 ? 'bg-emerald-500' : k.basari_orani >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${k.basari_orani}%` }}></div></div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity">PROBİS SKOR</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* CONTENT ANALYTICS */}
            <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-gray-200/50 border border-gray-50">
              <h3 className="text-xl font-black text-gray-900 tracking-tight mb-8 flex items-center gap-3"><SparklesIcon className="w-6 h-6 text-amber-500" /> İçerik Analitiği</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 flex flex-col items-center text-center">
                  <CameraIcon className="w-10 h-10 text-purple-400 mb-4" />
                  <span className="text-3xl font-black text-gray-900">{raporData.genel.fotografli || 0}</span>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Görsel İçerik</span>
                </div>
                <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 flex flex-col items-center text-center">
                  <CodeBracketIcon className="w-10 h-10 text-indigo-400 mb-4" />
                  <span className="text-3xl font-black text-gray-900">{raporData.genel.latexli || 0}</span>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">LaTeX Formül</span>
                </div>
              </div>
            </div>

            {/* TYPESETTER PERFORMANCE */}
            <div className="bg-white rounded-[3rem] shadow-xl shadow-gray-200/50 border border-gray-50 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3"><ClockIcon className="w-6 h-6 text-rose-500" /> Dizgi Kalite Kontrol</h3>
                <div className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black tracking-widest">DİZGİ VERİMLİLİĞİ</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-50">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Dizgici</th>
                      <th className="px-4 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Teslimat</th>
                      <th className="px-4 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Hata Oranı</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Süre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {raporData.dizgiciler.slice(0, 10).map((d, i) => (
                      <tr key={i} className="hover:bg-rose-50/20 transition-colors group">
                        <td className="px-8 py-5 whitespace-nowrap">
                          <div className="text-sm font-black text-gray-900">{d.ad_soyad}</div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.brans_adi}</div>
                        </td>
                        <td className="px-4 py-5 text-center text-sm font-black text-gray-700">{d.tamamlanan_soru || 0}</td>
                        <td className="px-4 py-5 text-center">
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl border ${d.reddedilen > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                            {d.reddedilen || 0} HATA
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right text-xs font-bold text-gray-500 italic">
                          {d.ortalama_sure_saat ? `${d.ortalama_sure_saat}s` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !raporData && (
        <div className="bg-white p-32 rounded-[3.5rem] shadow-xl shadow-gray-200/30 text-center border border-gray-50 space-y-6">
          <ChartBarIcon className="w-20 h-20 text-gray-100 mx-auto" strokeWidth={1} />
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-gray-300 uppercase tracking-[0.2em]">Analiz Bekleniyor</h3>
            <p className="text-gray-300 font-bold uppercase tracking-widest text-xs italic">Tarih aralığı seçip analizi başlatın.</p>
          </div>
        </div>
      )}
    </div>
  );
}
