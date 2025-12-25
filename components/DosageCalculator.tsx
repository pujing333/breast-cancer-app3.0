
import React, { useState, useEffect } from 'react';
import { RegimenOption, DrugDetail } from '../types';

interface DosageCalculatorProps {
    options: RegimenOption[];
    initialHeight?: number;
    initialWeight?: number;
    onUpdateStats: (h: number, w: number) => void;
    patientAge?: number;
    scr?: string;
    isLocked?: boolean;
}

export const DosageCalculator: React.FC<DosageCalculatorProps> = ({ 
    options, 
    initialHeight, 
    initialWeight,
    onUpdateStats,
    patientAge,
    scr,
    isLocked
}) => {
    const [height, setHeight] = useState<string>(initialHeight ? initialHeight.toString() : '');
    const [weight, setWeight] = useState<string>(initialWeight ? initialWeight.toString() : '');
    const [bsa, setBsa] = useState<number>(0);

    useEffect(() => {
        const h = parseFloat(height);
        const w = parseFloat(weight);
        if (h > 0 && w > 0) {
            let calculatedBsa = 0.0061 * h + 0.0128 * w - 0.1529;
            setBsa(Math.max(0, Number(calculatedBsa.toFixed(2))));
            onUpdateStats(h, w);
        }
    }, [height, weight, onUpdateStats]);

    const calculateDose = (drug: DrugDetail, type: 'standard' | 'loading' = 'standard') => {
        // 核心锁定逻辑：锁定状态下绝对优先返回持久化的字符串
        if (type === 'standard' && drug.lockedDose) return drug.lockedDose;
        if (type === 'loading' && drug.lockedLoadingDose) return drug.lockedLoadingDose;

        const w = parseFloat(weight);
        const h = parseFloat(height);
        let val: number | null = null;
        const doseToUse = (type === 'loading' && drug.loadingDose) ? drug.loadingDose : drug.standardDose;
        
        if (drug.unit === 'mg/m²' || drug.unit === 'mg/m2') {
            val = bsa > 0 ? Math.round(doseToUse * bsa) : null;
        } else if (drug.unit === 'mg/kg') {
            val = w > 0 ? Math.round(doseToUse * w) : null;
        } else if (drug.unit === 'AUC') {
            const scrVal = parseFloat(scr || '0');
            if (scrVal > 0 && patientAge && w > 0) {
                const gfr = ((140 - patientAge) * w * 1.04) / scrVal;
                val = Math.round(doseToUse * (gfr + 25));
            }
        } else if (drug.unit === 'mg') {
            val = doseToUse;
        }

        return val !== null ? `${val} mg` : '--';
    };

    return (
        <div className={`bg-gray-50 p-4 rounded-xl border transition-all ${isLocked ? 'border-blue-100 bg-blue-50/20' : 'border-gray-200 shadow-sm'}`}>
            <div className="text-sm font-bold mb-3 flex justify-between items-center">
                <span className="text-gray-700">剂量计算参数</span>
                <span className="text-medical-600 bg-medical-50 px-2 py-0.5 rounded text-[10px] font-mono">BSA: {bsa} m²</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">身高 (cm)</label>
                    <input 
                        type="number" 
                        className="w-full p-2 text-sm border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" 
                        value={height} 
                        onChange={e => !isLocked && setHeight(e.target.value)} 
                        disabled={isLocked}
                    />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">体重 (kg)</label>
                    <input 
                        type="number" 
                        className="w-full p-2 text-sm border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" 
                        value={weight} 
                        onChange={e => !isLocked && setWeight(e.target.value)} 
                        disabled={isLocked}
                    />
                </div>
            </div>

            <div className="space-y-2">
                {options.map(opt => (
                    <div key={opt.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-xs">
                        <div className="text-[10px] font-bold text-medical-600 mb-2 border-b border-medical-50 pb-1 flex justify-between">
                            <span>{opt.name}</span>
                            {isLocked && <span className="text-blue-500 font-bold">● 已固化剂量</span>}
                        </div>
                        <div className="space-y-1.5">
                            {opt.drugs?.map((d, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-600">
                                            {d.name} {d.loadingDose ? '(维持)' : ''} 
                                            <span className="text-[10px] text-gray-300 ml-1">[{d.standardDose}{d.unit}]</span>
                                        </span>
                                        <span className={`font-bold ${isLocked ? 'text-blue-600' : 'text-gray-900'}`}>{calculateDose(d, 'standard')}</span>
                                    </div>
                                    {d.loadingDose && (
                                        <div className="flex justify-between items-center text-[11px] bg-accent-50/40 px-2 py-1 rounded">
                                            <span className="text-accent-700 italic">● 首剂加量快照 <span className="text-gray-400">({d.loadingDose}{d.unit})</span></span>
                                            <span className="font-bold text-accent-700">{calculateDose(d, 'loading')}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            {isLocked && (
                <div className="mt-3 flex items-center justify-center gap-1.5 py-1.5 bg-blue-100/50 rounded-lg">
                    <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" /></svg>
                    <span className="text-[10px] text-blue-600 font-bold">方案已锁定，所有剂量数值已转为固定快照</span>
                </div>
            )}
        </div>
    );
};
