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
    PlusIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';

export default function TestBuilder() {
    const location = useLocation();
    const navigate = useNavigate();

    // Sorular ya yan menüde (unplaced) ya da kağıtta (placed) olacak
    const [unplacedQuestions, setUnplacedQuestions] = useState(location.state?.selectedQuestions || []);
    const [placedQuestions, setPlacedQuestions] = useState([]);

    const [title, setTitle] = useState('SORU SİSTEMİ TEST ÇIKTISI');
    const [layout, setLayout] = useState('single'); // 'single' or 'double'
    const [scale, setScale] = useState(100);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Sürükle bırak state'leri
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragSource, setDragSource] = useState(null); // 'sidebar' or 'canvas'

    const handleDragStart = (item, source, index) => {
        setDraggedItem({ item, index });
        setDragSource(source);
    };

    const handleDropOnCanvas = (e) => {
        e.preventDefault();
        if (!draggedItem) return;

        if (dragSource === 'sidebar') {
            // Yan menüden kağıda ekle
            setPlacedQuestions([...placedQuestions, draggedItem.item]);
            setUnplacedQuestions(unplacedQuestions.filter(q => q.id !== draggedItem.item.id));
        }
        setDraggedItem(null);
        setDragSource(null);
    };

    const handleReorderOnCanvas = (e, targetIndex) => {
        e.preventDefault();
        if (dragSource !== 'canvas') return;

        const newPlaced = [...placedQuestions];
        const itemToMove = newPlaced[draggedItem.index];
        newPlaced.splice(draggedItem.index, 1);
        newPlaced.splice(targetIndex, 0, itemToMove);
        setPlacedQuestions(newPlaced);
    };

    const removeFromCanvas = (soruId) => {
        const soru = placedQuestions.find(q => q.id === soruId);
        setPlacedQuestions(placedQuestions.filter(q => q.id !== soruId));
        setUnplacedQuestions([...unplacedQuestions, soru]);
    };

    const handlePrint = () => {
        window.print();
    };

    const renderSoruContent = (soru) => {
        if (soru.final_png_url) {
            return (
                <div className="w-full flex justify-center py-2">
                    <img
                        src={soru.final_png_url}
                        alt="Soru"
                        className="max-w-full h-auto object-contain"
                        style={{ width: `${scale}%` }}
                        draggable={false}
                    />
                </div>
            );
        }
        return (
            <div className="space-y-4 p-2">
                <div className="text-gray-900 font-semibold text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                {soru.fotograf_url && (
                    <div className="flex justify-center">
                        <img src={soru.fotograf_url} className="max-h-60 max-w-full rounded-lg shadow-sm" alt="Görsel" />
                    </div>
                )}
                <div className={`grid gap-2 mt-4 ${layout === 'double' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {['a', 'b', 'c', 'd', 'e'].map(opt => soru[`secenek_${opt}`] && (
                        <div key={opt} className="flex items-center gap-2 text-xs">
                            <span className="w-5 h-5 border border-black rounded flex items-center justify-center font-bold uppercase shrink-0">{opt}</span>
                            <span>{soru[`secenek_${opt}`]}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="h-screen bg-[#f1f5f9] flex flex-col overflow-hidden print:bg-white print:h-auto print:overflow-visible">
            {/* ÜST ARAÇ ÇUBUĞU */}
            <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-[100] print:hidden shrink-0">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate(-1)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                        <ChevronLeftIcon className="w-6 h-6 text-slate-500" strokeWidth={2.5} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <SparklesIcon className="w-6 h-6 text-blue-600" /> SAYFA TASARLAYICI
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Soruları A4 üzerine sürükleyerek yerleştir</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Layout Seçimi */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button onClick={() => setLayout('single')} className={`flex items-center gap-2 px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${layout === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            <QueueListIcon className="w-4 h-4" /> TEK SÜTUN
                        </button>
                        <button onClick={() => setLayout('double')} className={`flex items-center gap-2 px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${layout === 'double' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            <ViewColumnsIcon className="w-4 h-4" /> ÇİFT SÜTUN
                        </button>
                    </div>

                    {/* Ölçekleme */}
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2">
                        <button onClick={() => setScale(Math.max(30, scale - 10))} className="p-1 hover:bg-slate-50 rounded"><ArrowsPointingInIcon className="w-4 h-4 text-slate-500" /></button>
                        <span className="text-[10px] font-black w-8 text-center text-slate-600">%{scale}</span>
                        <button onClick={() => setScale(Math.min(150, scale + 10))} className="p-1 hover:bg-slate-50 rounded"><ArrowsPointingOutIcon className="w-4 h-4 text-slate-500" /></button>
                    </div>

                    <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center gap-2">
                        <PrinterIcon className="w-5 h-5" /> YAZDIR / PDF
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden print:block print:overflow-visible">
                {/* SOL PANEL - SEÇİLEN SORULAR */}
                <aside className={`w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0 print:hidden transition-all duration-300 ${isSidebarOpen ? '' : '-ml-[320px]'}`}>
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h2 className="font-black text-xs text-slate-800 uppercase tracking-widest">BEKLEYEN SORULAR ({unplacedQuestions.length})</h2>
                        <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-5 h-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {unplacedQuestions.length === 0 && placedQuestions.length > 0 ? (
                            <div className="text-center py-10 px-6 border-2 border-dashed border-slate-100 rounded-2xl">
                                <p className="text-[10px] font-black text-slate-300 uppercase leading-relaxed">Tüm sorular kağıda yerleştirildi.</p>
                            </div>
                        ) : unplacedQuestions.map((soru) => (
                            <div
                                key={soru.id}
                                draggable="true"
                                onDragStart={() => handleDragStart(soru, 'sidebar')}
                                className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-grab active:cursor-grabbing group"
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="text-[11px] font-bold text-slate-700 line-clamp-2" dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                                    <PlusIcon className="w-4 h-4 text-slate-300 group-hover:text-blue-500 shrink-0" />
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase">{soru.brans_adi}</span>
                                    {soru.final_png_url && <span className="text-[8px] font-black bg-green-50 text-green-600 px-2 py-0.5 rounded uppercase">DİZGİLİ</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* MERKEZ - A4 KAĞIDI */}
                <main className="flex-1 overflow-y-auto bg-slate-200/50 p-12 custom-scrollbar print:p-0 print:bg-white print:overflow-visible relative">
                    {!isSidebarOpen && (
                        <button onClick={() => setIsSidebarOpen(true)} className="fixed left-6 top-24 bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-slate-600 hover:text-blue-600 print:hidden z-10 transition-transform active:scale-95">
                            <QueueListIcon className="w-6 h-6" />
                        </button>
                    )}

                    <div
                        className="max-w-[210mm] mx-auto bg-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] min-h-[297mm] p-[15mm] print:shadow-none print:p-[10mm] print:w-[210mm] relative transition-all duration-500 rounded-[2px]"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDropOnCanvas}
                    >
                        {/* Sayfa Ayırıcı Çizgi (Çift Sütun İçin) */}
                        {layout === 'double' && (
                            <div className="absolute left-1/2 -ml-[1px] top-[15mm] bottom-[15mm] w-0 border-l border-dashed border-slate-200 hidden md:block print:block"></div>
                        )}

                        {/* Sınav Başlığı */}
                        <div className="text-center mb-10 border-b-2 border-slate-800 pb-6 group">
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value.toUpperCase())}
                                className="text-3xl font-black text-center w-full border-none focus:ring-0 uppercase tracking-widest bg-transparent p-0"
                                placeholder="SINAV BAŞLIĞI YAZINIZ"
                            />
                            <div className="grid grid-cols-3 text-[10px] font-bold text-slate-600 mt-6 pt-4 border-t border-slate-100">
                                <div className="text-left space-y-1">
                                    <div>TARİH: {new Date().toLocaleDateString('tr-TR')}</div>
                                    <div>SINAV SÜRESİ: ........ Dakika</div>
                                </div>
                                <div className="text-center italic">Başarılar Dileriz.</div>
                                <div className="text-right space-y-1 uppercase">
                                    <div>AD SOYAD: .................................</div>
                                    <div>SINIF / NO: ......... / .........</div>
                                </div>
                            </div>
                        </div>

                        {/* Soruların Dizildiği Alan */}
                        <div className={`
                            ${layout === 'double' ? 'columns-2 gap-[15mm]' : 'space-y-12'}
                            transition-all duration-500
                        `}>
                            {placedQuestions.length === 0 && (
                                <div className="py-40 text-center border-4 border-dashed border-slate-50 rounded-[3rem] animate-pulse">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-slate-100">
                                        <HandRaisedIcon className="w-10 h-10 text-slate-200" />
                                    </div>
                                    <p className="text-sm font-black text-slate-300 uppercase tracking-widest leading-relaxed">
                                        Soruları buraya sürükleyin <br /> <span className="text-[10px] font-bold">SOL PANELDEKİ LİSTEYİ KULLANIN</span>
                                    </p>
                                </div>
                            )}

                            {placedQuestions.map((soru, index) => (
                                <div
                                    key={`placed-${soru.id}-${index}`}
                                    draggable="true"
                                    onDragStart={() => handleDragStart(soru, 'canvas', index)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleReorderOnCanvas(e, index)}
                                    className={`
                                        group relative break-inside-avoid-column mb-10 p-4 rounded-xl border-2 border-transparent transition-all cursor-move
                                        ${dragSource === 'canvas' && draggedItem?.index === index ? 'opacity-20 border-blue-400 border-dashed bg-blue-50 scale-95' : 'hover:border-blue-50 hover:bg-slate-50/10'}
                                    `}
                                >
                                    {/* Silme Butonu */}
                                    <button
                                        onClick={() => removeFromCanvas(soru.id)}
                                        className="absolute -left-12 top-2 p-3 bg-white border border-slate-200 text-rose-500 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 print:hidden"
                                        title="Kaldır"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>

                                    <div className="flex gap-4">
                                        <div className="shrink-0">
                                            <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">{index + 1}</span>
                                        </div>
                                        <div className="flex-1 w-full overflow-hidden">
                                            {renderSoruContent(soru)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>

            {/* Print Overrides */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4; margin: 0; }
                    body { background: white !important; margin: 0; padding: 0; }
                    .print\\:hidden { display: none !important; }
                    .print\\:p-0 { padding: 0 !important; }
                    .max-w-\\[210mm\\] { width: 210mm !important; margin: 0 !important; max-width: none !important; }
                    .min-h-\\[297mm\\] { height: auto !important; min-height: 0 !important; overflow: visible !important; }
                    .columns-2 { column-count: 2 !important; column-gap: 15mm !important; }
                    .break-inside-avoid-column { break-inside: avoid-column !important; page-break-inside: avoid !important; }
                }
            ` }} />
        </div>
    );
}
