import React from 'react';

const MetadataForm = ({
    values,
    onChange,
    branslar,
    kazanims,
    kazanimLoading,
    disabled = false,
    className = '',
    allowManualKazanim = false,
    gridCols = 'grid-cols-1 md:grid-cols-5',
    hideBrans = false
}) => {
    const handleChange = (field, value) => {
        if (allowManualKazanim && field === 'kazanim') {
            if (value === '__manuel') {
                onChange({ ...values, kazanim: '', kazanim_is_custom: true });
                return;
            }
            if (values.kazanim_is_custom && value !== '__manuel' && value !== '') {
                // Switching back from manual to a selected option
                onChange({ ...values, kazanim: value, kazanim_is_custom: false });
                return;
            }
        }
        onChange({ ...values, [field]: value });
    };

    const handleManualKazanimChange = (e) => {
        onChange({ ...values, kazanim: e.target.value, kazanim_is_custom: true });
    }

    return (
        <div className={`bg-white border rounded shadow-sm p-4 grid gap-4 ${gridCols} ${className}`}>
            {!hideBrans ? (
                <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Branş</label>
                    <select
                        className="w-full border p-2 rounded text-xs bg-gray-50 focus:bg-white transition"
                        value={values.brans_id || ''}
                        onChange={e => handleChange('brans_id', e.target.value)}
                        disabled={disabled}
                    >
                        <option value="">Seçiniz</option>
                        {branslar.map(b => (
                            <option key={b.id} value={b.id}>{b.brans_adi}</option>
                        ))}
                    </select>
                </div>
            ) : values.brans_id ? (
                <div className="flex flex-col bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                    <label className="text-[10px] font-black text-blue-400 uppercase mb-1 tracking-widest">AKTİF BRANŞ</label>
                    <span className="text-xs font-black text-blue-700">{branslar.find(b => String(b.id) === String(values.brans_id))?.brans_adi || 'Atanmış Branş'}</span>
                </div>
            ) : null}

            <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Doğru Cevap</label>
                <div className="flex gap-2 flex-wrap">
                    {['A', 'B', 'C', 'D', 'E'].map(opt => (
                        <button
                            key={opt}
                            onClick={() => !disabled && handleChange('dogruCevap', opt)}
                            className={`w-8 h-8 rounded-full border font-bold text-xs transition flex items-center justify-center shrink-0 ${values.dogruCevap === opt ? 'bg-blue-600 text-white shadow-md scale-110' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={disabled}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Kazanım</label>
                {kazanimLoading ? (
                    <div className="text-[11px] text-gray-500 mt-1">Kazanımlar yükleniyor...</div>
                ) : (
                    <>
                        {(kazanims.length > 0 || !allowManualKazanim) ? (
                            <select
                                className="w-full border p-2 rounded text-xs bg-gray-50 focus:bg-white transition"
                                value={(allowManualKazanim && values.kazanim_is_custom) ? '__manuel' : (values.kazanim || '')}
                                onChange={e => handleChange('kazanim', e.target.value)}
                                disabled={disabled || !values.brans_id || (kazanims.length === 0 && !allowManualKazanim)}
                            >
                                {!values.brans_id && <option value="">Önce branş seçin</option>}
                                {values.brans_id && kazanims.length === 0 && !allowManualKazanim && <option value="">Bu branşta kazanım yok</option>}
                                {values.brans_id && kazanims.length > 0 && <option value="">Seçiniz</option>}
                                {kazanims.map(k => (
                                    <option key={k.id} value={k.kod}>
                                        {k.kod} - {k.aciklama}
                                    </option>
                                ))}
                                {allowManualKazanim && values.brans_id && <option value="__manuel">Diğer / Manuel gir</option>}
                            </select>
                        ) : (
                            <input
                                type="text"
                                className="w-full border p-2 rounded bg-white text-sm"
                                placeholder="Kazanımı manuel girin"
                                value={values.kazanim || ''}
                                onChange={handleManualKazanimChange}
                                disabled={!values.brans_id || disabled}
                            />
                        )}

                        {allowManualKazanim && values.kazanim_is_custom && kazanims.length > 0 && (
                            <input
                                type="text"
                                className="w-full border p-2 rounded bg-white text-sm mt-2"
                                placeholder="Kazanım kodunu/metnini manuel girin"
                                value={values.kazanim || ''}
                                onChange={handleManualKazanimChange}
                                disabled={disabled}
                                autoFocus
                            />
                        )}
                    </>
                )}
            </div>

            <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Zorluk</label>
                <select
                    className="w-full border p-2 rounded text-xs bg-gray-50 focus:bg-white transition"
                    value={values.zorluk || '3'}
                    onChange={e => handleChange('zorluk', e.target.value)}
                    disabled={disabled}
                >
                    <option value="1">1 (Çok Kolay)</option>
                    <option value="2">2 (Kolay)</option>
                    <option value="3">3 (Orta)</option>
                    <option value="4">4 (Zor)</option>
                    <option value="5">5 (Çok Zor)</option>
                </select>
            </div>

            <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Kategori</label>
                <select
                    className="w-full border p-2 rounded text-xs bg-gray-50 focus:bg-white transition"
                    value={values.kategori || 'deneme'}
                    onChange={e => handleChange('kategori', e.target.value)}
                    disabled={disabled}
                >
                    <option value="deneme">Deneme</option>
                    <option value="fasikul">Fasikül</option>
                    <option value="yaprak_test">Yaprak Test</option>
                </select>
            </div>


        </div>
    );
};

export default MetadataForm;
