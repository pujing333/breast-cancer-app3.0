
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, MolecularSubtype } from '../types';

/**
本地专家系统规则库 (2024/2025 指南版)
*/

const getTumorSize = (sizeStr: string): number => {
const size = parseFloat(sizeStr.replace(/[^\d.]/g, ''));
return isNaN(size) ? 0 : size;
};

const getNodeStage = (nodeStr: string): number => {
if (!nodeStr) return 0;
if (nodeStr.includes('N3')) return 3;
if (nodeStr.includes('N2')) return 2;
if (nodeStr.includes('N1')) return 1;
return 0; 
};

const getGrade = (gradeStr: string): number => {
    if (!gradeStr) return 0;
    if (gradeStr.includes('G3') || gradeStr.includes('3')) return 3;
    if (gradeStr.includes('G2') || gradeStr.includes('2')) return 2;
    if (gradeStr.includes('G1') || gradeStr.includes('1')) return 1;
    return 0; 
};

const getKi67 = (ki67Str: string): number => {
    if (!ki67Str) return 0;
    const val = parseFloat(ki67Str.replace(/[^\d.]/g, ''));
    return isNaN(val) ? 0 : val;
};

const getPercentage = (str: string): number => {
    if (!str || str === '0%' || str === '0') return 0;
    if (str === '1%-10%') return 5;
    if (str === '10%-50%') return 30;
    if (str === '>50%') return 75;
    const val = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(val) ? 0 : val;
};

const getRSScore = (scoreStr?: string): number | null => {
if (!scoreStr) return null;
const score = parseFloat(scoreStr.replace(/[^\d.]/g, ''));
return isNaN(score) ? null : score;
};

export const generateLocalTreatmentOptions = (patient: Patient, markers: ClinicalMarkers): TreatmentOption[] => {
const options: TreatmentOption[] = [];
const tSize = getTumorSize(markers.tumorSize);
const nStage = getNodeStage(markers.nodeStatus);
const grade = getGrade(markers.histologicalGrade);
const ki67 = getKi67(markers.ki67);
const subtype = patient.subtype;
const rsScore = getRSScore(markers.geneticTestResult);

const isHER2 = subtype === MolecularSubtype.HER2Positive || (markers.her2Status && markers.her2Status.includes('3+'));
const isTNBC = subtype === MolecularSubtype.TripleNegative;
const erVal = getPercentage(markers.erStatus);
const prVal = getPercentage(markers.prStatus);
const isHRPositive = erVal > 0 || prVal > 0;

// 判定高危特征
const isClinicalHighRisk = grade === 3 || ki67 >= 30 || nStage >= 1;

const needNeoadjuvant = (isHER2 || isTNBC) && (tSize > 2.0 || nStage >= 1);
const luminalNeoadjuvant = isHRPositive && !isHER2 && (nStage >= 3 || (nStage >= 2 && grade === 3));

// 核心决策：是否可以豁免化疗
let canWaiveChemo = false;
let waiverReason = "";
let waiverHighlyRecommended = false;

if (isHRPositive && !isHER2 && nStage <= 1) {
    if (rsScore !== null) {
        if (rsScore < 11) {
            canWaiveChemo = true;
            waiverHighlyRecommended = true;
            waiverReason = `RS评分 ${rsScore} (极低危)，强烈建议豁免化疗。`;
        } else if (rsScore >= 11 && rsScore < 26) {
            if (isClinicalHighRisk && rsScore >= 21) {
              canWaiveChemo = true;
              waiverReason = `RS评分 ${rsScore}。虽属低获益区，但合并临床高危因素(G3/Ki67高/N1)，请谨慎考虑是否豁免。`;
            } else {
              canWaiveChemo = true;
              waiverHighlyRecommended = (rsScore < 18);
              waiverReason = `RS评分 ${rsScore}。研究证实化疗获益极小，建议豁免。`;
            }
        } else {
            waiverReason = `RS评分 ${rsScore} (≥26)，建议化疗序贯内分泌。`;
        }
    } else {
        if (nStage === 0 && tSize <= 1.0 && grade <= 2 && ki67 < 15) {
            canWaiveChemo = true; 
            waiverHighlyRecommended = true;
            waiverReason = "极低危特征，可考虑豁免化疗。";
        } else if (!isClinicalHighRisk) {
            canWaiveChemo = true;
            waiverReason = "临床特征低危。建议基因检测以确定是否可豁免化疗。";
        } else {
            waiverReason = "临床表现为高危(G3或Ki-67高)，化疗获益可能性大。建议基因检测确认。";
        }
    }
}

const neoadjuvantOption: TreatmentOption = {
    id: 'path_neoadjuvant',
    title: '新辅助治疗 → 手术 → 辅助治疗',
    iconType: 'chemo',
    description: isClinicalHighRisk ? '高危患者优先考虑，降期并评价药敏。' : '术前降期，评价药敏。',
    duration: '6-8个月(术前) + 手术 + 术后',
    pros: ['直观评价药敏', '增加保乳机会'],
    cons: ['周期长'],
    recommended: false
};

const surgeryOption: TreatmentOption = {
    id: 'path_surgery',
    title: '手术 → 辅助治疗',
    iconType: 'surgery',
    description: '先行手术明确病理分期，再决定后续治疗。',
    duration: '1个月(手术) + 4-6个月(化疗) + 5-10年(内分泌)',
    pros: ['迅速去瘤', '分期精准'],
    cons: ['无体内药敏'],
    recommended: false
};

const conservativeOption: TreatmentOption = {
    id: 'path_conservative',
    title: '手术 → 单纯内分泌 (豁免化疗)',
    iconType: 'drug',
    description: waiverReason || '适用于低危HR+患者。',
    duration: '5-10年内分泌治疗',
    pros: ['生活质量极高', '无化疗毒性'],
    cons: ['需精准基因组评估'],
    recommended: false
};

if (needNeoadjuvant || luminalNeoadjuvant) {
    neoadjuvantOption.recommended = true;
    options.push(neoadjuvantOption, surgeryOption);
} else if (waiverHighlyRecommended) {
    conservativeOption.recommended = true;
    options.push(conservativeOption, surgeryOption);
} else if (canWaiveChemo) {
    surgeryOption.recommended = true;
    options.push(surgeryOption, conservativeOption);
} else {
    surgeryOption.recommended = true;
    options.push(surgeryOption, neoadjuvantOption);
}

return options;
};

export const generateLocalDetailedRegimens = (
patient: Patient,
markers: ClinicalMarkers,
highLevelPlan: TreatmentOption
): DetailedRegimenPlan => {
    const plan: DetailedRegimenPlan = {
    chemoOptions: [],
    endocrineOptions: [],
    targetOptions: [],
    immuneOptions: []
};

const tSize = getTumorSize(markers.tumorSize);
const nStage = getNodeStage(markers.nodeStatus);
const grade = getGrade(markers.histologicalGrade);
const ki67Val = getKi67(markers.ki67);
const isMeno = markers.menopause;
const erVal = getPercentage(markers.erStatus);
const prVal = getPercentage(markers.prStatus);

const subtype = patient.subtype;
const isHER2 = subtype === MolecularSubtype.HER2Positive || (markers.her2Status && markers.her2Status.includes('3+'));
const isTNBC = subtype === MolecularSubtype.TripleNegative;
const isHRPositive = erVal > 0 || prVal > 0;

const isClinicalHighRisk = grade === 3 || ki67Val >= 30 || nStage >= 1;

const isNeoadjuvantPath = highLevelPlan.id === 'path_neoadjuvant';
const isConservativePath = highLevelPlan.id === 'path_conservative';

if (!isConservativePath) {
    if (isHER2) {
        plan.chemoOptions.push({
            id: 'c_tchp',
            name: 'TCbHP (TCHP)',
            description: '多西他赛 + 卡铂 + 曲帕双靶',
            cycle: 'q3w × 6',
            type: 'chemo',
            recommended: true, 
            totalCycles: 6,
            frequencyDays: 21,
            drugs: [
                { name: '多西他赛', standardDose: 75, unit: 'mg/m²' },
                { name: '卡铂', standardDose: 6, unit: 'AUC' }
            ]
        });
    } else if (isTNBC || (erVal < 10 && erVal > 0)) {
        if (isNeoadjuvantPath) {
            plan.chemoOptions.push({
                id: 'c_kn522',
                name: 'TP-AC (KN522模式)',
                description: '紫杉+卡铂 → AC',
                cycle: '术前 8周期',
                type: 'chemo',
                recommended: true,
                totalCycles: 8,
                frequencyDays: 21,
                drugs: [
                    { name: '紫杉醇', standardDose: 80, unit: 'mg/m²' },
                    { name: '卡铂', standardDose: 5, unit: 'AUC' }, 
                    { name: '多柔比星', standardDose: 60, unit: 'mg/m²' },
                    { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }
                ]
            });
        } else {
            plan.chemoOptions.push({
                id: 'c_dd_act',
                name: 'ddAC-T (密集型)',
                description: 'AC (q2w) → T (q2w)',
                cycle: '8周期',
                type: 'chemo',
                recommended: true,
                totalCycles: 8,
                frequencyDays: 14,
                drugs: [
                    { name: '多柔比星', standardDose: 60, unit: 'mg/m²' },
                    { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' },
                    { name: '紫杉醇', standardDose: 175, unit: 'mg/m²' }
                ]
            });
        }
    } else if (isHRPositive) {
        plan.chemoOptions.push({
            id: 'c_act_lum',
            name: 'AC-T 方案',
            description: '蒽环序贯紫杉 (经典/密集)',
            cycle: '8周期',
            type: 'chemo',
            recommended: isClinicalHighRisk, 
            totalCycles: 8,
            frequencyDays: 21,
            drugs: [
                { name: '表柔比星', standardDose: 90, unit: 'mg/m²' },
                { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' },
                { name: '多西他赛', standardDose: 75, unit: 'mg/m²' }
            ]
        });
        plan.chemoOptions.push({
            id: 'c_tc_lum',
            name: 'TC 方案',
            description: '多西他赛 + 环磷酰胺',
            cycle: '4-6周期',
            type: 'chemo',
            recommended: !isClinicalHighRisk, 
            totalCycles: 4,
            frequencyDays: 21,
            drugs: [
                { name: '多西他赛', standardDose: 75, unit: 'mg/m²' },
                { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }
            ]
        });
    }
}

if (isHER2) {
    plan.targetOptions.push({
        id: 't_hp',
        name: 'HP 双靶向',
        description: '曲妥珠 + 帕妥珠',
        cycle: 'q3w 维持1年',
        type: 'target',
        recommended: nStage >= 1 || isNeoadjuvantPath,
        totalCycles: 18,
        frequencyDays: 21,
        drugs: [
            { name: '曲妥珠单抗', standardDose: 6, loadingDose: 8, unit: 'mg/kg' }, 
            { name: '帕妥珠单抗', standardDose: 420, loadingDose: 840, unit: 'mg' }
        ]
    });
}

if (isHRPositive) {
    // 基础内分泌逻辑
    const needOFS = !isMeno && (nStage >= 1 || patient.age < 35 || ki67Val >= 20);
    
    // CDK4/6i 阿贝西利判定 (MonarchE)
    const isAbemaciclibCandidate = (nStage >= 2) || (nStage === 1 && (grade === 3 || tSize >= 5 || ki67Val >= 20));

    if (isMeno) {
        plan.endocrineOptions.push({
            id: 'e_ai_post',
            name: isAbemaciclibCandidate ? 'AI + 阿贝西利' : '芳香化酶抑制剂 (AI)',
            description: isAbemaciclibCandidate ? '内分泌强化方案 (MonarchE)' : '来曲唑/阿那曲唑/依西美坦',
            cycle: 'AI(5-10年) + 阿贝西利(2年)',
            type: 'endocrine',
            recommended: true,
            totalCycles: 730,
            frequencyDays: 1,
            drugs: [
                { name: '来曲唑', standardDose: 2.5, unit: 'mg' },
                ...(isAbemaciclibCandidate ? [{ name: '阿贝西利', standardDose: 150, unit: 'mg (bid)' }] : [])
            ]
        });
    } else {
        if (needOFS) {
            plan.endocrineOptions.push({
                id: 'e_ofs_ai_pre',
                name: isAbemaciclibCandidate ? 'OFS + AI + 阿贝西利' : 'OFS + AI',
                description: '卵巢功能抑制序贯/联用AI',
                cycle: '阿贝西利强化2年',
                type: 'endocrine',
                recommended: true,
                totalCycles: 730,
                frequencyDays: 28,
                drugs: [
                    { name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' }, 
                    { name: '依西美坦', standardDose: 25, unit: 'mg' },
                    ...(isAbemaciclibCandidate ? [{ name: '阿贝西利', standardDose: 150, unit: 'mg (bid)' }] : [])
                ]
            });
        } else {
            plan.endocrineOptions.push({
                id: 'e_tam_pre',
                name: '他莫昔芬 (TAM)',
                description: '每日20mg',
                cycle: 'qd x 5年',
                type: 'endocrine',
                recommended: true,
                totalCycles: 1825,
                frequencyDays: 1,
                drugs: [{ name: '他莫昔芬', standardDose: 20, unit: 'mg' }]
            });
        }
    }
}

if (isTNBC && isNeoadjuvantPath && (tSize > 2.0 || nStage >= 1)) {
    plan.immuneOptions.push({
        id: 'i_pembro',
        name: '帕博利珠单抗',
        description: 'KN522模式',
        cycle: 'q3w',
        type: 'immune',
        recommended: true,
        totalCycles: 17,
        frequencyDays: 21,
        drugs: [{ name: '帕博利珠单抗', standardDose: 200, unit: 'mg' }]
    });
}

return plan;
};
