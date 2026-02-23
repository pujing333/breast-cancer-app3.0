
import React, { useState, useEffect } from 'react';
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, RegimenOption, SelectedRegimens, TreatmentEvent, DrugDetail } from '../types';
import { generateLocalTreatmentOptions, generateLocalDetailedRegimens, inferMolecularSubtype, inferClinicalStage } from '../services/localMedicalRules';
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
  const [analysisSummary, setAnalysisSummary] = useState<{ subtype: string, stage: string } | null>(null);
  
  useEffect(() => {
    setLocalMarkers(patient.markers);
  }, [patient.markers]);

  useEffect(() => {
    setSelectedPlanId(patient.selectedPlanId);
  }, [patient.selectedPlanId]);

  const isLocked = !!patient.isPlanLocked;
  const detailedPlan = patient.detailedPlan;
  const selectedRegimens = patient.selectedRegimens || {};
  const options = patient.treatmentOptions || [];

  const handleUpdateMarkerField = (field: keyof ClinicalMarkers, value: any) => {
    if (isLocked) return;
    const newMarkers = { ...localMarkers, [field]: value };
    setLocalMarkers(newMarkers);
    onUpdateMarkers(newMarkers);
  };

  const handleInputChange = (field: keyof ClinicalMarkers) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    handleUpdateMarkerField(field, e.target.value);
  };

  const handleUpdateSelection = (typeKey: keyof SelectedRegimens, id: string) => {
    if (isLocked || !detailedPlan) return;
    const newSelected = { ...selectedRegimens, [typeKey]: id };
    onSaveDetailedPlan(detailedPlan, newSelected, false, localMarkers);
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
    if (unit.includes('M2') || unit.includes('M²')) val = Math.round(doseToUse * bsa);
    else if (unit.includes('KG')) val = Math.round(doseToUse * w);
    else if (unit === 'AUC') {
      const scrVal = parseFloat(localMarkers.serumCreatinine || '0');
      if (scrVal > 0) {
        const age = patient.age || 50;
        const gfr = ((140 - age) * w * 1.04) / scrVal;
        val = Math.round(doseToUse * (gfr + 25));
      } else return "需肌酐";
    } else val = doseToUse;
    return val > 0 ? `${val} mg` : "--";
  };

  const validateAndAnalyze = () => {
    const missingFields = [];
    if (!localMarkers.erStatus) missingFields.push("ER状态");
    if (!localMarkers.her2Status) missingFields.push("HER2状态");
    if (!localMarkers.tumorSize) missingFields.push("cT分期");
    if (!localMarkers.nodeStatus) missingFields.push("cN分期");
    
    if (missingFields.length > 0) {
      alert(`请补充以下核心指标以进行路径分析：\n${missingFields.join('、')}`);
      return;
    }

    const subtype = inferMolecularSubtype(localMarkers);
    const stage = inferClinicalStage(localMarkers);
    setAnalysisSummary({ subtype, stage });

    const newOpts = generateLocalTreatmentOptions({ ...patient, subtype, markers: localMarkers }, localMarkers);
    onSaveOptions(newOpts, newOpts[0]?.id);
  };

  const handleConfirmLock = () => {
    if (!detailedPlan || !patient.height || !patient.weight) {
      alert("请完整录入患者身高、体重以固化剂量。");
      return;
    }
    if (window.confirm("方案锁定后，计算出的具体剂量将无法更改。是否继续？")) {
      const planToLock: DetailedRegimenPlan = JSON.parse(JSON.stringify(detailedPlan));
      const categoryMap: Record<string, keyof SelectedRegimens> = {
        chemoOptions: 'chemoId',
        ofsOptions: 'ofsId',
        oralEndocrineOptions: 'oralEndocrineId',
        targetOptions: 'targetId',
        cdk46Options: 'cdk46Id'
      };
      Object.keys(categoryMap).forEach(cat => {
        const typeKey = categoryMap[cat];
        const selId = selectedRegimens[typeKey];
        if (selId) {
          (planToLock as any)[cat].forEach((opt: RegimenOption) => {
            if (opt.id === selId && opt.drugs) {
                opt.drugs.forEach(d => {
                    d.lockedDose = getDoseDisplay(d, false);
                    if (d.loadingDose) d.lockedLoadingDose = getDoseDisplay(d, true);
                });
            }
          });
        }
      });
      onSaveDetailedPlan(planToLock, selectedRegimens, true, localMarkers);
    }
  };

  const renderRegimenGrid = (opts: RegimenOption[], typeKey: keyof SelectedRegimens, activeColor: string) => {
    if (!opts || opts.length === 0) return null;
    return (
      <div className="flex flex-col gap-2">
        {opts.map(o => {
          const isSelected = selectedRegimens[typeKey] === o.id;
          if (isLocked && !isSelected) return null;
          return (
            <div
              key={o.id}
              onClick={() => handleUpdateSelection(typeKey, o.id)}
              className={`p-3 rounded-xl border text-left transition-all relative cursor-pointer active:scale-[0.98] select-none ${
                isSelected 
                  ? `${activeColor} border-transparent shadow-md ring-2 ring-offset-2 ring-transparent` 
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>{o.name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>{o.description} {o.cycle && `(${o.cycle})`}</span>
                </div>
                {isSelected && (
                  <div className="bg-white/20 p-1 rounded-full">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                  </div>
                )}
              </div>
              {isSelected && o.drugs && o.drugs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
                  {o.drugs.map((d, i) => (
                    <div key={i} className="flex justify-between text-[11px] text-white/90">
                      <span>{d.name}</span>
                      <span className="font-mono font-bold">{getDoseDisplay(d, false)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const activeOptions = detailedPlan ? [
    detailedPlan.chemoOptions.find(o => o.id === selectedRegimens.chemoId),
    detailedPlan.ofsOptions.find(o => o.id === selectedRegimens.ofsId),
    detailedPlan.oralEndocrineOptions.find(o => o.id === selectedRegimens.oralEndocrineId),
    detailedPlan.targetOptions.find(o => o.id === selectedRegimens.targetId),
    detailedPlan.cdk46Options.find(o => o.id === selectedRegimens.cdk46Id)
  ].filter(Boolean) as RegimenOption[] : [];

  // 安全处理 Ki67 的显示值
  const ki67DisplayValue = (localMarkers.ki67 || '').replace('%', '').replace('待查', '');

  return (
    <div className="space-y-6 pb-20">
      <section className="p-4 rounded-xl border bg-white shadow-sm border-gray-100">
        <h3 className="text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest">核心临床指标录入</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">ER 状态</label>
            <select disabled={isLocked} className="w-full p-2.5 text-sm border rounded bg-white" value={localMarkers.erStatus || ''} onChange={handleInputChange('erStatus')}><option value="">待录入</option><option value="0%">0%</option><option value="1%-10%">1%-10%</option><option value="10%-50%">10%-50%</option><option value=">50%">&gt;50%</option></select>
          </div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">PR 状态</label>
            <select disabled={isLocked} className="w-full p-2.5 text-sm border rounded bg-white" value={localMarkers.prStatus || ''} onChange={handleInputChange('prStatus')}><option value="">待录入</option><option value="0%">0%</option><option value="1%-10%">1%-10%</option><option value=">10%">&gt;10%</option></select>
          </div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">HER2 状态</label>
            <select disabled={isLocked} className="w-full p-2.5 text-sm border rounded bg-white" value={localMarkers.her2Status || ''} onChange={handleInputChange('her2Status')}><option value="">待录入</option><option value="0">0</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option></select>
          </div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">Ki-67 (%)</label>
            <input type="number" disabled={isLocked} className="w-full p-2.5 text-sm border rounded" value={ki67DisplayValue} onChange={(e) => handleUpdateMarkerField('ki67', e.target.value + '%')} placeholder="30" />
          </div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">组织分级</label>
            <select disabled={isLocked} className="w-full p-2.5 text-sm border rounded bg-white" value={localMarkers.histologicalGrade || ''} onChange={handleInputChange('histologicalGrade')}><option value="">待选</option><option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option></select>
          </div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">血肌酐 Scr (umol/L)</label>
            <input type="number" disabled={isLocked} className="w-full p-2.5 text-sm border rounded" value={localMarkers.serumCreatinine || ''} onChange={handleInputChange('serumCreatinine')} placeholder="如 70" />
          </div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">绝经状态</label>
            <select disabled={isLocked} className="w-full p-2.5 text-sm border rounded bg-white" value={localMarkers.menopause ? 'yes' : 'no'} onChange={(e) => handleUpdateMarkerField('menopause', e.target.value === 'yes')}><option value="no">绝经前</option><option value="yes">绝经后</option></select>
          </div>
          <div><label className="text-[10px] text-gray-400 font-bold mb-1 block">cT (分期)</label>
            <select disabled={isLocked} className="w-full p-2.5 text-sm border rounded bg-white" value={localMarkers.tumorSize || ''} onChange={handleInputChange('tumorSize')}><option value="">待选</option><option value="T1(≤2cm)">T1 (≤2cm)</option><option value="T2(2-5cm)">T2 (2-5cm)</option><option value="T3(>5cm)">T3 (>5cm)</option></select>
          </div>
          <div className="col-span-2"><label className="text-[10px] text-gray-400 font-bold mb-1 block">cN (淋巴结情况)</label>
            <select disabled={isLocked} className="w-full p-2.5 text-sm border rounded bg-white" value={localMarkers.nodeStatus || ''} onChange={handleInputChange('nodeStatus')}><option value="">待选</option><option value="N0(阴性)">N0 (阴性)</option><option value="N1(1-3个)">N1 (1-3个)</option><option value="N2(4-9个)">N2 (4-9个)</option><option value="N3(≥10个)">N3 (≥10个)</option></select>
          </div>
        </div>
        {!isLocked && (
          <button 
            onClick={validateAndAnalyze}
            className="w-full mt-4 py-3 bg-medical-600 text-white rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all"
          >
            1. 分析临床情况并确认路径
          </button>
        )}
      </section>

      {analysisSummary && (
        <section className="bg-accent-50 border border-accent-100 p-4 rounded-xl animate-fade-in">
          <h3 className="text-xs font-bold text-accent-700 mb-2 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
            诊断分析结果
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-2 rounded border border-accent-200 shadow-sm">
               <span className="text-[10px] text-gray-400 block mb-1">建议分子分型</span>
               <span className="text-sm font-bold text-accent-700">{analysisSummary.subtype}</span>
            </div>
            <div className="bg-white p-2 rounded border border-accent-200 shadow-sm">
               <span className="text-[10px] text-gray-400 block mb-1">建议临床分期</span>
               <span className="text-sm font-bold text-accent-700">{analysisSummary.stage}</span>
            </div>
          </div>
        </section>
      )}

      {!isLocked && options.length > 0 && (
        <section className="space-y-3">
          {options.map(o => (
            <div key={o.id} onClick={() => setSelectedPlanId(o.id)} className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedPlanId === o.id ? 'border-medical-600 bg-medical-50 shadow-inner' : 'border-transparent bg-white shadow-sm'}`}>
              <div className="flex justify-between items-start">
                <div className="font-bold text-sm text-gray-900">{o.title}</div>
                {o.recommended && <span className="bg-orange-100 text-orange-700 text-[9px] px-1.5 py-0.5 rounded font-bold">首选推荐</span>}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">{o.description}</div>
            </div>
          ))}
          <button onClick={() => {
              const sel = options.find(o => o.id === selectedPlanId);
              if (sel) {
                const plan = generateLocalDetailedRegimens(patient, localMarkers, sel);
                onSaveDetailedPlan(plan, { 
                    chemoId: plan.chemoOptions[0]?.id, 
                    targetId: plan.targetOptions[0]?.id,
                    cdk46Id: plan.cdk46Options.find(o => o.recommended)?.id || 'cdk_none',
                    ofsId: plan.ofsOptions.find(o => o.recommended)?.id || 'ofs_none',
                    oralEndocrineId: plan.oralEndocrineOptions[0]?.id
                }, false, localMarkers);
              }
          }} className="w-full py-3 bg-accent-600 text-white rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-all">2. 锁定路径并展开详细方案</button>
        </section>
      )}

      {detailedPlan && (
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-8 animate-fade-in">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center justify-between">
            <span>处方方案精选 (Button Grid模式)</span>
            {!isLocked && <span className="text-[10px] text-gray-400 font-normal">点击色块即可完成改选</span>}
          </h3>
          
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">辅助化疗方案</div>
            {renderRegimenGrid(detailedPlan.chemoOptions, "chemoId", "bg-medical-600")}
          </div>
          
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-pink-500 uppercase tracking-wider">Anti-HER2 靶向方案</div>
            {renderRegimenGrid(detailedPlan.targetOptions, "targetId", "bg-pink-600")}
          </div>
          
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">CDK4/6 抑制剂强化</div>
            {renderRegimenGrid(detailedPlan.cdk46Options, "cdk46Id", "bg-orange-600")}
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">卵巢功能抑制 (OFS 针剂)</div>
            {renderRegimenGrid(detailedPlan.ofsOptions, "ofsId", "bg-indigo-600")}
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">口服内分泌药物 (AI/TAM)</div>
            {renderRegimenGrid(detailedPlan.oralEndocrineOptions, "oralEndocrineId", "bg-teal-600")}
          </div>

          {activeOptions.length > 0 && (
            <div className="pt-8 border-t border-gray-100 space-y-8">
              <DosageCalculator 
                options={activeOptions} 
                initialHeight={patient.height} 
                initialWeight={patient.weight} 
                onUpdateStats={(h, w) => onUpdatePatientStats?.(h, w)} 
                patientAge={patient.age} 
                scr={localMarkers.serumCreatinine} 
                isLocked={isLocked} 
              />
              <ScheduleGenerator 
                selectedOptions={activeOptions} 
                onSaveEvents={onBatchAddEvents || (() => {})} 
                patientHeight={patient.height} 
                patientWeight={patient.weight} 
                patientAge={patient.age} 
                scr={localMarkers.serumCreatinine} 
                isLocked={isLocked} 
              />
              {!isLocked && (
                <button onClick={handleConfirmLock} className="w-full py-4 bg-green-600 text-white rounded-xl text-base font-bold shadow-xl active:scale-95 transition-all">
                  3. 确认方案并固化最终剂量
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
