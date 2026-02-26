
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, MolecularSubtype, RegimenOption } from '../types';

export const getTumorSizeVal = (sizeStr: string): number => {
  if (!sizeStr || sizeStr === '待查') return 0;
  if (sizeStr.includes('T1')) return 1;
  if (sizeStr.includes('T2')) return 2;
  if (sizeStr.includes('T3')) return 3;
  return 0;
};

export const getNodeStageVal = (nodeStr: string): number => {
  if (!nodeStr || nodeStr === '待查') return 0;
  if (nodeStr.includes('N3')) return 3;
  if (nodeStr.includes('N2')) return 2;
  if (nodeStr.includes('N1')) return 1;
  if (nodeStr.includes('N0')) return 0;
  return 0; 
};

const getKi67Val = (ki67Str: string): number => {
  if (!ki67Str || ki67Str === '待查') return 0;
  const val = parseFloat(ki67Str.replace(/[^\d.]/g, ''));
  return isNaN(val) ? 0 : val;
};

const getERVal = (str: string): number => {
    if (!str || str === '0%' || str === '0' || str === '待查' || str === '') return 0;
    const val = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(val) ? 0 : val;
};

const getPRVal = (str: string): number => {
    if (!str || str === '0%' || str === '0' || str === '待查' || str === '') return 0;
    const val = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(val) ? 0 : val;
};

/**
 * 推断分子分型 - 对标 CSCO 2024
 */
export const inferMolecularSubtype = (markers: ClinicalMarkers): MolecularSubtype => {
    const her2 = markers.her2Status;
    const er = getERVal(markers.erStatus);
    const pr = getPRVal(markers.prStatus);
    const ki67 = getKi67Val(markers.ki67);
    const grade = markers.histologicalGrade;

    // HER2 阳性型
    if (her2 === '3+') return MolecularSubtype.HER2Positive;
    
    // 三阴性
    if (er === 0 && (her2 === '0' || her2 === '1+')) return MolecularSubtype.TripleNegative;

    // Luminal 型
    if (er > 0) {
        // Luminal B (对标 CSCO: HER2+ 或 Ki-67 >= 20% 或 PR < 20% 或 G3)
        if (her2 === '2+' || ki67 >= 20 || pr < 20 || grade === 'G3') return MolecularSubtype.LuminalB;
        return MolecularSubtype.LuminalA;
    }

    return MolecularSubtype.Unknown;
};

/**
 * 推断临床分期 (基于 TNM 简化)
 */
export const inferClinicalStage = (markers: ClinicalMarkers): string => {
    const T = getTumorSizeVal(markers.tumorSize);
    const N = getNodeStageVal(markers.nodeStatus);

    if (N === 3) return "IIIC 期";
    if (N === 2) return "IIIA 期";
    
    if (T === 3) {
        return N >= 1 ? "IIIA 期" : "IIB 期";
    }
    if (T === 2) {
        return N >= 1 ? "IIB 期" : "IIA 期";
    }
    if (T === 1) {
        return N >= 1 ? "IIA 期" : "I 期";
    }
    
    return "分期需进一步检查";
};

export const generateLocalTreatmentOptions = (patient: Patient, markers: ClinicalMarkers): TreatmentOption[] => {
  const options: TreatmentOption[] = [];
  const tSize = getTumorSizeVal(markers.tumorSize);
  const nStage = getNodeStageVal(markers.nodeStatus);
  const subtype = inferMolecularSubtype(markers);

  const isHER2 = subtype === MolecularSubtype.HER2Positive;
  const isTNBC = subtype === MolecularSubtype.TripleNegative;
  
  // CSCO 2024: HER2+ 或 TNBC，且 T >= 2cm 或 N+ 强烈推荐新辅助 (1A)
  const stronglyRecommendNeoadjuvant = (isHER2 || isTNBC) && (tSize >= 2 || nStage >= 1);

  options.push({
    id: 'path_neoadjuvant',
    title: '新辅助系统治疗 → 手术 → 辅助强化',
    iconType: 'chemo',
    description: '术前先进行系统全身治疗，根据疗效(pCR情况)指导术后精准强化方案。',
    reasoning: `依据 CSCO 2024 指南：对于 ${subtype} 型，${tSize >= 2 ? 'cT2及以上' : ''}${nStage >= 1 ? '且淋巴结阳性' : ''}患者，推荐级别为 1A。通过新辅助治疗可获得药敏反馈，并提高保乳率。`,
    duration: '6个月(术前) + 12个月(术后)',
    pros: ['早期活体药敏', '增加降期保乳机会', '精准评估预后'],
    cons: ['治疗周期较长', '需严密监测病情变化'],
    recommended: stronglyRecommendNeoadjuvant
  });

  options.push({
    id: 'path_surgery',
    title: '直接手术 → 辅助治疗',
    iconType: 'surgery',
    description: '先行手术切除病灶明确完整病理，随后根据病理结果制定后续辅助方案。',
    reasoning: '依据 CSCO 指南：对于早期低危患者或肿块较小、无明显淋巴结转移者，首选手术切除以明确 pTNM 分期。',
    duration: '1个月(手术) + 辅助周期',
    pros: ['病理最准确', '迅速切除肿块缓解焦虑'],
    cons: ['无术前药敏反馈', '对较大肿块保乳率低'],
    recommended: !stronglyRecommendNeoadjuvant
  });

  return options;
};

export const generateLocalDetailedRegimens = (
  patient: Patient,
  markers: ClinicalMarkers,
  highLevelPlan: TreatmentOption
): DetailedRegimenPlan => {
  const plan: DetailedRegimenPlan = { chemoOptions: [], ofsOptions: [], oralEndocrineOptions: [], targetOptions: [], immuneOptions: [], cdk46Options: [] };
  const subtype = inferMolecularSubtype(markers);
  const isHER2 = subtype === MolecularSubtype.HER2Positive;
  const erVal = getERVal(markers.erStatus);
  const isHRPositive = erVal > 0;
  const isMeno = markers.menopause;
  const ki67Val = getKi67Val(markers.ki67);
  const grade = markers.histologicalGrade;
  const nStage = getNodeStageVal(markers.nodeStatus);

  // CSCO 高危定义：N+ 或 (N0 且满足: G3, Ki67 >= 20%, T > 2cm)
  const highRisk = nStage >= 1 || grade === 'G3' || ki67Val >= 20 || getTumorSizeVal(markers.tumorSize) >= 2;

  // 1. 化疗
  if (isHER2) {
    plan.chemoOptions.push({ 
        id: 'c_tchp', 
        name: 'TCbHP (TCHP)', 
        description: '多西他赛+卡铂+曲帕双靶', 
        cycle: 'q3w × 6', 
        type: 'chemo', 
        recommended: true, 
        totalCycles: 6, 
        frequencyDays: 21, 
        reasoning: 'CSCO 2024 HER2+ 新辅助/辅助 1A 类推荐。TRAIN-2研究证实含铂方案优效性。',
        drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '卡铂', standardDose: 6, unit: 'AUC' }] 
    });
  } else if (isHRPositive) {
    plan.chemoOptions.push({ 
        id: 'c_act', 
        name: 'AC-T 方案', 
        description: '蒽环序贯紫杉', 
        cycle: 'q3w × 8', 
        type: 'chemo', 
        recommended: highRisk, 
        totalCycles: 8, 
        frequencyDays: 21, 
        reasoning: 'CSCO 推荐：对于高危 Luminal 型，含蒽环和紫杉的序贯方案是标准选择。',
        stages: [{ name: 'AC阶段', cycles: 4, drugs: [{ name: '表柔比星', standardDose: 90, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] }, { name: 'T阶段', cycles: 4, drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }] }] 
    });
    plan.chemoOptions.push({ 
        id: 'c_tc', 
        name: 'TC 方案', 
        description: '多西他赛+环磷酰胺', 
        cycle: 'q3w × 4', 
        type: 'chemo', 
        recommended: !highRisk, 
        totalCycles: 4, 
        frequencyDays: 21, 
        reasoning: 'CSCO 推荐：对于低危或不耐受蒽环患者，4周期 TC 方案安全性更高且疗效确切。',
        drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] 
    });
  }

  // 2. 靶向
  if (isHER2) {
    plan.targetOptions.push({ id: 't_hp_iv', name: '曲帕双靶 (静脉)', description: '曲妥珠+帕妥珠 静脉', cycle: 'q3w', type: 'target', recommended: true, totalCycles: 18, frequencyDays: 21, drugs: [{ name: '曲妥珠单抗', standardDose: 6, loadingDose: 8, unit: 'mg/kg' }, { name: '帕妥珠单抗', standardDose: 420, loadingDose: 840, unit: 'mg' }] });
  }

  // 3. CDK4/6 - MonarchE 标准
  if (isHRPositive) {
    // MonarchE 高危：N >= 4 或 (N 1-3 且满足: G3/T >= 5cm/Ki67 >= 20%)
    const monarchERisk = nStage >= 4 || (nStage >= 1 && (grade === 'G3' || ki67Val >= 20));
    
    plan.cdk46Options.push({ id: 'cdk_none', name: '不使用', description: '无强化', cycle: '无', type: 'cdk46', recommended: !monarchERisk, totalCycles: 0, frequencyDays: 1 });
    plan.cdk46Options.push({ id: 'cdk_abe', name: '阿贝西利 (唯择)', description: '连续服用 2年', cycle: '150mg bid', type: 'cdk46', recommended: monarchERisk, totalCycles: 730, frequencyDays: 1, reasoning: '依据 MonarchE 研究：高危 HR+ 患者辅助阿贝西利可显著降低复发风险(1A)。', drugs: [{ name: '阿贝西利', standardDose: 150, unit: 'mg' }] });
  }

  // 4. 内分泌 - SOFT/TEXT 标准
  if (isHRPositive) {
    if (!isMeno) {
        const ofsRecommend = nStage >= 1 || ki67Val >= 20 || (patient.age < 35);
        plan.ofsOptions.push({ id: 'ofs_none', name: '不使用 OFS', description: '仅口服', cycle: '无', type: 'endocrine', recommended: !ofsRecommend, totalCycles: 0, frequencyDays: 1 });
        plan.ofsOptions.push({ id: 'ofs_gos_1m', name: '戈舍瑞林 (1月)', description: '28天/针', cycle: '28d/cycle', type: 'endocrine', recommended: ofsRecommend, totalCycles: 13, frequencyDays: 28, reasoning: '依据 SOFT/TEXT 研究：年轻高危绝经前患者，OFS+AI/TAM 优于单药 TAM。', drugs: [{ name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' }] });
    }

    plan.oralEndocrineOptions.push({ id: 'oral_let', name: '来曲唑 (AI)', description: '口服', cycle: '2.5mg qd', type: 'endocrine', recommended: isMeno || !isMeno && nStage >= 1, totalCycles: 1825, frequencyDays: 1, drugs: [{ name: '来曲唑', standardDose: 2.5, unit: 'mg' }] });
    plan.oralEndocrineOptions.push({ id: 'oral_tam', name: '他莫昔芬 (TAM)', description: '口服', cycle: '20mg qd', type: 'endocrine', recommended: !isMeno && nStage === 0, totalCycles: 1825, frequencyDays: 1, drugs: [{ name: '他莫昔芬', standardDose: 20, unit: 'mg' }] });
  }
  
  return plan;
};
