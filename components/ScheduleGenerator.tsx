
import React, { useState } from 'react';
import { RegimenOption, TreatmentEvent, DrugDetail } from '../types';

interface ScheduleGeneratorProps {
  selectedOptions: RegimenOption[];
  onSaveEvents: (events: Omit<TreatmentEvent, 'id'>[]) => void;
  patientHeight?: number;
  patientWeight?: number;
}

export const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({ 
  selectedOptions, 
  onSaveEvents,
  patientHeight,
  patientWeight
}) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [generatedEvents, setGeneratedEvents] = useState<Omit<TreatmentEvent, 'id'>[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Helper to format dosage string
  const getDoseString = (drug: DrugDetail) => {
      // 1. Use locked dose if available (Plan is locked)
      if (drug.lockedDose) return `${drug.name} ${drug.lockedDose}`;
      
      // 2. Calculate based on height/weight if available
      if (patientHeight && patientWeight) {
          const h = patientHeight;
          const w = patientWeight;
          // Stevenson Formula
          let bsa = 0.0061 * h + 0.0128 * w - 0.1529;
          if (bsa < 0) bsa = 0;

          let val = 0;
          if (drug.unit === 'mg/m²' || drug.unit === 'mg/m2') {
              val = Math.round(drug.standardDose * bsa);
          } else if (drug.unit === 'mg/kg') {
              val = Math.round(drug.standardDose * w);
          } else {
              // Fixed dose or AUC without explicit calculation here (simplified)
              return `${drug.name} ${drug.standardDose}${drug.unit}`;
          }
          return `${drug.name} ${val}mg`;
      }

      // 3. Fallback to standard
      return `${drug.name} ${drug.standardDose}${drug.unit}`;
  };

  const handleGenerate = () => {
    const events: Omit<TreatmentEvent, 'id'>[] = [];
    const start = new Date(startDate);

    selectedOptions.forEach(option => {
      // Default to 1 cycle if not specified
      const cycles = option.totalCycles || 1;
      const frequency = option.frequencyDays || 0; // 0 means one-time

      // Construct dosage string for this option
      const dosageInfo = option.drugs && option.drugs.length > 0
          ? option.drugs.map(d => getDoseString(d)).join(' + ')
          : undefined;

      for (let i = 0; i < cycles; i++) {
        const eventDate = new Date(start);
        // Calculate date: Start Date + (Cycle Index * Frequency)
        eventDate.setDate(start.getDate() + (i * frequency));

        // RegimenOption refers to medication regimens (chemo, target, immune, endocrine), so type is 'medication'.
        const type: TreatmentEvent['type'] = 'medication';

        events.push({
          title: `${option.name} (第${i + 1}次)`,
          description: `${option.type === 'chemo' ? '化疗' : option.type === 'target' ? '靶向治疗' : option.type === 'immune' ? '免疫治疗' : '内分泌治疗'} - 周期 ${i + 1}/${cycles}`,
          date: eventDate.toISOString().split('T')[0],
          type: type,
          completed: false,
          dosageDetails: dosageInfo // Add dosage info
        });
      }
    });

    // Sort by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setGeneratedEvents(events);
    setIsPreviewing(true);
  };

  const handleSave = () => {
    onSaveEvents(generatedEvents);
    setIsPreviewing(false);
    setGeneratedEvents([]);
  };

  if (selectedOptions.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6 animate-fade-in">
      <div className="flex items-center mb-4 border-b border-gray-100 pb-4">
        <div className="w-8 h-8 rounded-full bg-medical-600 text-white flex items-center justify-center font-bold mr-3">3</div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">治疗日程规划</h3>
          <p className="text-xs text-gray-500">根据所选方案的周期自动生成排程</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">首次治疗开始日期</label>
          <input 
            type="date" 
            className="w-full sm:w-auto rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 outline-none"
            value={startDate}
            onChange={(e) => {
                setStartDate(e.target.value);
                setIsPreviewing(false);
            }}
          />
        </div>
        
        <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 space-y-1">
            <p className="font-bold text-gray-700 mb-1">将为以下方案生成日程：</p>
            {selectedOptions.map(opt => (
                <div key={opt.id} className="flex flex-col mb-2 last:mb-0">
                    <div className="flex justify-between font-medium text-gray-800">
                        <span>• {opt.name}</span>
                        <span className="text-gray-500">
                            {opt.frequencyDays ? `每${opt.frequencyDays}天1次` : '单次'} × {opt.totalCycles || 1}周期
                        </span>
                    </div>
                    {/* Preview dosage in list */}
                    {opt.drugs && (
                        <div className="pl-3 text-gray-400 text-[10px]">
                            预估剂量: {opt.drugs.map(d => getDoseString(d)).join(' + ')}
                        </div>
                    )}
                </div>
            ))}
        </div>

        {!isPreviewing ? (
             <button 
                onClick={handleGenerate}
                className="w-full bg-medical-600 text-white py-3 rounded-lg font-bold hover:bg-medical-700 transition-colors flex items-center justify-center"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                预览日程表 ({selectedOptions.reduce((acc, curr) => acc + (curr.totalCycles || 1), 0)} 个事件)
            </button>
        ) : (
            <div className="space-y-4 animate-fade-in">
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-2 space-y-2">
                    {generatedEvents.map((evt, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border border-gray-100 flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center">
                                    <span className="text-xs font-mono text-gray-500 mr-3 bg-gray-100 px-1 rounded">{evt.date}</span>
                                    <span className="text-sm font-bold text-gray-800">{evt.title}</span>
                                </div>
                            </div>
                            {evt.dosageDetails && (
                                <div className="text-xs text-medical-600 font-mono pl-0.5">
                                    {evt.dosageDetails}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsPreviewing(false)}
                        className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium"
                    >
                        重新调整
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm flex items-center justify-center"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        确认添加到日程
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
