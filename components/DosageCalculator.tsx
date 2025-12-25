
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
        if (type === 'standard' && drug.lockedDose) return drug.lockedDose;
        if (type === 'loading' && drug.lockedLoadingDose) return drug.lockedLoadingDose;

        const w = parseFloat(weight);
        const h = parseFloat(height);
        let val: number | null = null;
        const doseToUse = (type === 'loading' && drug.loadingDose) ? drug.loadingDose : drug.standardDose;
        const unit = drug.unit.toLowerCase();
        
        if (unit.includes('m2') || unit.includes('m²')) {
            val = bsa > 0 ? Math.round(doseToUse * bsa) : null;
        } else if (unit.includes('kg')) {
            val = w > 0 ? Math.round(doseToUse * w) : null;
        } else if (unit === 'auc') {
            const scrVal = parseFloat(scr || '0');
            if (scrVal > 0 && patientAge && w > 0) {
                const gfr = ((140 - patientAge) * w * 1.04) / scrVal;
                val = Math.round(doseToUse * (gfr + 25));
            }
        } else if (unit === 'mg') {
            val = doseToUse;
        }

        return val !== null ? `${val} mg` : '--';
    };

    return (
        <div className={`bg-gray-50 p-4 rounded-xl border transition-all ${isLocked ? 'border-blue-100 bg-blue-50/20' : 'border-gray-200 shadow-sm'}`}>
            <div className="text-sm font-bold mb-3 flex justify-between items-center">
                <span className="text-gray-700">剂量计算参数</span>
                <span className="text-medical-600 bg-medical-50 px-2 py-0.5 rounded text-[10px] font-mono">BSA: {bsa} m2</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">身高 (cm)</label>
                    <input type="number" className="w-full p-2 text-sm border rounded bg-white outline-none" value={height} onChange={e => !isLocked && setHeight(e.target.value)} disabled={isLocked} />
                </div>
                <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">体重 (kg)</label>
                    <input type="number" className="w-full p-2 text-sm border rounded bg-white outline-none" value={weight} onChange={e => !isLocked && setWeight(e.target.value)} disabled={isLocked} />
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
                                        <span className="text-gray-600">{d.name} <span className="text-[10px] text-gray-300 ml-1">[{d.standardDose}{d.unit}]</span></span>
                                        <span className={`font-bold ${isLocked ? 'text-blue-600' : 'text-gray-900'}`}>{calculateDose(d, 'standard')}</span>
                                    </div>
                                    {d.loadingDose && (
                                        <div className="flex justify-between items-center text-[11px] bg-accent-50/40 px-2 py-1 rounded">
                                            <span className="text-accent-700 italic">● 首剂加量快照</span>
                                            <span className="font-bold text-accent-700">{calculateDose(d, 'loading')}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
