
import React, { useState, useEffect } from 'react';
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
  
  useEffect(() => {
    setSelectedPlanId(patient.selectedPlanId);
  }, [patient.selectedPlanId]);

  const isLocked = !!patient.isPlanLocked;
  const detailedPlan = patient.detailedPlan;
  const selectedRegimens = patient.selectedRegimens || {};
  const options = patient.treatmentOptions || [];

  const handleUpdateSelection = (typeKey: keyof SelectedRegimens, id: string) => {
    if (isLocked) return;
    if (!detailedPlan) return;
    onSaveDetailedPlan(detailedPlan, { ...selectedRegimens, [typeKey]: id }, false, localMarkers);
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
    if (unit.includes('M2')) val = Math.round(doseToUse * bsa);
    else if (unit.includes('KG')) val = Math.round(doseToUse * w);
    else if (unit === 'AUC') {
      const scrVal = parseFloat(localMarkers.serumCreatinine || '0');
      if (scrVal > 0) {
        const age = patient.age || 50;
        const gfr = ((140 - age) * w * 1.04) / scrVal;
        val = Math.round(doseToUse * (gfr + 25));
      } else return "需肌酐";
    } else val = doseToUse;
    return val > 0 ? `${val} ${unit === 'AUC' ? 'mg' : unit.replace(/\/.*/, '')}` : "--";
  };

  const handleConfirmLock = () => {
    if (!detailedPlan || !patient.height || !patient.weight) {
      alert("请确保录入患者身高体重。");
      return;
    }
    if (window.confirm("确定锁定该治疗方案并固化剂量吗？")) {
      const planToLock: DetailedRegimenPlan = JSON.parse(JSON.stringify(detailedPlan));
      const processRegimen = (opt: RegimenOption) => {
        opt.drugs?.forEach(d => {
          d.lockedDose = getDoseDisplay(d, false);
          if (d.loadingDose) d.lockedLoadingDose = getDoseDisplay(d, true);
        });
      };
      ['chemoOptions', 'endocrineOptions', 'targetOptions', 'immuneOptions', 'cdk46Options'].forEach(cat => {
        const selId = (selectedRegimens as any)[cat.replace('Options', 'Id')];
        if (selId) (planToLock as any)[cat].forEach((opt: RegimenOption) => { if (opt.id === selId) processRegimen(opt); });
      });
      onSaveDetailedPlan(planToLock, selectedRegimens, true, localMarkers);
    }
  };

  const TagOption = ({ opt, typeKey }: { opt: RegimenOption, typeKey: keyof SelectedRegimens }) => {
    const isSelected = selectedRegimens[typeKey] === opt.id;
    if (isLocked && !isSelected) return null;
    return (
      <button 
        onClick={() => handleUpdateSelection(typeKey, opt.id)}
        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
            isSelected ? 'bg-medical-600 text-white border-medical-600 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-medical-300'
        }`}
      >
        {opt.name}
      </button>
    );
  };

  const RegimenCard = ({ opt, typeKey }: { opt: RegimenOption, typeKey: keyof SelectedRegimens }) => {
    const isSelected = selectedRegimens[typeKey] === opt.id;
    if (isLocked && !isSelected) return null;
    return (
      <div 
        onClick={() => handleUpdateSelection(typeKey, opt.id)}
        className={`p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-medical-500 bg-medical-50 ring-1 ring-medical-200' : 'border-gray-200 bg-white hover:border-medical-300'}`}
      >
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="font-bold text-sm text-gray-900">{opt.name}</span>
            <span className="text-[10px] text-gray-500">{opt.description}</span>
          </div>
          {isSelected && <span className="text-medical-600"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg></span>}
        </div>
        {isSelected && opt.drugs && (
          <div className="mt-2 pt-2 border-t border-medical-100 space-y-1">
            {opt.drugs.map((d, i) => (
              <div key={i} className="flex justify-between text-[11px]"><span className="text-gray-600">{d.name}</span><span className="font-bold text-medical-600">{getDoseDisplay(d, false)}</span></div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const optionsToCalculate = detailedPlan ? [
    detailedPlan.chemoOptions.find(o => o.id === selectedRegimens.chemoId),
    detailedPlan.endocrineOptions.find(o => o.id === selectedRegimens.endocrineId),
    detailedPlan.targetOptions.find(o => o.id === selectedRegimens.targetId),
    detailedPlan.cdk46Options.find(o => o.id === selectedRegimens.cdk46Id)
  ].filter(Boolean) as RegimenOption[] : [];

  return (
    <div className="space-y-6 pb-20">
      <section className="p-4 rounded-xl border bg-white shadow-sm border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">核心临床数据</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">ER 状态</label><select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white" value={localMarkers.erStatus} onChange={(e) => { const m = { ...localMarkers, erStatus: e.target.value }; setLocalMarkers(m); onUpdateMarkers(m); }}><option value="">待录入</option><option value="0%">0%</option><option value="1%-10%">1%-10%</option><option value="10%-50%">10%-50%</option><option value=">50%">&gt;50%</option></select></div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">绝经状态</label><select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white" value={localMarkers.menopause ? 'yes' : 'no'} onChange={(e) => { const m = { ...localMarkers, menopause: e.target.value === 'yes' }; setLocalMarkers(m); onUpdateMarkers(m); }}><option value="no">绝经前</option><option value="yes">绝经后</option></select></div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">HER2 状态</label><select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white" value={localMarkers.her2Status} onChange={(e) => { const m = { ...localMarkers, her2Status: e.target.value }; setLocalMarkers(m); onUpdateMarkers(m); }}><option value="">待录入</option><option value="0">0</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option></select></div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">Ki-67 (%)</label><input type="number" disabled={isLocked} className="w-full p-2 text-sm border rounded" value={localMarkers.ki67.replace('%', '')} onChange={(e) => { const m = { ...localMarkers, ki67: e.target.value + '%' }; setLocalMarkers(m); onUpdateMarkers(m); }} placeholder="20" /></div>
        </div>
        {!isLocked && <button onClick={() => {
            const m = localMarkers;
            let subtype = MolecularSubtype.Unknown;
            if (m.her2Status.includes('3+')) subtype = MolecularSubtype.HER2Positive;
            else if (m.erStatus !== '' && m.erStatus !== '0%') subtype = MolecularSubtype.LuminalB;
            else if (m.erStatus === '0%') subtype = MolecularSubtype.TripleNegative;
            const newOpts = generateLocalTreatmentOptions({ ...patient, subtype, markers: m }, m);
            onSaveOptions(newOpts, newOpts[0]?.id);
        }} className="w-full mt-4 py-3 bg-medical-600 text-white rounded-lg text-sm font-bold shadow-md">1. 开启智能路径分析</button>}
      </section>

      {!isLocked && options.length > 0 && (
        <section className="space-y-2">
          {options.map(o => (
            <div key={o.id} onClick={() => setSelectedPlanId(o.id)} className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedPlanId === o.id ? 'border-medical-600 bg-medical-50' : 'border-transparent bg-white shadow-sm'}`}>
              <div className="font-bold text-sm text-gray-900">{o.title}</div>
              <div className="text-[11px] text-gray-500 mt-1">{o.description}</div>
            </div>
          ))}
          <button onClick={() => {
              const sel = options.find(o => o.id === selectedPlanId);
              if (sel) {
                const plan = generateLocalDetailedRegimens(patient, localMarkers, sel);
                onSaveDetailedPlan(plan, { chemoId: plan.chemoOptions[0]?.id, endocrineId: plan.endocrineOptions[0]?.id, targetId: plan.targetOptions[0]?.id, cdk46Id: plan.cdk46Options[0]?.id }, false, localMarkers);
              }
          }} className="w-full py-3 bg-accent-600 text-white rounded-xl text-sm font-bold shadow-lg mt-2">2. 生成药敏及强化方案库</button>
        </section>
      )}

      {detailedPlan && (
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-medical-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
            方案精选
          </h3>
          
          {detailedPlan.chemoOptions.length > 0 && (<div><div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">化疗 / 新辅助</div><div className="space-y-2">{detailedPlan.chemoOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="chemoId" />)}</div></div>)}
          
          {detailedPlan.targetOptions.length > 0 && (<div><div className="text-[10px] font-bold text-pink-500 mb-2 uppercase">Anti-HER2 靶向治疗</div><div className="space-y-2">{detailedPlan.targetOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="targetId" />)}</div></div>)}
          
          {detailedPlan.cdk46Options.length > 0 && (<div><div className="text-[10px] font-bold text-orange-500 mb-2 uppercase">CDK4/6 抑制剂 (可选标签)</div><div className="flex flex-wrap gap-2 mt-2">{detailedPlan.cdk46Options.map(o => <TagOption key={o.id} opt={o} typeKey="cdk46Id" />)}</div></div>)}
          
          {detailedPlan.endocrineOptions.length > 0 && (<div><div className="text-[10px] font-bold text-indigo-500 mb-2 uppercase">内分泌 / OFS 方案</div><div className="space-y-2 max-h-64 overflow-y-auto pr-1">{detailedPlan.endocrineOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="endocrineId" />)}</div></div>)}

          {optionsToCalculate.length > 0 && (
            <div className="pt-6 border-t border-gray-100 space-y-6">
              <DosageCalculator options={optionsToCalculate} initialHeight={patient.height} initialWeight={patient.weight} onUpdateStats={(h, w) => onUpdatePatientStats?.(h, w)} patientAge={patient.age} scr={localMarkers.serumCreatinine} isLocked={isLocked} />
              <ScheduleGenerator selectedOptions={optionsToCalculate} onSaveEvents={onBatchAddEvents || (() => {})} patientHeight={patient.height} patientWeight={patient.weight} patientAge={patient.age} scr={localMarkers.serumCreatinine} isLocked={isLocked} />
              {!isLocked && <button onClick={handleConfirmLock} className="w-full py-4 bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg">3. 锁定方案并固化最终处方</button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
