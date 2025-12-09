
export enum MolecularSubtype {
LuminalA = 'Luminal A',
LuminalB = 'Luminal B',
LuminalBLike = 'Luminal B-like',
HER2Positive = 'HER2 Positive',
HER2Enriched = 'HER2 Enriched',
TripleNegative = 'Triple Negative',
Unknown = '待定'
}

export enum TreatmentStage {
Diagnosis = '初步诊断',
Neoadjuvant = '新辅助治疗',
Surgery = '手术',
Adjuvant = '辅助治疗',
FollowUp = '随访'
}

export interface ClinicalMarkers {
erStatus: string; // Estrogen Receptor
prStatus: string; // Progesterone Receptor
her2Status: string; // HER2
ki67: string; // Proliferation index
tumorSize: string; // cT
nodeStatus: string; // cN
histologicalGrade: string; // Histological Grade (G1, G2, G3)
menopause: boolean; // Menopause status
geneticTestResult?: string; // 21-gene recurrence score (RS)
}

export interface TreatmentEvent {
id: string;
date: string;
title: string;
description: string;
completed: boolean;
type: 'medication' | 'surgery' | 'exam' | 'other';
sideEffects?: string[]; // List of side effects keys e.g. ['Nausea']
dosageDetails?: string; // 新增：用于在日程中显示锁定的剂量详情
}

export interface TreatmentOption {
id: string;
title: string;
iconType: 'surgery' | 'chemo' | 'drug' | 'observation';
description: string;
duration: string;
pros: string[];
cons: string[];
recommended: boolean;
}

export interface DrugDetail {
name: string;
standardDose: number; // mg/m2 or AUC
unit: string; // 'mg/m²' or 'AUC' or 'mg'
lockedDose?: string; // 新增：保存时计算出的具体剂量 (如 "450 mg")
}

export interface RegimenOption {
id: string;
name: string; // e.g. "AC-T"
description: string; // e.g. "Doxorubicin + Cyclophosphamide..."
cycle: string; // e.g. "q2w x 4"
type: 'chemo' | 'endocrine' | 'target' | 'immune';
recommended: boolean;
reasoning?: string; // Reason for recommendation
drugs?: DrugDetail[]; // Specific drugs in this regimen
totalCycles?: number; // e.g. 4 or 6 or 8
frequencyDays?: number; // e.g. 14 or 21
calculatedDose?: string; // Legacy field, keeping for compatibility
pros?: string[]; // Advantages
cons?: string[]; // Disadvantages/Side effects
}

export interface DetailedRegimenPlan {
chemoOptions: RegimenOption[];
endocrineOptions: RegimenOption[];
targetOptions: RegimenOption[];
immuneOptions: RegimenOption[];
}

export interface SelectedRegimens {
chemoId?: string;
endocrineId?: string;
targetId?: string;
immuneId?: string;
}

export interface SideEffectDetail {
strategies: string[]; // Nursing/Lifestyle advice
medications: string[]; // Recommended drugs
}

export interface Patient {
id: string;
name: string;
age: number;
mrn: string; // Medical Record Number
admissionDate: string;
diagnosis: string;
subtype: MolecularSubtype;
stage: TreatmentStage;
markers: ClinicalMarkers;

height?: number; // cm
weight?: number; // kg

phone?: string;
address?: string;
occupation?: string;

treatmentOptions?: TreatmentOption[]; // AI generated high-level options
selectedPlanId?: string; // The option the doctor selected

detailedPlan?: DetailedRegimenPlan; // AI generated specific drug options
selectedRegimens?: SelectedRegimens; // The specific drugs the doctor selected

isPlanLocked?: boolean; // 新增：标记方案是否已锁定，防止意外修改

aiSuggestion?: string; // Legacy text (optional)
timeline: TreatmentEvent[];
}
