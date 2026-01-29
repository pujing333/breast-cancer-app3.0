
import React, { useState, useMemo } from 'react';
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, RegimenOption, SelectedRegimens, TreatmentEvent, DrugDetail, MolecularSubtype } from '../types';
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

  const handleUpdateMarkerField = (field: keyof ClinicalMarkers, value: any) => {
    if (isLocked) return;
    const newMarkers = { ...localMarkers, [field]: value };
    setLocalMarkers(newMarkers);
    onUpdateMarkers(newMarkers);
  };

  // 步骤1: 智能分析方案路径
  const handleGenerateOptions = () => {
    // 自动判定分子分型（简化逻辑）
    let detectedSubtype = MolecularSubtype.Unknown;
    const erPos = !localMarkers.erStatus.includes('0%');
    const her2Pos = localMarkers.her2Status.includes('3+');
    const ki67Val = parseFloat(localMarkers.ki67) || 0;

    if (her2Pos) detectedSubtype = MolecularSubtype.HER2Positive;
    else if (!erPos && !her2Pos) detectedSubtype = MolecularSubtype.TripleNegative;
    else if (erPos && ki67Val < 20) detectedSubtype = MolecularSubtype.LuminalA;
    else if (erPos) detectedSubtype = MolecularSubtype.LuminalB;

    const newOptions = generateLocalTreatmentOptions({ ...patient, subtype: detectedSubtype, markers: localMarkers }, localMarkers);
    setOptions(newOptions);
    
    // 默认选择推荐方案
    const recommended = newOptions.find(o => o.recommended);
    if (recommended) setSelectedPlanId(recommended.id);
    
    onSaveOptions(newOptions, recommended?.id);
  };

  const handleConfirmLock = () => {
    if (!detailedPlan) return;
    if (!patient.height || !patient.weight) {
      alert("请先完善患者身高体重数据。");
      return;
    }
    
    if (window.confirm("确定要锁定当前方案吗？锁定后剂量将固定，病理指标将不可修改。")) {
      const planToLock: DetailedRegimenPlan = JSON.parse(JSON.stringify(detailedPlan));
      
      const processRegimen = (opt: RegimenOption) => {
        if (opt.drugs) {
          opt.drugs.forEach(drug => {
            drug.lockedDose = getDoseDisplay(drug, false);
            if (drug.loadingDose) drug.lockedLoadingDose = getDoseDisplay(drug, true);
          });
        }
        if (opt.stages) {
          opt.stages.forEach(stage => {
            stage.drugs.forEach(drug => {
              drug.lockedDose = getDoseDisplay(drug, false);
              if (drug.loadingDose) drug.lockedLoadingDose = getDoseDisplay(drug, true);
            });
          });
        }
      };

      const categories = ['chemoOptions', 'endocrineOptions', 'targetOptions', 'immuneOptions'] as const;
      categories.forEach(cat => {
        const selectedId = selectedRegimens[cat.replace('Options', 'Id') as keyof SelectedRegimens];
        planToLock[cat].forEach(opt => {
          if (opt.id === selectedId) {
            processRegimen(opt);
          }
        });
      });

      onSaveDetailedPlan(planToLock, selectedRegimens, true, localMarkers);
      setDetailedPlan(planToLock);
    }
  };

  const getDoseDisplay = (drug: DrugDetail, isInitial: boolean = false): string => {
    if (isInitial && drug.lockedLoadingDose) return drug.lockedLoadingDose;
    if (!isInitial && drug.lockedDose) return drug.lockedDose;

    const h = patient.height || 0;
    const w = patient.weight || 0;
    if (h <= 0 || w <= 0) return "--";

    const bsa = Math.max(0, 0.0061 * h + 0.0128 * w - 0.1529);
    const doseToUse = (isInitial && drug.loadingDose) ? drug.loadingDose : drug.standardDose;
    
    let val = 0;
    const unit = drug.unit.toUpperCase();
    
    if (unit.includes('M2') || unit.includes('M²')) {
      val = Math.round(doseToUse * bsa);
    } else if (unit.includes('KG')) {
      val = Math.round(doseToUse * w);
    } else if (unit === 'AUC') {
      const scrVal = parseFloat(localMarkers.serumCreatinine || '0');
      if (scrVal > 0) {
        const age = patient.age || 50;
        const gfr = ((140 - age) * w * 1.04) / scrVal;
        val = Math.round(doseToUse * (gfr + 25));
      } else return "需血肌酐";
    } else {
      val = doseToUse;
    }

    return val > 0 ? `${val} mg` : "--";
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
        {isSelected && (opt.drugs || (opt.stages && opt.stages[0]?.drugs)) && (
          <div className="space-y-1">
            {(opt.drugs || opt.stages?.[0]?.drugs)?.map((drug, i) => (
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
      <section className={`p-4 rounded-xl border transition-all ${isLocked ? 'bg-blue-50/20 border-blue-100' : 'bg-white border-gray-100 shadow-sm'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-700 flex items-center">临床指标与化验结果</h3>
          {isLocked && <button onClick={handleUnlock} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded flex items-center font-bold">解除固化</button>}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tight">ER 状态</label>
            <select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white outline-none" value={localMarkers.erStatus} onChange={(e) => handleUpdateMarkerField('erStatus', e.target.value)}>
              <option value="0%">0% (阴性)</option><option value="1%-10%">1%-10%</option><option value="10%-50%">10%-50%</option><option value=">50%">&gt;50%</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tight">绝经状态</label>
            <select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white outline-none" value={localMarkers.menopause ? 'yes' : 'no'} onChange={(e) => handleUpdateMarkerField('menopause', e.target.value === 'yes')}>
              <option value="no">未绝经 (Pre-meno)</option><option value="yes">已绝经 (Post-meno)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tight">HER2</label>
            <select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white outline-none" value={localMarkers.her2Status} onChange={(e) => handleUpdateMarkerField('her2Status', e.target.value)}>
              <option value="0">0 (阴性)</option><option value="1+">1+ (阴性)</option><option value="2+">2+ (需检测FISH)</option><option value="3+">3+ (阳性)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-tight">Ki-67 (%)</label>
            <input type="number" disabled={isLocked} className="w-full p-2 text-sm border rounded outline-none" value={localMarkers.ki67.replace('%', '')} onChange={(e) => handleUpdateMarkerField('ki67', e.target.value + '%')} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-medical-600 mb-1 uppercase tracking-tight">肿瘤大小 (cT / cm)</label>
            <input type="text" disabled={isLocked} className="w-full p-2 text-sm border border-medical-100 rounded outline-none" value={localMarkers.tumorSize} onChange={(e) => handleUpdateMarkerField('tumorSize', e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-medical-600 mb-1 uppercase tracking-tight">淋巴结 (cN)</label>
            <select disabled={isLocked} className="w-full p-2 text-sm border border-medical-100 rounded bg-white outline-none" value={localMarkers.nodeStatus} onChange={(e) => handleUpdateMarkerField('nodeStatus', e.target.value)}>
              <option value="N0">N0 (无转移)</option><option value="N1">N1 (同侧腋窝)</option><option value="N2">N2 (融合/内乳)</option><option value="N3">N3 (锁骨上/下)</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-blue-700 mb-1 uppercase tracking-tight">血肌酐 (umol/L)</label>
            <input type="number" disabled={isLocked} placeholder="用于卡铂 AUC 计算" className="w-full p-2 text-sm border border-blue-200 rounded outline-none" value={localMarkers.serumCreatinine || ''} onChange={(e) => handleUpdateMarkerField('serumCreatinine', e.target.value)} />
          </div>
        </div>

        {!isLocked && options.length === 0 && (
          <button 
            onClick={handleGenerateOptions}
            className="w-full mt-4 py-3 bg-medical-600 text-white rounded-lg text-sm font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            1. 智能分析推荐路径
          </button>
        )}
      </section>

      {options.length > 0 && (
        <section className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase">推荐路径</h3>
            {!isLocked && <button onClick={handleGenerateOptions} className="text-[10px] text-medical-600 font-bold">重新分析</button>}
          </div>
          {options.map(o => {
            const isSelected = selectedPlanId === o.id;
            if (isLocked && !isSelected) return null;
            return (
              <div key={o.id} onClick={() => !isLocked && setSelectedPlanId(o.id)} className={`p-3 border-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'border-medical-600 bg-medical-50 shadow-sm' : 'border-transparent bg-white opacity-60'}`}>
                <div className="flex justify-between items-center"><div className="font-bold text-sm">{o.title}</div>{o.recommended && !isLocked && <span className="text-[10px] bg-medical-600 text-white px-2 py-0.5 rounded-full">指南推荐</span>}</div>
                <div className="text-[11px] text-gray-500 mt-1">{o.description}</div>
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
            }} className="w-full py-2.5 bg-accent-600 text-white rounded-lg text-xs font-bold shadow-md">2. 生成具体用药</button>
          )}
        </section>
      )}

      {detailedPlan && (
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-gray-800">用药明细确认</h3>
          {detailedPlan.chemoOptions.length > 0 && (<div><div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">化疗方案</div><div className="space-y-2">{detailedPlan.chemoOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="chemoId" />)}</div></div>)}
          {detailedPlan.targetOptions.length > 0 && (<div><div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">靶向方案</div><div className="space-y-2">{detailedPlan.targetOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="targetId" />)}</div></div>)}
          {detailedPlan.endocrineOptions.length > 0 && (<div><div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">内分泌及强化方案</div><div className="space-y-2">{detailedPlan.endocrineOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="endocrineId" />)}</div></div>)}
          
          {optionsToCalculate.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-6">
              <DosageCalculator options={optionsToCalculate} initialHeight={patient.height} initialWeight={patient.weight} onUpdateStats={(h, w) => onUpdatePatientStats?.(h, w)} patientAge={patient.age} scr={localMarkers.serumCreatinine} isLocked={isLocked} />
              <ScheduleGenerator selectedOptions={optionsToCalculate} onSaveEvents={onBatchAddEvents || (() => {})} patientHeight={patient.height} patientWeight={patient.weight} patientAge={patient.age} scr={localMarkers.serumCreatinine} isLocked={isLocked} />
              {!isLocked && <button onClick={handleConfirmLock} className="w-full py-4 bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg">3. 锁定方案并固化剂量</button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
