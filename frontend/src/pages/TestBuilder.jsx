import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    PrinterIcon,
    ChevronLeftIcon,
    TrashIcon,
    SparklesIcon,
    ViewColumnsIcon,
    QueueListIcon,
    HandRaisedIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

export default function TestBuilder() {
    const location = useLocation();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState(location.state?.selectedQuestions || []);
    const [title, setTitle] = useState('SORU SİSTEMİ TEST ÇIKTISI');
    const [layout, setLayout] = useState('single'); // 'single' or 'double'
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [scale, setScale] = useState(100);
    const [showOptions, setShowOptions] = useState(true);

    useEffect(() => {
        if (questions.length === 0) {
            // Check if there are questions in local storage or something?
            // For now, if empty, just show empty state
        }
    }, [questions]);

    const handleDragStart = (index) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newQuestions = [...questions];
        const itemToMove = newQuestions[draggedIndex];
        newQuestions.splice(draggedIndex, 1);
        newQuestions.splice(index, 0, itemToMove);

        setDraggedIndex(index);
        setQuestions(newQuestions);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleRemove = (id) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const handlePrint = () => {
        window.print();
    };

    const renderSoruContent = (soru) => {
        // Öncelik Final PNG'de (Dizgisi yapılmış soru)
        if (soru.final_png_url) {
            return (
                <div className="w-full flex justify-center">
                    <img
                        src={soru.final_png_url}
                        alt="Soru PNG"
                        className="max-w-full h-auto object-contain transition-all duration-300"
                        style={{ width: `${scale}%` }}
                        draggable={false}
                    />
                </div>
            );
        }

        // Eğer PNG yoksa metin ve orijinal görseli göster
        return (
            <div className="space-y-4">
                <div
                    className="text-gray-900 leading-relaxed text-sm font-semibold q-html-content"
                    dangerouslySetInnerHTML={{ __html: soru.soru_metni }}
                />

                {soru.fotograf_url && (
                    <div className={`flex w-full ${soru.fotograf_konumu === 'sag' ? 'justify-end' : soru.fotograf_konumu === 'sol' ? 'justify-start' : 'justify-center'}`}>
                        <img
                            src={soru.fotograf_url}
                            alt="Soru Görsel"
                            className="max-h-[300px] max-w-full object-contain rounded-lg"
                            draggable={false}
                        />
                    </div>
                )}

                <div className={`grid gap-x-8 gap-y-3 mt-4 ${layout === 'double' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {['a', 'b', 'c', 'd', 'e'].map((opt) => soru[`secenek_${opt}`] && (
                        <div key={opt} className="flex items-start gap-2 text-xs">
                            <span className="font-bold border border-black rounded w-5 h-5 flex items-center justify-center shrink-0 uppercase">{opt}</span>
                            <span>{soru[`secenek_${opt}`]}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20 print:bg-white print:pb-0 font-sans">
            {/* TOOLBAR */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 p-4 sticky top-0 z-50 shadow-sm print:hidden">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-3 hover:bg-slate-100 rounded-2xl transition-all border border-transparent hover:border-slate-200"
                        >
                            <ChevronLeftIcon className="w-6 h-6 text-slate-500" strokeWidth={2.5} />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <SparklesIcon className="w-8 h-8 text-blue-600 animate-pulse" />
                                SAYFA TASARLAYICI
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{questions.length} SORU SEÇİLDİ</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Layout Toggle */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                            <button
                                onClick={() => setLayout('single')}
                                title="Tek Sütun Yerleşim (A4 Tam)"
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${layout === 'single' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                <QueueListIcon className="w-4 h-4" /> TEK SÜTUN
                            </button>
                            <button
                                onClick={() => setLayout('double')}
                                title="Çift Sütun Yerleşim (Sayfayı İkiye Böl)"
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${layout === 'double' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                <ViewColumnsIcon className="w-4 h-4" /> ÇİFT SÜTUN
                            </button>
                        </div>

                        {/* Scale Control */}
                        <div className="flex items-center gap-4 px-6 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
                            <AdjustmentsHorizontalIcon className="w-5 h-5 text-slate-400" />
                            <div className="flex items-center gap-3">
                                <button onClick={() => setScale(Math.max(30, scale - 10))} className="p-1 hover:bg-slate-200 rounded-lg transition-colors"><ArrowsPointingInIcon className="w-4 h-4" /></button>
                                <span className="text-[10px] font-black w-10 text-center text-slate-600">%{scale}</span>
                                <button onClick={() => setScale(Math.min(150, scale + 10))} className="p-1 hover:bg-slate-200 rounded-lg transition-colors"><ArrowsPointingOutIcon className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center gap-3 hover:-translate-y-0.5"
                        >
                            <PrinterIcon className="w-5 h-5" strokeWidth={2.5} />
                            YAZDIR / PDF KAYDET
                        </button>
                    </div>
                </div>
            </div>

            {/* A4 CANVAS CONTAINER */}
            <div className="max-w-[210mm] mx-auto mt-12 mb-20 print:mt-0 print:mb-0 px-4 print:px-0 scroll-mt-24">
                <div className="bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] min-h-[297mm] p-[15mm] print:shadow-none print:p-[10mm] rounded-[3rem] print:rounded-none relative transition-all duration-700 border border-white">

                    {/* EXAM HEADER */}
                    <div className="border-b-[3px] border-black pb-8 mb-12 text-center relative group">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value.toUpperCase())}
                            className="text-4xl font-black text-center w-full border-none focus:ring-0 uppercase tracking-[0.1em] print:placeholder-transparent leading-tight bg-transparent"
                            placeholder="SINAV / TEST BAŞLIĞI"
                        />
                        <div className="grid grid-cols-3 text-[10px] font-black text-black border-t-2 border-black/10 mt-6 pt-6 px-4">
                            <div className="text-left space-y-2 uppercase tracking-tighter">
                                <div>TARİH: <span className="font-normal">{new Date().toLocaleDateString('tr-TR')}</span></div>
                                <div>SÜRE: <span className="font-normal">........ DAKİKA</span></div>
                            </div>
                            <div className="text-center flex flex-col items-center">
                                <div className="bg-black text-white px-6 py-2 rounded-full font-black text-[9px] mb-2 shadow-lg">OPTİK NO: ........</div>
                                <div className="italic font-bold text-slate-500">BOL ŞANSLAR!</div>
                            </div>
                            <div className="text-right space-y-2 uppercase tracking-tighter">
                                <div>AD SOYAD: .......................................</div>
                                <div>SINIF / NO: ................. / .................</div>
                            </div>
                        </div>
                        <div className="absolute inset-0 bg-blue-50/0 group-hover:bg-blue-50/5 transition-colors -m-4 pointer-events-none rounded-2xl"></div>
                    </div>

                    {/* QUESTIONS BODY */}
                    <div className={`
                        relative
                        ${layout === 'double' ? 'columns-2 gap-[15mm]' : 'space-y-12'}
                        transition-all duration-500
                    `}>
                        {/* Vertical line for double layout */}
                        {layout === 'double' && (
                            <div className="absolute left-1/2 -ml-[2px] top-0 bottom-0 w-[1px] border-l-2 border-dashed border-slate-200 print:border-slate-300 hidden md:block"></div>
                        )}

                        {questions.map((soru, index) => (
                            <div
                                key={soru.id}
                                draggable="true"
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`
                                    group relative break-inside-avoid-column p-4 rounded-2xl border-2 border-transparent hover:border-blue-100 hover:bg-blue-50/30 transition-all cursor-move
                                    ${draggedIndex === index ? 'opacity-30 border-blue-400 border-dashed bg-blue-50 scale-95' : ''}
                                `}
                            >
                                {/* INTERACTIVE TOOLS (HIDDEN ON PRINT) */}
                                <div className="absolute -left-14 top-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all print:hidden z-10">
                                    <div className="bg-white p-2 border-2 border-blue-100 rounded-2xl shadow-2xl text-blue-600 flex flex-col gap-2 scale-90 group-hover:scale-100 transition-transform">
                                        <HandRaisedIcon className="w-6 h-6 cursor-grab active:cursor-grabbing hover:bg-blue-50 p-1 rounded-lg" title="Sürükle" />
                                        <button
                                            onClick={() => handleRemove(soru.id)}
                                            className="p-1 hover:bg-rose-50 text-rose-400 hover:text-rose-500 rounded-lg transition-all"
                                            title="Kaldır"
                                        >
                                            <TrashIcon className="w-6 h-6" strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                {/* QUESTION NUMBER */}
                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 flex flex-col items-center">
                                        <span className="w-10 h-10 rounded-2xl bg-slate-900 shadow-xl text-white flex items-center justify-center font-black text-sm group-hover:bg-blue-600 transition-colors">
                                            {index + 1}
                                        </span>
                                    </div>

                                    <div className="flex-1 w-full overflow-hidden">
                                        {renderSoruContent(soru)}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {questions.length === 0 && (
                            <div className="text-center py-60 space-y-6">
                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-slate-200">
                                    <SparklesIcon className="w-10 h-10 text-slate-200" />
                                </div>
                                <div>
                                    <p className="text-xl font-black text-slate-300 uppercase tracking-[0.2em]">Sayfa Tasarımı Boş</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Geri dönüp yeni sorular seçebilirsiniz.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* FOOTER */}
                    <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Sayfa {1} / {1} - Bu çıktı otomatik olarak Soru Havuzu sistemi tarafından üretilmiştir.</p>
                    </div>
                </div>
            </div>

            {/* PRINT CSS OVERRIDES */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .print\\:hidden { display: none !important; }
                    .max-w-[210mm] {
                        max-width: none !important;
                        width: 210mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    div { border-color: black !important; }
                    .columns-2 {
                        column-count: 2 !important;
                        column-gap: 15mm !important;
                    }
                    .break-inside-avoid-column {
                        break-inside: avoid-column !important;
                        page-break-inside: avoid !important;
                    }
                    /* Ensure final png urls are visible */
                    img { display: block !important; }
                }
            ` }} />
        </div>
    );
}
