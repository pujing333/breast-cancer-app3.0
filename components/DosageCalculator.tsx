
import React, { useState, useEffect } from 'react';
import { RegimenOption } from '../types';

interface DosageCalculatorProps {
    options: RegimenOption[];
    initialHeight?: number;
    initialWeight?: number;
    onUpdateStats: (h: number, w: number) => void;
}

export const DosageCalculator: React.FC<DosageCalculatorProps> = ({ 
    options, 
    initialHeight, 
    initialWeight,
    onUpdateStats
}) => {
    const [height, setHeight] = useState<string>(initialHeight ? initialHeight.toString() : '');
    const [weight, setWeight] = useState<string>(initialWeight ? initialWeight.toString() : '');
    const [bsa, setBsa] = useState<number>(0);

    // Calculate BSA whenever height or weight changes
    useEffect(() => {
        const h = parseFloat(height);
        const w = parseFloat(weight);

        if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
            // Stevenson Formula (Common in China)
            // BSA = 0.0061 * H + 0.0128 * W - 0.1529
            let calculatedBsa = 0.0061 * h + 0.0128 * w - 0.1529;
            
            // Fallback if Stevenson returns weird value for extreme outliers, but usually reliable
            if (calculatedBsa < 0) calculatedBsa = 0;

            setBsa(Number(calculatedBsa.toFixed(2)));
            onUpdateStats(h, w);
        } else {
            setBsa(0);
        }
    }, [height, weight]);

    // Helper to calculate dose based on unit
    const calculateDose = (standard: number, unit: string) => {
        const w = parseFloat(weight);
        if (unit === 'mg/m²' || unit === 'mg/m2') {
            return bsa > 0 ? Math.round(standard * bsa) : null;
        }
        if (unit === 'mg/kg') {
            return (!isNaN(w) && w > 0) ? Math.round(standard * w) : null;
        }
        // Fixed dose
        return standard;
    };

    const getCalcMethod = (unit: string) => {
        if (unit === 'mg/m²' || unit === 'mg/m2') return '(基于BSA)';
        if (unit === 'mg/kg') return '(基于体重)';
        return '(固定剂量)';
    };

    const hasValidInput = !isNaN(parseFloat(height)) && !isNaN(parseFloat(weight)) && parseFloat(height) > 0 && parseFloat(weight) > 0;

    return (
        <div className="mt-6 bg-blue-50 rounded-xl p-5 border border-blue-100 shadow-sm animate-fade-in">
            <div className="flex items-center mb-4">
                <div className="bg-blue-600 text-white p-1.5 rounded-lg mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">药物剂量计算器</h3>
                    <p className="text-xs text-gray-500">化疗(BSA公式) / 靶向(体重或BSA)</p>
                </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">身高 (cm)</label>
                    <input 
                        type="number" 
                        placeholder="输入身高"
                        className="w-full p-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">体重 (kg)</label>
                    <input 
                        type="number" 
                        placeholder="输入体重"
                        className="w-full p-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                    />
                </div>
            </div>

            {/* Stats Result */}
            <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-sm text-gray-600 font-medium">体表面积 (BSA)</span>
                    <span className="text-lg font-bold text-blue-600">
                        {bsa > 0 ? `${bsa} m²` : '--'}
                    </span>
                </div>
                <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-sm text-gray-600 font-medium">体重</span>
                    <span className="text-lg font-bold text-blue-600">
                        {weight ? `${weight} kg` : '--'}
                    </span>
                </div>
            </div>

            {/* Drugs Tables for each option */}
            {options.map((option) => {
                if (!option.drugs || option.drugs.length === 0) return null;
                
                let typeLabel = '治疗方案';
                if (option.type === 'chemo') typeLabel = '化疗';
                else if (option.type === 'target') typeLabel = '靶向治疗';
                else if (option.type === 'immune') typeLabel = '免疫治疗';

                return (
                    <div key={option.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4 last:mb-0">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-700 uppercase flex items-center">
                                <span className={`w-2 h-2 rounded-full mr-2 ${option.type === 'chemo' ? 'bg-red-400' : option.type === 'target' ? 'bg-purple-400' : 'bg-green-400'}`}></span>
                                {typeLabel}: {option.name}
                            </span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {option.drugs.map((drug, idx) => {
                                const calculated = calculateDose(drug.standardDose, drug.unit);
                                return (
                                    <div key={idx} className="p-3 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-sm text-gray-800">{drug.name}</div>
                                            <div className="text-xs text-gray-400">标准: {drug.standardDose} {drug.unit}</div>
                                        </div>
                                        <div className="text-right">
                                            {hasValidInput ? (
                                                <>
                                                    <div className="text-lg font-bold text-medical-600">
                                                        {calculated !== null ? `${calculated} mg` : '计算中...'}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">{getCalcMethod(drug.unit)}</div>
                                                </>
                                            ) : (
                                                <span className="text-xs text-gray-300">等待输入...</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
            
            {!hasValidInput && (
                <div className="text-center text-sm text-gray-400 py-2">
                    请输入身高体重以开始计算
                </div>
            )}
        </div>
    );
};
