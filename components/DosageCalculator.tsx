
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
    }, [height, weight]);

    const calculateDose = (drug: DrugDetail, type: 'standard' | 'loading' = 'standard') => {
        // 如果已锁定，优先使用锁定的数值
        if (type === 'standard' && drug.lockedDose) return drug.lockedDose;
        if (type === 'loading' && drug.lockedLoadingDose) return drug.lockedLoadingDose;

        const w = parseFloat(weight);
        const h = parseFloat(height);
        let val: number | null = null;
        const doseToUse = type === 'loading' && drug.loadingDose ? drug.loadingDose : drug.standardDose;
        
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
        <div className={`bg-gray-50 p-4 rounded-xl border ${isLocked ? 'border-blue-100 bg-blue-50/20' : 'border-gray-200'}`}>
            <div className="text-sm font-bold mb-3 flex justify-between items-center">
                <span className="text-gray-700">体征参数与剂量计算</span>
                <span className="text-medical-600 bg-medical-50 px-2 py-0.5 rounded text-xs">BSA: {bsa} m²</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">身高 (cm)</label>
                    <input 
                        type="number" 
                        placeholder="身高" 
                        className="w-full p-2.5 text-sm border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" 
                        value={height} 
                        onChange={e => !isLocked && setHeight(e.target.value)} 
                        disabled={isLocked}
                    />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">体重 (kg)</label>
                    <input 
                        type="number" 
                        placeholder="体重" 
                        className="w-full p-2.5 text-sm border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" 
                        value={weight} 
                        onChange={e => !isLocked && setWeight(e.target.value)} 
                        disabled={isLocked}
                    />
                </div>
            </div>

            <div className="space-y-2">
                {options.map(opt => (
                    <div key={opt.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                        <div className="text-[10px] font-bold text-medical-600 mb-2 border-b border-medical-50 pb-1 flex justify-between">
                            <span>{opt.name}</span>
                            {isLocked && <span className="text-blue-500">已固化</span>}
                        </div>
                        <div className="space-y-1.5">
                            {opt.drugs?.map((d, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-600">{d.name} {d.loadingDose ? '(维持)' : ''} <span className="text-[10px] text-gray-400">({d.standardDose} {d.unit})</span></span>
                                        <span className="font-bold text-gray-900">{calculateDose(d, 'standard')}</span>
                                    </div>
                                    {d.loadingDose && (
                                        <div className="flex justify-between items-center text-xs bg-accent-50/30 px-1.5 py-0.5 rounded border border-accent-100/50">
                                            <span className="text-accent-700 italic text-[10px]">● 首剂加量 <span className="text-gray-400">({d.loadingDose} {d.unit})</span></span>
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
                <p className="mt-3 text-[10px] text-blue-500 italic text-center">
                    * 方案已锁定，以上剂量为锁定时的历史快照。
                </p>
            )}
        </div>
    );
};
