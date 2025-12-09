import React, { useRef } from 'react';

interface HeaderProps {
onBack?: () => void;
title: string;
rightAction?: React.ReactNode;
onExport?: () => void;
onImport?: (file: File) => void;
}

export const Header: React.FC<HeaderProps> = ({ onBack, title, rightAction, onExport, onImport }) => {
const fileInputRef = useRef<HTMLInputElement>(null);

const handleImportClick = () => {
fileInputRef.current?.click();
};

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (file && onImport) {
onImport(file);
}
// Reset input so same file can be selected again
if (e.target) e.target.value = '';
};

return (
<header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100 h-14 flex items-center px-4 justify-between">
<div className="flex items-center flex-1 min-w-0">
{onBack && (
<button
onClick={onBack}
className="mr-3 text-gray-600 hover:text-medical-600 p-1 rounded-full active:bg-gray-100 flex-shrink-0"
>
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
</svg>
</button>
)}
<h1 className="text-lg font-bold text-gray-800 truncate pr-2">{title}</h1>
</div>
<div className="flex items-center gap-2">
    {rightAction}
    
    {/* Data Backup Buttons (Only show on main list page) */}
    {!rightAction && onExport && onImport && (
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
            />
            <button 
                onClick={handleImportClick}
                className="p-2 text-gray-500 hover:text-medical-600 active:bg-gray-200 rounded-md transition-colors"
                title="导入数据"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
            </button>
            <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
            <button 
                onClick={onExport}
                className="p-2 text-gray-500 hover:text-medical-600 active:bg-gray-200 rounded-md transition-colors"
                title="导出备份"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>
        </div>
    )}
  </div>
</header>
);
};