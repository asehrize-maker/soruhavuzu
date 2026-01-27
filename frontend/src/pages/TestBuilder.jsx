import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    PrinterIcon,
    ChevronLeftIcon,
    ArrowsUpDownIcon,
    TrashIcon,
    DocumentArrowDownIcon,
    SparklesIcon
} from '@heroicons/react/24/outline';

export default function TestBuilder() {
    const location = useLocation();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState(location.state?.selectedQuestions || []);
    const [title, setTitle] = useState('YENİ TEST ÇIKTISI');

    useEffect(() => {
        if (questions.length === 0) {
            // If refreshed or accessed directly, try to get from somewhere or redirect
            // For now just redirect back if empty
            // navigate('/sorular');
        }
    }, [questions, navigate]);

    const handleMove = (index, direction) => {
        const newQuestions = [...questions];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= questions.length) return;

        [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
        setQuestions(newQuestions);
    };

    const handleRemove = (id) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-100 pb-20 print:bg-white print:pb-0">
            {/* TOOLBAR - Hide on print */}
            <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-50 shadow-sm print:hidden">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                        >
                            <ChevronLeftIcon className="w-6 h-6 text-gray-500" />
                        </button>
                        <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <SparklesIcon className="w-6 h-6 text-blue-600" />
                            SAYFA DÜZENLEYİCİ
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <PrinterIcon className="w-5 h-5" />
                            ÇIKTI AL / PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[210mm] mx-auto mt-10 print:mt-0 px-4 print:px-0">
                <div className="bg-white shadow-2xl min-h-[297mm] p-[20mm] print:shadow-none print:p-[10mm] rounded-[1rem] print:rounded-none">
                    {/* HEADER */}
                    <div className="border-b-2 border-black pb-6 mb-8 text-center space-y-2">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value.toUpperCase())}
                            className="text-2xl font-black text-center w-full border-none focus:ring-0 uppercase tracking-widest print:placeholder-transparent"
                            placeholder="TEST BAŞLIĞINI YAZIN"
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-600 border-t border-gray-100 pt-2 print:border-black">
                            <span>TARİH: {new Date().toLocaleDateString('tr-TR')}</span>
                            <span>AD SOYAD: ............................................................</span>
                            <span>SINIF/NO: .............</span>
                        </div>
                    </div>

                    {/* QUESTIONS */}
                    <div className="space-y-10">
                        {questions.map((soru, index) => (
                            <div key={soru.id} className="group relative break-inside-avoid">
                                {/* TOOLBAR FOR EACH QUESTION - Hide on print */}
                                <div className="absolute -left-16 top-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                                    <button onClick={() => handleMove(index, -1)} className="p-2 bg-white border rounded-lg shadow-sm hover:text-blue-600 transition-all"><ArrowsUpDownIcon className="w-4 h-4 rotate-180" /></button>
                                    <button onClick={() => handleMove(index, 1)} className="p-2 bg-white border rounded-lg shadow-sm hover:text-blue-600 transition-all"><ArrowsUpDownIcon className="w-4 h-4" /></button>
                                    <button onClick={() => handleRemove(soru.id)} className="p-2 bg-white border border-red-100 rounded-lg shadow-sm text-red-400 hover:text-red-600 transition-all"><TrashIcon className="w-4 h-4" /></button>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <span className="font-black text-lg min-w-[24px]">{index + 1}.</span>
                                        <div className="flex-1 space-y-4">
                                            {soru.soru_metni && (
                                                <div className="text-gray-800 leading-relaxed text-sm whitespace-pre-wrap font-medium">
                                                    {soru.soru_metni}
                                                </div>
                                            )}

                                            {soru.fotograf_url && (
                                                <div className={`flex ${soru.fotograf_konumu === 'sag' ? 'justify-end' : soru.fotograf_konumu === 'sol' ? 'justify-start' : 'justify-center'}`}>
                                                    <img
                                                        src={soru.fotograf_url}
                                                        alt="Soru Görseli"
                                                        className="max-h-[300px] object-contain rounded-lg border border-gray-100"
                                                    />
                                                </div>
                                            )}

                                            {/* OPTIONS */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 pt-2">
                                                {['a', 'b', 'c', 'd', 'e'].map((opt) => soru[`secenek_${opt}`] && (
                                                    <div key={opt} className="flex items-start gap-3 text-[13px]">
                                                        <span className="font-black uppercase">{opt})</span>
                                                        <span className="text-gray-700">{soru[`secenek_${opt}`]}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {questions.length === 0 && (
                            <div className="text-center py-40 text-gray-400 font-bold italic">
                                Henüz soru eklenmedi.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
