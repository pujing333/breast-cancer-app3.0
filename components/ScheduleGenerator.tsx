
import React, { useState } from 'react';
import { RegimenOption, TreatmentEvent, DrugDetail } from '../types';

interface ScheduleGeneratorProps {
  selectedOptions: RegimenOption[];
  onSaveEvents: (events: Omit<TreatmentEvent, 'id'>[]) => void;
  patientHeight?: number;
  patientWeight?: number;
  patientAge?: number;
  scr?: string;
  isLocked?: boolean;
}

export const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({ 
  selectedOptions, 
  onSaveEvents,
  patientHeight,
  patientWeight,
  patientAge,
  scr,
  isLocked
}) => {
  const [startDates, setStartDates] = useState<Record<string, string>>({
    chemo: new Date().toISOString().split('T')[0],
    endocrine: new Date().toISOString().split('T')[0],
    target: new Date().toISOString().split('T')[0],
    immune: new Date().toISOString().split('T')[0]
  });
  const [generatedEvents, setGeneratedEvents] = useState<Omit<TreatmentEvent, 'id'>[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const getDoseString = (drug: DrugDetail, isInitial: boolean) => {
      // 优先使用锁定的数值
      if (isInitial && drug.lockedLoadingDose) return `${drug.name}(首剂) ${drug.lockedLoadingDose}`;
      if (!isInitial && drug.lockedDose) return `${drug.name} ${drug.lockedDose}`;
      
      // 如果没有锁定值，则实时计算
      if (patientHeight && patientWeight) {
          const bsa = Math.max(0, 0.0061 * patientHeight + 0.0128 * patientWeight - 0.1529);
          const doseToUse = (isInitial && drug.loadingDose) ? drug.loadingDose : drug.standardDose;
          const label = (isInitial && drug.loadingDose) ? '(首剂)' : '';
          
          let val = 0;
          if (drug.unit === 'mg/m²' || drug.unit === 'mg/m2') val = Math.round(doseToUse * bsa);
          else if (drug.unit === 'mg/kg') val = Math.round(doseToUse * patientWeight);
          else if (drug.unit === 'AUC' && scr && patientAge) {
              const scrVal = parseFloat(scr);
              const gfr = ((140 - patientAge) * patientWeight * 1.04) / scrVal;
              val = Math.round(doseToUse * (gfr + 25));
          } else if (drug.unit === 'mg') val = doseToUse;

          return `${drug.name}${label} ${val}mg`;
      }
      return `${drug.name} ${drug.standardDose}${drug.unit}`;
  };

  const handleGenerate = () => {
    const events: Omit<TreatmentEvent, 'id'>[] = [];
    selectedOptions.forEach(option => {
      const cycles = option.totalCycles || 1;
      const frequency = option.frequencyDays || 0;
      const startDateStr = startDates[option.type] || startDates.chemo;
      const start = new Date(startDateStr);

      for (let i = 0; i < cycles; i++) {
        const isInitial = (i === 0);
        const eventDate = new Date(start);
        eventDate.setDate(start.getDate() + (i * frequency));
        
        const dosageInfo = option.drugs?.map(d => getDoseString(d, isInitial)).join(' + ');

        events.push({
          title: `${option.name} (第${i + 1}次)`,
          description: `${option.cycle} - 周期 ${i + 1}/${cycles}`,
          date: eventDate.toISOString().split('T')[0],
          type: 'medication',
          completed: false,
          dosageDetails: dosageInfo
        });
      }
    });
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setGeneratedEvents(events);
    setIsPreviewing(true);
  };

  const typesPresent = Array.from(new Set(selectedOptions.map(o => o.type)));

  return (
    <div className={`mt-6 p-4 rounded-xl border ${isLocked ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-medical-100 shadow-sm'}`}>
      <h3 className="text-sm font-bold mb-4 flex items-center text-gray-700">
        <svg className="w-4 h-4 mr-2 text-medical-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        3. 日程排期排布
      </h3>
      
      <div className="space-y-4 mb-5">
        {typesPresent.includes('chemo') && (
            <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">化疗开始日期</label>
                <input type="date" className="w-full p-2.5 text-sm border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" value={startDates.chemo} onChange={e => !isLocked && setStartDates({...startDates, chemo: e.target.value})} disabled={isLocked} />
            </div>
        )}
        {typesPresent.includes('endocrine') && (
            <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">内分泌开始日期</label>
                <input type="date" className="w-full p-2.5 text-sm border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" value={startDates.endocrine} onChange={e => !isLocked && setStartDates({...startDates, endocrine: e.target.value})} disabled={isLocked} />
            </div>
        )}
        {(typesPresent.includes('target') || typesPresent.includes('immune')) && (
            <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">靶向/免疫开始日期</label>
                <input type="date" className="w-full p-2.5 text-sm border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" value={startDates.target} onChange={e => !isLocked && setStartDates({...startDates, target: e.target.value, immune: e.target.value})} disabled={isLocked} />
            </div>
        )}
      </div>

      {!isPreviewing ? (
          <button 
            onClick={handleGenerate} 
            disabled={isLocked}
            className={`w-full py-3 rounded-lg text-xs font-bold transition-all ${isLocked ? 'bg-gray-200 text-gray-400' : 'bg-medical-50 text-medical-700 border border-medical-200 active:scale-[0.98]'}`}
          >
              预览自动排程 (含首剂加量逻辑)
          </button>
      ) : (
          <div className="space-y-3 animate-fade-in">
              <div className="max-h-48 overflow-y-auto bg-gray-50 p-2.5 rounded-lg text-[10px] space-y-1.5 border border-gray-100">
                  {generatedEvents.map((e, i) => (
                      <div key={i} className="flex flex-col bg-white p-2 rounded shadow-xs border-l-2 border-medical-500">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-400 font-mono">{e.date}</span>
                            <span className="font-bold text-gray-700">{e.title}</span>
                          </div>
                          <div className="text-[9px] text-medical-600 truncate">{e.dosageDetails}</div>
                      </div>
                  ))}
              </div>
              {!isLocked && (
                <div className="flex gap-3">
                    <button onClick={() => setIsPreviewing(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">重新调整</button>
                    <button onClick={() => {onSaveEvents(generatedEvents); setIsPreviewing(false);}} className="flex-1 py-3 bg-medical-600 text-white rounded-lg text-xs font-bold shadow-md">确认并添加到日程</button>
                </div>
              )}
          </div>
      )}
    </div>
  );
};
