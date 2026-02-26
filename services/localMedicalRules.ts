
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

export const inferMolecularSubtype = (markers: ClinicalMarkers): MolecularSubtype => {
    const her2 = markers.her2Status;
    const er = getERVal(markers.erStatus);
    const pr = getPRVal(markers.prStatus);
    const ki67 = getKi67Val(markers.ki67);
    const grade = markers.histologicalGrade;

    if (her2 === '3+') return MolecularSubtype.HER2Positive;
    if (er === 0 && (her2 === '0' || her2 === '1+')) return MolecularSubtype.TripleNegative;

    if (er > 0) {
        if (her2 === '2+' || ki67 >= 20 || pr < 20 || grade === 'G3') return MolecularSubtype.LuminalB;
        return MolecularSubtype.LuminalA;
    }

    return MolecularSubtype.Unknown;
};

export const inferClinicalStage = (markers: ClinicalMarkers): string => {
    const T = getTumorSizeVal(markers.tumorSize);
    const N = getNodeStageVal(markers.nodeStatus);

    if (N === 3) return "IIIC 期";
    if (N === 2) return "IIIA 期";
    if (T === 3) return N >= 1 ? "IIIA 期" : "IIB 期";
    if (T === 2) return N >= 1 ? "IIB 期" : "IIA 期";
    if (T === 1) return N >= 1 ? "IIA 期" : "IA 期";
    
    return "分期需进一步检查";
};

export const generateLocalTreatmentOptions = (patient: Patient, markers: ClinicalMarkers): TreatmentOption[] => {
  const options: TreatmentOption[] = [];
  const tSize = getTumorSizeVal(markers.tumorSize);
  const nStage = getNodeStageVal(markers.nodeStatus);
  const subtype = inferMolecularSubtype(markers);

  const isHER2 = subtype === MolecularSubtype.HER2Positive;
  const isTNBC = subtype === MolecularSubtype.TripleNegative;
  
  const stronglyRecommendNeoadjuvant = (isHER2 || isTNBC) && (tSize >= 2 || nStage >= 1);

  options.push({
    id: 'path_neoadjuvant',
    title: '新辅助系统治疗 → 手术 → 辅助强化',
    iconType: 'chemo',
    description: '术前先进行系统全身治疗，根据疗效(pCR情况)指导术后精准强化方案。',
    reasoning: `依据 CSCO 2024：对于 ${subtype} 患者，${tSize >= 2 ? 'cT2及以上' : ''}${nStage >= 1 ? '且淋巴结阳性' : ''}推荐级别为 1A。目的是获得药敏反馈并降期。`,
    duration: '6个月(术前) + 12个月(术后)',
    pros: ['早期活体药敏', '增加保乳机会'],
    cons: ['治疗周期长'],
    recommended: stronglyRecommendNeoadjuvant
  });

  options.push({
    id: 'path_surgery',
    title: '直接手术 → 辅助治疗',
    iconType: 'surgery',
    description: '先行手术明确完整病理，随后根据病理制定方案。',
    reasoning: '依据 CSCO：对于早期低危、肿块较小（T1）、淋巴结阴性（N0）者，首选手术明确分期。',
    duration: '1个月 + 辅助周期',
    pros: ['分期最准确'],
    cons: ['无术前药敏反馈'],
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
  const tSize = getTumorSizeVal(markers.tumorSize);

  const highRisk = nStage >= 1 || grade === 'G3' || ki67Val >= 20 || tSize >= 2;

  // 1. 化疗 + 靶向逻辑 (对标 CSCO 2024)
  if (isHER2) {
    // 早期低危患者 (T1N0, Stage IA)
    if (tSize === 1 && nStage === 0) {
      plan.chemoOptions.push({ 
          id: 'c_th', 
          name: 'TH 方案', 
          description: '紫杉醇+曲妥珠单抗', 
          cycle: 'qw × 12', 
          type: 'chemo', 
          recommended: true, 
          totalCycles: 12, 
          frequencyDays: 7, 
          reasoning: 'CSCO 2024 推荐：针对 HER2+、T1N0 (Stage IA) 患者的降阶方案 (基于 APT 研究，1A类证据)。',
          drugs: [{ name: '紫杉醇', standardDose: 80, unit: 'mg/m²' }, { name: '曲妥珠单抗', standardDose: 2, loadingDose: 4, unit: 'mg/kg' }] 
      });
      plan.chemoOptions.push({ 
          id: 'c_tc', 
          name: 'TC 方案', 
          description: '多西他赛+环磷酰胺', 
          cycle: 'q3w × 4', 
          type: 'chemo', 
          recommended: false, 
          totalCycles: 4, 
          frequencyDays: 21, 
          reasoning: '替代方案：对于不愿使用曲妥珠单抗或有心脏禁忌患者考虑。',
          drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] 
      });
    } else {
      // 中高危患者 (T>=2 或 N+)
      plan.chemoOptions.push({ 
          id: 'c_tchp', 
          name: 'TCbHP (TCHP)', 
          description: '多西他赛+卡铂+曲帕双靶', 
          cycle: 'q3w × 6', 
          type: 'chemo', 
          recommended: true, 
          totalCycles: 6, 
          frequencyDays: 21, 
          reasoning: 'CSCO 2024 推荐：中高危 HER2+ 标准方案 (基于 TRAIN-2, BCIRG 006, 1A类证据)。',
          drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '卡铂', standardDose: 6, unit: 'AUC' }] 
      });
    }
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
        reasoning: 'CSCO 推荐：对于高危 Luminal 型的标准序贯方案。',
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
        reasoning: 'CSCO 推荐：对于低危 Luminal 患者，4周期 TC 方案具有良好风险获益比。',
        drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] 
    });
  }

  // 2. 靶向强化
  if (isHER2) {
    const needDualTarget = nStage >= 1 || (tSize >= 2);
    plan.targetOptions.push({ id: 't_hp_iv', name: '曲帕双靶 (静脉)', description: '曲妥珠+帕妥珠', cycle: 'q3w', type: 'target', recommended: needDualTarget, totalCycles: 18, frequencyDays: 21, reasoning: 'APHINITY研究证实淋巴结阳性患者双靶获益显著。', drugs: [{ name: '曲妥珠单抗', standardDose: 6, loadingDose: 8, unit: 'mg/kg' }, { name: '帕妥珠单抗', standardDose: 420, loadingDose: 840, unit: 'mg' }] });
    plan.targetOptions.push({ id: 't_h_iv', name: '曲妥珠单抗单靶', description: '赫赛汀', cycle: 'q3w', type: 'target', recommended: !needDualTarget, totalCycles: 18, frequencyDays: 21, reasoning: '低危早期患者单靶已足够。', drugs: [{ name: '曲妥珠单抗', standardDose: 6, loadingDose: 8, unit: 'mg/kg' }] });
  }

  // 3. CDK4/6
  if (isHRPositive) {
    const monarchERisk = nStage >= 4 || (nStage >= 1 && (grade === 'G3' || ki67Val >= 20));
    plan.cdk46Options.push({ id: 'cdk_none', name: '不使用', description: '无强化', cycle: '无', type: 'cdk46', recommended: !monarchERisk, totalCycles: 0, frequencyDays: 1 });
    plan.cdk46Options.push({ id: 'cdk_abe', name: '阿贝西利 (唯择)', description: '连续服用 2年', cycle: '150mg bid', type: 'cdk46', recommended: monarchERisk, totalCycles: 730, frequencyDays: 1, reasoning: '基于 MonarchE 研究的高危强化治疗。', drugs: [{ name: '阿贝西利', standardDose: 150, unit: 'mg' }] });
  }

  // 4. 内分泌
  if (isHRPositive) {
    if (!isMeno) {
        const ofsRecommend = nStage >= 1 || ki67Val >= 20 || (patient.age < 35);
        plan.ofsOptions.push({ id: 'ofs_none', name: '不使用 OFS', description: '仅口服', cycle: '无', type: 'endocrine', recommended: !ofsRecommend, totalCycles: 0, frequencyDays: 1 });
        plan.ofsOptions.push({ id: 'ofs_gos_1m', name: '戈舍瑞林 (1月)', description: '28天/针', cycle: '28d/cycle', type: 'endocrine', recommended: ofsRecommend, totalCycles: 13, frequencyDays: 28, reasoning: '基于 SOFT/TEXT 研究的高危绝经前强化。', drugs: [{ name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' }] });
    }
    plan.oralEndocrineOptions.push({ id: 'oral_let', name: '来曲唑 (AI)', description: '口服', cycle: '2.5mg qd', type: 'endocrine', recommended: isMeno || !isMeno && nStage >= 1, totalCycles: 1825, frequencyDays: 1, drugs: [{ name: '来曲唑', standardDose: 2.5, unit: 'mg' }] });
    plan.oralEndocrineOptions.push({ id: 'oral_tam', name: '他莫昔芬 (TAM)', description: '口服', cycle: '20mg qd', type: 'endocrine', recommended: !isMeno && nStage === 0, totalCycles: 1825, frequencyDays: 1, drugs: [{ name: '他莫昔芬', standardDose: 20, unit: 'mg' }] });
  }
  
  return plan;
};
