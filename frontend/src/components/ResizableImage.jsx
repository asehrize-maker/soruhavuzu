import { useState, useRef } from 'react';
import {
    ArrowsPointingOutIcon,
    TrashIcon,
    Bars3BottomLeftIcon,
    Bars3Icon,
    Bars3BottomRightIcon,
} from '@heroicons/react/24/outline';

const ResizableImage = ({ src, width, height, align, onUpdate, onDelete }) => {
    const [isResizing, setIsResizing] = useState(false);
    const [resizeMode, setResizeMode] = useState(null);
    const imgRef = useRef(null);
    const containerRef = useRef(null);

    const handleMouseDown = (e, mode) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizeMode(mode);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidthPx = containerRef.current.offsetWidth;
        const startHeightPx = imgRef.current.offsetHeight;
        const containerWidth = containerRef.current.parentElement.offsetWidth;

        const doDrag = (dragEvent) => {
            const diffX = dragEvent.clientX - startX;
            const diffY = dragEvent.clientY - startY;
            let updates = {};

            if (mode === 'se' || mode === 'e') {
                let newWidthPx = startWidthPx + diffX;
                let newWidthPercent = (newWidthPx / containerWidth) * 100;
                if (newWidthPercent < 10) newWidthPercent = 10;
                if (newWidthPercent > 100) newWidthPercent = 100;
                updates.width = newWidthPercent;
            }
            if (mode === 'se' || mode === 's') {
                if (mode === 's' || (mode === 'se' && height !== 'auto')) {
                    let newHeightPx = startHeightPx + diffY;
                    if (newHeightPx < 50) newHeightPx = 50;
                    updates.height = newHeightPx;
                }
            }
            onUpdate(updates);
        };

        const stopDrag = () => {
            setIsResizing(false);
            setResizeMode(null);
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    };

    let containerStyle = { marginBottom: '1rem', position: 'relative' };
    if (align === 'left') containerStyle = { ...containerStyle, float: 'left', margin: '0 1rem 1rem 0', width: `${width}%` };
    else if (align === 'right') containerStyle = { ...containerStyle, float: 'right', margin: '0 0 1rem 1rem', width: `${width}%` };
    else if (align === 'center') containerStyle = { ...containerStyle, margin: '0 auto 1rem auto', width: `${width}%`, display: 'block' };
    else containerStyle = { ...containerStyle, width: `${width}%` };

    return (
        <div
            ref={containerRef}
            className={`group relative transition-all border-2 ${isResizing ? 'border-blue-500' : 'border-transparent hover:border-blue-200'}`}
            style={containerStyle}
        >
            <img ref={imgRef} src={src} className="block w-full" style={{ height: height === 'auto' ? 'auto' : `${height}px`, objectFit: height === 'auto' ? 'contain' : 'fill' }} alt="Görsel" />

            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg p-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition z-50 pointer-events-none group-hover:pointer-events-auto border border-gray-200">
                <button onClick={() => onUpdate({ align: 'left' })} className={`p-1 rounded ${align === 'left' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}><Bars3BottomLeftIcon className="w-4 h-4" /></button>
                <button onClick={() => onUpdate({ align: 'center' })} className={`p-1 rounded ${align === 'center' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}><Bars3Icon className="w-4 h-4" /></button>
                <button onClick={() => onUpdate({ align: 'right' })} className={`p-1 rounded ${align === 'right' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}><Bars3BottomRightIcon className="w-4 h-4" /></button>
                <div className="w-[1px] bg-gray-300 mx-1"></div>
                <button onClick={() => onUpdate({ height: 'auto' })} className="p-1 rounded hover:bg-gray-100 text-xs font-bold">Oto</button>
                <button onClick={onDelete} className="p-1 rounded hover:bg-red-100 text-red-500"><TrashIcon className="w-4 h-4" /></button>
            </div>
            <div onMouseDown={(e) => handleMouseDown(e, 'se')} className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 cursor-nwse-resize opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-tl-lg shadow-sm z-20">
                <ArrowsPointingOutIcon className="w-3 h-3 text-white" />
            </div>
        </div>
    );
};

export default ResizableImage;
