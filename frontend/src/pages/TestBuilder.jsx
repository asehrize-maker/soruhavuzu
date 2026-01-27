import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    PrinterIcon,
    ChevronLeftIcon,
    TrashIcon,
    SparklesIcon,
    ViewColumnsIcon,
    QueueListIcon,
    HandRaisedIcon
} from '@heroicons/react/24/outline';

export default function TestBuilder() {
    const location = useLocation();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState(location.state?.selectedQuestions || []);
    const [title, setTitle] = useState('SORU SİSTEMİ TEST ÇIKTISI');
    const [layout, setLayout] = useState('single'); // 'single' or 'double'
    const [draggedIndex, setDraggedIndex] = useState(null);

    useEffect(() => {
        if (questions.length === 0) {
            // If refreshed or accessed directly, the user might want to go back
        }
    }, [questions]);

    // Drag and Drop Logic
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

    // Helper to render HTML content safely (fixes the HTML tags appearing as text)
    const renderContent = (content) => {
        if (!content) return null;
        // If content contains HTML tags, render it as HTML
        if (content.includes('<') && content.includes('>')) {
            return <div className="q-html-content" dangerouslySetInnerHTML={{ __html: content }} />;
        }
        return <div className="whitespace-pre-wrap">{content}</div>;
    };

    return (
        <div className="min-h-screen bg-slate-100 pb-20 print:bg-white print:pb-0">
            {/* TOOLBAR - Hide on print */}
            <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-50 shadow-sm print:hidden">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-3 hover:bg-gray-100 rounded-2xl transition-all"
                        >
                            <ChevronLeftIcon className="w-6 h-6 text-gray-500" strokeWidth={2.5} />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                <SparklesIcon className="w-6 h-6 text-blue-600" />
                                SAYFA DÜZENLEYİCİ
                            </h1>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Sürükle bırak ile yerlerini ayarla</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
                        <button
                            onClick={() => setLayout('single')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${layout === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <QueueListIcon className="w-4 h-4" /> TEK SÜTUN
                        </button>
                        <button
                            onClick={() => setLayout('double')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${layout === 'double' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <ViewColumnsIcon className="w-4 h-4" /> ÇİFT SÜTUN
                        </button>
                    </div>

                    <button
                        onClick={handlePrint}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <PrinterIcon className="w-5 h-5" strokeWidth={2.5} />
                        ÇIKTI AL / PDF
                    </button>
                </div>
            </div>

            <div className="max-w-[210mm] mx-auto mt-12 print:mt-0 px-4 print:px-0">
                {/* PAGE CONTENT */}
                <div className="bg-white shadow-[0_35px_60px_-15px_rgba(0,0,0,0.1)] min-h-[297mm] p-[15mm] print:shadow-none print:p-[10mm] rounded-[2rem] print:rounded-none transition-all duration-500">

                    {/* EXAM HEADER */}
                    <div className="border-b-4 border-black pb-8 mb-10 text-center space-y-3 relative">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value.toUpperCase())}
                            className="text-3xl font-black text-center w-full border-none focus:ring-0 uppercase tracking-widest print:placeholder-transparent leading-tight"
                            placeholder="TEST BAŞLIĞINI YAZIN"
                        />
                        <div className="grid grid-cols-3 text-[11px] font-black text-black border-t-2 border-dashed border-black pt-4 px-4">
                            <div className="text-left space-y-1">
                                <div>TARİH: {new Date().toLocaleDateString('tr-TR')}</div>
                                <div>SINAV SÜRESİ: ........ Dakika</div>
                            </div>
                            <div className="text-center">
                                <div className="bg-black text-white px-4 py-1.5 rounded-full inline-block mb-1">OPTİK FORM NO: ........</div>
                                <div className="italic font-bold">Başarılar Dileriz.</div>
                            </div>
                            <div className="text-right space-y-1">
                                <div>AD SOYAD: .......................................</div>
                                <div>SINIF / NO: ................. / .................</div>
                            </div>
                        </div>
                    </div>

                    {/* QUESTIONS CONTAINER */}
                    <div className={`
            ${layout === 'double' ? 'columns-2 gap-12' : 'space-y-12'} 
            transition-all duration-500
          `}>
                        {questions.map((soru, index) => (
                            <div
                                key={soru.id}
                                draggable="true"
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`
                  group relative break-inside-avoid mb-10 p-2 rounded-xl border border-transparent hover:border-blue-100 transition-all cursor-move
                  ${draggedIndex === index ? 'opacity-30 border-dashed border-blue-400 bg-blue-50' : ''}
                `}
                            >
                                {/* INTERACTIVE CONTROLS - Hide on print */}
                                <div className="absolute -left-12 top-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                                    <div className="bg-white p-2 border rounded-xl shadow-lg text-blue-600 flex flex-col gap-2">
                                        <HandRaisedIcon className="w-5 h-5 cursor-grab active:cursor-grabbing" title="Sürükle" />
                                        <button
                                            onClick={() => handleRemove(soru.id)}
                                            className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-lg transition-all"
                                            title="Kaldır"
                                        >
                                            <TrashIcon className="w-4 h-4" strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">


                                    <div className="flex-1 space-y-5 overflow-hidden">
                                        {/* QUESTION TEXT - Proper HTML rendering */}
                                        <div className="text-gray-900 leading-relaxed text-sm font-semibold">
                                            {renderContent(soru.soru_metni)}
                                        </div>

                                        {/* IMAGE HANDLING */}
                                        {soru.fotograf_url && (
                                            <div className={`
                        flex w-full
                        ${soru.fotograf_konumu === 'sag' ? 'justify-end' : soru.fotograf_konumu === 'sol' ? 'justify-start' : 'justify-center'}
                      `}>
                                                <img
                                                    src={soru.fotograf_url}
                                                    alt="Soru"
                                                    className="max-h-[350px] max-w-full object-contain rounded-xl shadow-sm border border-gray-100"
                                                />
                                            </div>
                                        )}

                                        {/* OPTIONS */}
                                        <div className={`
                      grid gap-x-8 gap-y-4 pt-4
                      ${layout === 'double' ? 'grid-cols-1' : 'grid-cols-2'}
                    `}>
                                            {['a', 'b', 'c', 'd', 'e'].map((opt) => soru[`secenek_${opt}`] && (
                                                <div key={opt} className="flex items-start gap-3 text-[13px] pb-2">
                                                    <span className="font-black uppercase w-6 h-6 rounded-md border-2 border-black flex items-center justify-center text-[10px] shrink-0">{opt}</span>
                                                    <span className="text-gray-800 font-medium">{soru[`secenek_${opt}`]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {questions.length === 0 && (
                            <div className="text-center py-40">
                                <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Sayfada hiç soru kalmadı.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
