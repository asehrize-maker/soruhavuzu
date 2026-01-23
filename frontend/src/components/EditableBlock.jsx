import { useRef, useEffect, memo } from 'react';

const EditableBlock = memo(({ initialHtml, onChange, className, style, label, hangingIndent }) => {
    const ref = useRef(null);

    useEffect(() => {
        if (ref.current && ref.current.innerHTML !== initialHtml) {
            ref.current.innerHTML = initialHtml;
        }
        if (ref.current && !initialHtml) {
            setTimeout(() => { if (ref.current) ref.current.focus(); }, 50);
        }
    }, []);

    const computedStyle = {
        ...style,
        textAlign: 'left',
        hyphens: 'none',
        WebkitHyphens: 'none',
        msHyphens: 'none',
    };

    if (hangingIndent) {
        computedStyle.paddingLeft = '24px';
        computedStyle.textIndent = '-24px';
    }

    return (
        <div className="relative group/edit w-full">
            <div className="absolute -top-3 left-0 text-[10px] text-gray-500 font-bold px-1 opacity-0 group-hover/edit:opacity-100 transition pointer-events-none uppercase tracking-wider bg-white/80 rounded border shadow-sm z-20">
                {label}
            </div>
            <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                className={`outline-none min-h-[2em] p-1 border border-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition rounded ${className || ''}`}
                style={computedStyle}
                onInput={(e) => onChange(e.currentTarget.innerHTML)}
                onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    document.execCommand("insertText", false, text);
                }}
            />
        </div>
    );
}, () => true);

export default EditableBlock;
