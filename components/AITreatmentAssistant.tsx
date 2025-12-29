
import React, { useState, useMemo } from 'react';
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, RegimenOption, SelectedRegimens, TreatmentEvent, DrugDetail } from '../types';
import { generateLocalTreatmentOptions, generateLocalDetailedRegimens } from '../services/localMedicalRules';
import { DosageCalculator } from './DosageCalculator';
import { ScheduleGenerator } from './ScheduleGenerator';

interface AITreatmentAssistantProps {
  patient: Patient;
  onUpdateMarkers: (markers: ClinicalMarkers) => void;
  onSaveOptions: (options: TreatmentOption[], selectedId: string | undefined) => void;
  onSaveDetailedPlan: (plan: DetailedRegimenPlan, selectedRegimens: SelectedRegimens, isLocked?: boolean, markersToSave?: ClinicalMarkers) => void;
  onUpdatePatientStats?: (height: number, weight: number) => void;
  onBatchAddEvents?: (events: Omit<TreatmentEvent, 'id'>[]) => void;
}

export const AITreatmentAssistant: React.FC<AITreatmentAssistantProps> = ({
  patient,
  onUpdateMarkers,
  onSaveOptions,
  onSaveDetailedPlan,
  onUpdatePatientStats,
  onBatchAddEvents
}) => {
  const [localMarkers, setLocalMarkers] = useState<ClinicalMarkers>(patient.markers);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(patient.selectedPlanId);
  const [options, setOptions] = useState<TreatmentOption[]>(patient.treatmentOptions || []);
  const [detailedPlan, setDetailedPlan] = useState<DetailedRegimenPlan | undefined>(patient.detailedPlan);
  const [selectedRegimens, setSelectedRegimens] = useState<SelectedRegimens>(patient.selectedRegimens || {});

  const isLocked = !!patient.isPlanLocked;

  // 实时风险评估逻辑 (包含 MonarchE 阿贝西利标准)
  const riskAssessment = useMemo(() => {
    const ki67Val = parseFloat(localMarkers.ki67.replace('%', '')) || 0;
    const isG3 = localMarkers.histologicalGrade === 'G3';
    const nStage = localMarkers.nodeStatus;
    const isNPlus = nStage !== 'N0';
    const isHighKi67 = ki67Val >= 20; // 阿贝西利标准通常为 20%
    const tSize = parseFloat(localMarkers.tumorSize) || 0;
    
    const factors = [];
    if (isG3) factors.push("分级G3");
    if (ki67Val >= 30) factors.push(`Ki-67高(${ki67Val}%)`);
    if (isNPlus) factors.push(`淋巴结${nStage}`);

    // CDK4/6i 阿贝西利判定 (MonarchE)
    const isAbemaciclibCandidate = (nStage === 'N2' || nStage === 'N3') || 
                                 (nStage === 'N1' && (isG3 || tSize >= 5 || ki67Val >= 20));

    return {
      isHighRisk: factors.length > 0 || isAbemaciclibCandidate,
      factors,
      isG3,
      isHighKi67,
      isNPlus,
      isAbemaciclibCandidate
    };
  }, [localMarkers]);

  const getDoseDisplay = (drug: DrugDetail, isInitial: boolean = false): string => {
    if (isInitial && drug.lockedLoadingDose) return drug.lockedLoadingDose;
    if (!isInitial && drug.lockedDose) return drug.lockedDose;

    const h = patient.height || 0;
    const w = patient.weight || 0;
    if (h <= 0 || w <= 0) return "--";

    const bsa = Math.max(0, 0.0061 * h + 0.0128 * w - 0.1529);
    const doseToUse = (isInitial && drug.loadingDose) ? drug.loadingDose : drug.standardDose;
    
    let val = 0;
    const unit = drug.unit.toLowerCase();
    
    if (unit.includes('m2') || unit.includes('m²')) {
      val = Math.round(doseToUse * bsa);
    } else if (unit.includes('kg')) {
      val = Math.round(doseToUse * w);
    } else if (unit === 'auc') {
      const scrVal = parseFloat(localMarkers.serumCreatinine || '0');
      if (scrVal > 0) {
        const gfr = ((140 - patient.age) * w * 1.04) / scrVal;
        val = Math.round(doseToUse * (gfr + 25));
      } else return "--";
    } else {
      val = doseToUse;
    }

    return val > 0 ? `${val} mg` : "--";
  };

  const handleUpdateMarkerField = (field: keyof ClinicalMarkers, value: any) => {
    if (isLocked) return;
    setLocalMarkers(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirmLock = () => {
    if (!detailedPlan) return;
    if (!patient.height || !patient.weight) {
      alert("请先完善患者身高体重数据。");
      return;
    }
    if (window.confirm("确定要锁定当前方案吗？锁定后剂量将固定，病理指标将不可修改。")) {
      const planToLock: DetailedRegimenPlan = JSON.parse(JSON.stringify(detailedPlan));
      const processCategory = (opts: RegimenOption[], selectedId?: string) => {
        opts.forEach(opt => {
          if (opt.id === selectedId && opt.drugs) {
            opt.drugs.forEach(drug => {
              drug.lockedDose = getDoseDisplay(drug, false);
              if (drug.loadingDose) {
                drug.lockedLoadingDose = getDoseDisplay(drug, true);
              }
            });
          }
        });
      };
      processCategory(planToLock.chemoOptions, selectedRegimens.chemoId);
      processCategory(planToLock.endocrineOptions, selectedRegimens.endocrineId);
      processCategory(planToLock.targetOptions, selectedRegimens.targetId);
      processCategory(planToLock.immuneOptions, selectedRegimens.immuneId);
      onSaveDetailedPlan(planToLock, selectedRegimens, true, localMarkers);
      setDetailedPlan(planToLock);
    }
  };

  const handleUnlock = () => {
    if (window.confirm("解除固化后将恢复实时计算，确认继续？")) {
      onSaveDetailedPlan(detailedPlan!, selectedRegimens, false, localMarkers);
    }
  };

  const RegimenCard = ({ opt, typeKey }: { opt: RegimenOption, typeKey: keyof SelectedRegimens }) => {
    const isSelected = selectedRegimens[typeKey] === opt.id;
    if (isLocked && !isSelected) return null;
    return (
      <div 
        onClick={() => !isLocked && setSelectedRegimens({ ...selectedRegimens, [typeKey]: opt.id })}
        className={`p-3 rounded-lg border transition-all cursor-pointer ${
          isSelected ? 'border-medical-500 bg-medical-50 shadow-sm' : 'border-gray-100 bg-white opacity-60'
        }`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-sm text-gray-800">{opt.name}</span>
          {isSelected && isLocked && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">已固化</span>}
        </div>
        <p className="text-[11px] text-gray-500 mb-2">{opt.description}</p>
        {isSelected && opt.drugs && (
          <div className="space-y-1">
            {opt.drugs.map((drug, i) => (
              <div key={i} className="flex justify-between text-[11px] bg-white/60 p-1.5 rounded border border-white">
                <span className="text-gray-600">{drug.name}</span>
                <span className={`font-bold ${isLocked ? 'text-blue-600' : 'text-medical-600'}`}>
                  {getDoseDisplay(drug)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const optionsToCalculate = [
    detailedPlan?.chemoOptions.find(o => o.id === selectedRegimens.chemoId),
    detailedPlan?.endocrineOptions.find(o => o.id === selectedRegimens.endocrineId),
    detailedPlan?.targetOptions.find(o => o.id === selectedRegimens.targetId),
    detailedPlan?.immuneOptions.find(o => o.id === selectedRegimens.immuneId)
  ].filter(Boolean) as RegimenOption[];

  return (
    <div className="space-y-6 pb-20">
      {/* 临床指标区域 */}
      <section className={`p-4 rounded-xl border transition-all ${isLocked ? 'bg-blue-50/20 border-blue-100' : 'bg-white border-gray-100 shadow-sm'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-700 flex items-center">
            临床指标
            {riskAssessment.isHighRisk && !isLocked && (
              <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md animate-pulse">
                监测到决策关键特征
              </span>
            )}
          </h3>
          {isLocked && (
            <button onClick={handleUnlock} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded flex items-center font-bold">
              解除固化
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tight">ER 状态</label>
            <select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white outline-none" value={localMarkers.erStatus} onChange={(e) => handleUpdateMarkerField('erStatus', e.target.value)}>
              <option value="0%">0% (阴性)</option>
              <option value="1%-10%">1%-10%</option>
              <option value="10%-50%">10%-50%</option>
              <option value=">50%">&gt;50%</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tight">绝经状态</label>
            <select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white outline-none" value={localMarkers.menopause ? 'yes' : 'no'} onChange={(e) => handleUpdateMarkerField('menopause', e.target.value === 'yes')}>
              <option value="no">未绝经 (Pre-meno)</option>
              <option value="yes">已绝经 (Post-meno)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tight">HER2</label>
            <select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white outline-none" value={localMarkers.her2Status} onChange={(e) => handleUpdateMarkerField('her2Status', e.target.value)}>
              <option value="0">0 (阴性)</option>
              <option value="1+">1+ (阴性)</option>
              <option value="2+">2+ (需检测FISH)</option>
              <option value="3+">3+ (阳性)</option>
            </select>
          </div>
          <div>
            <label className={`block text-[10px] font-bold mb-1 uppercase tracking-tight ${riskAssessment.isHighKi67 ? 'text-red-600' : 'text-gray-400'}`}>
              Ki-67 (%) {riskAssessment.isHighKi67 && '⚠️'}
            </label>
            <input 
              type="number" 
              disabled={isLocked} 
              placeholder="例如: 30" 
              className={`w-full p-2 text-sm border rounded outline-none transition-colors ${riskAssessment.isHighKi67 ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`} 
              value={localMarkers.ki67.replace('%', '')} 
              onChange={(e) => handleUpdateMarkerField('ki67', e.target.value + '%')} 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-medical-600 mb-1 uppercase tracking-tight">肿瘤大小 (cT / cm)</label>
            <input type="text" disabled={isLocked} placeholder="例如: 2.5" className="w-full p-2 text-sm border border-medical-100 rounded outline-none" value={localMarkers.tumorSize} onChange={(e) => handleUpdateMarkerField('tumorSize', e.target.value)} />
          </div>
          <div>
            <label className={`block text-[10px] font-bold mb-1 uppercase tracking-tight ${riskAssessment.isNPlus ? 'text-red-600' : 'text-medical-600'}`}>
              淋巴结 (cN) {riskAssessment.isNPlus && '⚠️'}
            </label>
            <select 
              disabled={isLocked} 
              className={`w-full p-2 text-sm border rounded bg-white outline-none transition-colors ${riskAssessment.isNPlus ? 'border-red-300 bg-red-50/30 text-red-700' : 'border-medical-100'}`} 
              value={localMarkers.nodeStatus} 
              onChange={(e) => handleUpdateMarkerField('nodeStatus', e.target.value)}
            >
              <option value="N0">N0 (无转移)</option>
              <option value="N1">N1 (同侧腋窝)</option>
              <option value="N2">N2 (融合/内乳)</option>
              <option value="N3">N3 (锁骨上/下)</option>
            </select>
          </div>

          <div>
            <label className={`block text-[10px] font-bold mb-1 uppercase tracking-tight ${riskAssessment.isG3 ? 'text-red-600' : 'text-gray-400'}`}>
              组织学分级 (Grade) {riskAssessment.isG3 && '⚠️'}
            </label>
            <select 
              disabled={isLocked} 
              className={`w-full p-2 text-sm border rounded bg-white outline-none transition-colors ${riskAssessment.isG3 ? 'border-red-300 bg-red-50/30 text-red-700' : 'border-gray-200'}`} 
              value={localMarkers.histologicalGrade} 
              onChange={(e) => handleUpdateMarkerField('histologicalGrade', e.target.value)}
            >
              <option value="G1">G1 (高分化)</option>
              <option value="G2">G2 (中分化)</option>
              <option value="G3">G3 (低分化)</option>
            </select>
          </div>
          <div className="relative">
            <label className="block text-[10px] font-bold text-accent-700 mb-1 uppercase tracking-tight">基因检测 (RS/MP 评分)</label>
            <input type="text" disabled={isLocked} placeholder="例如: 18" className="w-full p-2 text-sm border border-accent-200 rounded bg-accent-50/20 outline-none placeholder:text-accent-300" value={localMarkers.geneticTestResult || ''} onChange={(e) => handleUpdateMarkerField('geneticTestResult', e.target.value)} />
          </div>
        </div>

        {/* 实时风险评估小板 */}
        {!isLocked && riskAssessment.isHighRisk && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
             <div className="text-[10px] font-bold text-red-700 uppercase mb-1 flex items-center">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" /></svg>
                决策关键特征 (Key Drivers)
             </div>
             <div className="flex flex-wrap gap-1.5 mt-2">
                {riskAssessment.factors.map(f => (
                  <span key={f} className="text-[9px] bg-white text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-bold">● {f}</span>
                ))}
                {riskAssessment.isAbemaciclibCandidate && (
                  <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold shadow-sm">
                    MonarchE 高危标准符合
                  </span>
                )}
             </div>
             {riskAssessment.isAbemaciclibCandidate && (
                <p className="text-[9px] text-red-600 mt-2 font-medium bg-white/50 p-1.5 rounded border border-red-100">
                  提示：符合强化内分泌治疗准则。建议考虑 CDK4/6 抑制剂（阿贝西利）辅助治疗 2 年。
                </p>
             )}
          </div>
        )}

        {!isLocked && (
          <button onClick={() => {
            onUpdateMarkers(localMarkers);
            const opts = generateLocalTreatmentOptions(patient, localMarkers);
            if (opts.length > 0) {
              setOptions(opts);
              const firstId = opts.find(o => o.recommended)?.id || opts[0].id;
              setSelectedPlanId(firstId);
              onSaveOptions(opts, firstId);
            }
          }} className="w-full mt-5 py-2.5 bg-medical-600 text-white rounded-lg text-xs font-bold shadow-sm active:scale-[0.98] transition-transform">
            1. 分析病情并更新路径
          </button>
        )}
      </section>

      {/* 路径分析结果 */}
      {options.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase ml-1">推荐路径</h3>
          {options.map(o => {
            const isSelected = selectedPlanId === o.id;
            if (isLocked && !isSelected) return null;
            return (
              <div key={o.id} onClick={() => !isLocked && setSelectedPlanId(o.id)} className={`p-3 border-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'border-medical-600 bg-medical-50 shadow-sm ring-1 ring-medical-200' : 'border-transparent bg-white opacity-60'}`}>
                <div className="flex justify-between items-center">
                  <div className="font-bold text-sm flex items-center">
                    {o.title}
                    {isSelected && riskAssessment.isHighRisk && o.id !== 'path_conservative' && (
                      <span className="ml-2 text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded">强化推荐</span>
                    )}
                  </div>
                  {o.recommended && !isLocked && <span className="text-[10px] bg-medical-600 text-white px-2 py-0.5 rounded-full">指南推荐</span>}
                </div>
                <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">{o.description}</div>
                {isSelected && o.pros && o.pros.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {o.pros.map((p, i) => <span key={i} className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{p}</span>)}
                  </div>
                )}
              </div>
            );
          })}
          {!isLocked && selectedPlanId && (
            <button onClick={() => {
              const sel = options.find(o => o.id === selectedPlanId);
              if (sel) {
                const plan = generateLocalDetailedRegimens(patient, localMarkers, sel);
                setDetailedPlan(plan);
                const initial: SelectedRegimens = {};
                if (plan.chemoOptions.length > 0) initial.chemoId = plan.chemoOptions[0].id;
                if (plan.endocrineOptions.length > 0) initial.endocrineId = plan.endocrineOptions[0].id;
                if (plan.targetOptions.length > 0) initial.targetId = plan.targetOptions[0].id;
                if (plan.immuneOptions.length > 0) initial.immuneId = plan.immuneOptions[0].id;
                setSelectedRegimens(initial);
              }
            }} className="w-full py-2.5 bg-accent-600 text-white rounded-lg text-xs font-bold shadow-md">
              2. 生成具体用药
            </button>
          )}
        </section>
      )}

      {/* 具体用药方案 */}
      {detailedPlan && (
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-800">用药明细确认</h3>
            {riskAssessment.isAbemaciclibCandidate && (
              <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100 flex items-center">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                已包含阿贝西利强化
              </span>
            )}
          </div>
          {detailedPlan.chemoOptions.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">化疗方案 (Chemo)</div>
              <div className="space-y-2">
                {detailedPlan.chemoOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="chemoId" />)}
              </div>
            </div>
          )}
          {detailedPlan.targetOptions.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">靶向方案 (Target)</div>
              <div className="space-y-2">
                {detailedPlan.targetOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="targetId" />)}
              </div>
            </div>
          )}
          {detailedPlan.endocrineOptions.length > 0 && (
            <div>
                <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">内分泌及强化方案 (Endocrine)</div>
                <div className="space-y-2">
                    {detailedPlan.endocrineOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="endocrineId" />)}
                </div>
            </div>
          )}
          {optionsToCalculate.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-6">
              <DosageCalculator 
                options={optionsToCalculate} 
                initialHeight={patient.height} 
                initialWeight={patient.weight} 
                onUpdateStats={(h, w) => onUpdatePatientStats?.(h, w)} 
                patientAge={patient.age}
                scr={localMarkers.serumCreatinine}
                isLocked={isLocked}
              />
              <ScheduleGenerator 
                selectedOptions={optionsToCalculate} 
                onSaveEvents={onBatchAddEvents || (() => {})} 
                patientHeight={patient.height} 
                patientWeight={patient.weight} 
                patientAge={patient.age} 
                scr={localMarkers.serumCreatinine}
                isLocked={isLocked}
              />
              {!isLocked && (
                <button onClick={handleConfirmLock} className="w-full py-4 bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg">
                  锁定方案并固化剂量
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
