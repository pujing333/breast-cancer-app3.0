
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
  const [isSuccess, setIsSuccess] = useState(false);

  const getDoseString = (drug: DrugDetail, isInitial: boolean) => {
      // 优先读取已锁定的固化剂量
      if (isInitial && drug.lockedLoadingDose) return `${drug.name}(首剂) ${drug.lockedLoadingDose}`;
      if (!isInitial && drug.lockedDose) return `${drug.name} ${drug.lockedDose}`;
      
      // 如果未锁定，则根据当前身高体重实时计算（仅供预览）
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
          else if (drug.unit === 'qd' || drug.unit === 'bid') return `${drug.name} ${drug.standardDose} ${drug.unit}`;

          return `${drug.name}${label} ${val > 0 ? val + 'mg' : drug.standardDose + drug.unit}`;
      }
      return `${drug.name} ${drug.standardDose}${drug.unit}`;
  };

  const handleGenerate = () => {
    const events: Omit<TreatmentEvent, 'id'>[] = [];
    selectedOptions.forEach(option => {
      const cycles = option.totalCycles || 1;
      const frequency = option.frequencyDays || 21;
      const startDateStr = startDates[option.type] || startDates.chemo;
      const start = new Date(startDateStr);

      // 安全限制：单个方案最多生成100个日程，防止死循环
      const safeCycles = Math.min(cycles, 100);

      for (let i = 0; i < safeCycles; i++) {
        const isInitial = (i === 0);
        const eventDate = new Date(start);
        eventDate.setDate(start.getDate() + (i * frequency));
        
        const dosageInfo = option.drugs?.map(d => getDoseString(d, isInitial)).join(' + ');

        events.push({
          title: `${option.name} (第${i + 1}周期)`,
          description: `${option.cycle}`,
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
    setIsSuccess(false);
  };

  const handleWriteToTimeline = () => {
      onSaveEvents(generatedEvents);
      setIsPreviewing(false);
      setIsSuccess(true);
      // 3秒后自动清除成功提示
      setTimeout(() => setIsSuccess(false), 3000);
  };

  const typesPresent = Array.from(new Set(selectedOptions.map(o => o.type)));

  return (
    <div className={`mt-6 p-4 rounded-xl border transition-all ${isLocked ? 'bg-blue-50/10 border-blue-100' : 'bg-white border-medical-100 shadow-sm'}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-gray-700">自动排程生成器</h3>
        {isLocked && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">已开启剂量固化同步</span>}
      </div>
      
      {isSuccess && (
          <div className="mb-4 p-2 bg-green-100 text-green-700 text-[10px] font-bold rounded flex items-center animate-bounce">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              日程同步成功！请切换至“日程”选项卡查看。
          </div>
      )}

      <div className="space-y-4 mb-5">
        {typesPresent.map(type => (
            <div key={type}>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
                    {type === 'chemo' ? '化疗' : type === 'endocrine' ? '内分泌' : '靶向/免疫'} 开始日期
                </label>
                <input 
                  type="date" 
                  className="w-full p-2 text-sm border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" 
                  value={startDates[type] || ''} 
                  onChange={e => setStartDates({...startDates, [type]: e.target.value})} 
                  disabled={isLocked} 
                />
            </div>
        ))}
      </div>

      {!isPreviewing ? (
          <button 
            onClick={handleGenerate} 
            className={`w-full py-2.5 rounded-lg text-xs font-bold border active:scale-95 transition-transform ${
              isLocked ? 'bg-blue-600 text-white border-blue-700' : 'bg-medical-50 text-medical-700 border-medical-100'
            }`}
          >
              预览治疗日历
          </button>
      ) : (
          <div className="space-y-3 animate-fade-in">
              <div className="max-h-48 overflow-y-auto bg-gray-50 p-2.5 rounded-lg text-[10px] space-y-1.5 border border-gray-100">
                  <div className="text-[9px] text-gray-400 mb-2 italic">※ 系统将生成以下治疗节点并同步至日程表：</div>
                  {generatedEvents.map((e, i) => (
                      <div key={i} className="bg-white p-2 rounded shadow-xs border-l-2 border-medical-500">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-400 font-mono">{e.date}</span>
                            <span className="font-bold text-gray-700">{e.title}</span>
                          </div>
                          <div className="text-[9px] text-medical-600 truncate bg-medical-50/50 p-1 rounded font-medium">
                            {e.dosageDetails || '无剂量详情'}
                          </div>
                      </div>
                  ))}
              </div>
              <div className="flex gap-2">
                  <button 
                    onClick={() => setIsPreviewing(false)} 
                    disabled={isLocked}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${isLocked ? 'bg-gray-100 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
                  >
                    重新调整
                  </button>
                  <button 
                    onClick={handleWriteToTimeline} 
                    className={`flex-1 py-2 text-white rounded-lg text-xs font-bold shadow-md active:scale-95 ${isLocked ? 'bg-green-600' : 'bg-medical-600'}`}
                  >
                    确认写入患者日程
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
