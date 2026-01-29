
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, MolecularSubtype } from '../types';

/**
 * 本地专家系统规则库 (2024/2025 CSCO/NCCN 指南深度适配版)
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

export const generateLocalTreatmentOptions = (patient: Patient, markers: ClinicalMarkers): TreatmentOption[] => {
  const options: TreatmentOption[] = [];
  const tSize = getTumorSize(markers.tumorSize);
  const nStage = getNodeStage(markers.nodeStatus);
  const grade = getGrade(markers.histologicalGrade);
  const ki67 = getKi67(markers.ki67);
  const subtype = patient.subtype;

  const isHER2 = subtype === MolecularSubtype.HER2Positive || (markers.her2Status && markers.her2Status.includes('3+'));
  const isTNBC = subtype === MolecularSubtype.TripleNegative;
  const erVal = getPercentage(markers.erStatus);
  const prVal = getPercentage(markers.prStatus);
  const isHRPositive = erVal > 0 || prVal > 0;

  // 判定是否为临床高危
  const isHighRisk = grade === 3 || ki67 >= 30 || nStage >= 1 || tSize > 2;

  // 核心判定逻辑：新辅助治疗的适用性
  // 指南：HER2+ 或 TNBC，若 T>=2 或 N1+，首选新辅助
  const stronglyRecommendNeoadjuvant = (isHER2 || isTNBC) && (tSize >= 2.0 || nStage >= 1);
  
  // Luminal型新辅助判定：通常手术优先，除非肿块巨大或累及淋巴结多
  const luminalNeoadjuvant = isHRPositive && !isHER2 && (nStage >= 2 || (nStage >= 1 && grade === 3));

  // --- 选项 1: 新辅助路径 ---
  const neoReasoning = stronglyRecommendNeoadjuvant 
    ? `基于CSCO指南，${isHER2 ? 'HER2+' : 'TNBC'}且T≥2cm或N+患者，推荐首选新辅助。目的：1.评估药敏指导后续强化；2.争取pCR以改善预后；3.降期争取保乳。`
    : luminalNeoadjuvant 
      ? `HR+高危患者，淋巴结负荷较重(N2)或分级高(G3)，可考虑术前治疗以评估系统治疗敏感性。`
      : `当前分期较早，新辅助非首选，但可作为评估体内药敏的临床研究选项。`;

  options.push({
    id: 'path_neoadjuvant',
    title: '新辅助系统治疗 → 手术 → 辅助治疗',
    iconType: 'chemo',
    description: '术前先进行全身系统治疗，降期并根据手术病理残余情况调整后续方案。',
    reasoning: neoReasoning,
    duration: '6-9个月(术前) + 手术 + 12个月(术后)',
    pros: ['直观评价药物敏感性', '提高保乳及保腋窝机会', '残余病灶(Non-pCR)可指导后续强化治疗'],
    cons: ['治疗周期较长', '存在治疗期间疾病进展(PD)风险'],
    recommended: stronglyRecommendNeoadjuvant
  });

  // --- 选项 2: 手术优先路径 ---
  const surgReasoning = !stronglyRecommendNeoadjuvant 
    ? `早期Luminal型或T1N0患者推荐手术优先。理由：1.精准分期确定复发风险；2.快速去除病灶；3.根据21基因或临床特征决定是否豁免化疗。`
    : `虽指南推荐新辅助，但若患者保乳意愿弱且肿瘤易切除，亦可选择直接手术。注意：术后将失去药敏评估机会。`;

  options.push({
    id: 'path_surgery',
    title: '直接手术 → 辅助治疗 (化疗/放疗/内分泌)',
    iconType: 'surgery',
    description: '先行手术切除肿物并明确腋窝分期，术后依据正式病理报告制定辅助方案。',
    reasoning: surgReasoning,
    duration: '1个月(手术) + 4-6个月(化疗) + 5-10年(内分泌)',
    pros: ['病理分期最为精准', '迅速切除肿块缓解焦虑', '可根据正式病理更早开启内分泌治疗'],
    cons: ['无法获得体内药敏反馈', '对较大肿瘤可能丧失保乳机会'],
    recommended: !stronglyRecommendNeoadjuvant && !luminalNeoadjuvant
  });

  // --- 选项 3: 化疗豁免/极低危路径 ---
  const isWaiverCandidate = isHRPositive && !isHER2 && nStage === 0 && tSize <= 2.0 && grade <= 2 && ki67 < 20;
  if (isWaiverCandidate || isHRPositive) {
    const waiveReasoning = isWaiverCandidate
      ? `患者为典型低危Luminal A型特征(T1N0, G1/2, Ki67<20%)，化疗获益极低。建议结合基因检测(如Oncotype DX)明确是否可豁免化疗，直接进入内分泌治疗。`
      : `对于HR+患者，若RS评分低或临床特征极低危，单纯内分泌治疗即可获得极佳预后。`;

    options.push({
      id: 'path_conservative',
      title: '手术 → 单纯辅助内分泌治疗 (豁免化疗)',
      iconType: 'drug',
      description: '针对低风险患者，通过精准评估豁免毒性较大的化疗，仅使用内分泌药物。',
      reasoning: waiveReasoning,
      duration: '5-10年(每日口服药)',
      pros: ['避免化疗副作用(脱发、呕吐等)', '显著提升治疗期间生活质量', '节省医疗成本'],
      cons: ['需极其精准的复发风险评估', '少数隐匿性高危患者存在漏治风险'],
      recommended: isWaiverCandidate
    });
  }

  return options;
};

export const generateLocalDetailedRegimens = (
  patient: Patient,
  markers: ClinicalMarkers,
  highLevelPlan: TreatmentOption
): DetailedRegimenPlan => {
  const plan: DetailedRegimenPlan = { chemoOptions: [], endocrineOptions: [], targetOptions: [], immuneOptions: [] };

  const tSize = getTumorSize(markers.tumorSize);
  const nStage = getNodeStage(markers.nodeStatus);
  const grade = getGrade(markers.histologicalGrade);
  const ki67Val = getKi67(markers.ki67);
  const isMeno = markers.menopause;
  const erVal = getPercentage(markers.erStatus);
  const subtype = patient.subtype;
  const isHER2 = subtype === MolecularSubtype.HER2Positive || (markers.her2Status && markers.her2Status.includes('3+'));
  const isTNBC = subtype === MolecularSubtype.TripleNegative;
  const isHRPositive = erVal > 0;
  const isNeoadjuvantPath = highLevelPlan.id === 'path_neoadjuvant';

  // --- 化疗方案细化 ---
  if (highLevelPlan.id !== 'path_conservative') {
    if (isHER2) {
      plan.chemoOptions.push({
        id: 'c_tchp',
        name: 'TCbHP (TCHP) 方案',
        description: '多西他赛+卡铂+曲帕双靶',
        cycle: 'q3w × 6',
        type: 'chemo',
        recommended: true,
        totalCycles: 6,
        frequencyDays: 21,
        reasoning: 'CSCO指南新辅助/辅助治疗I级推荐，双靶向治疗能显著提高pCR率，尤其适用于HER2+且N+或T≥2的患者。',
        drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '卡铂', standardDose: 6, unit: 'AUC' }]
      });
    } else if (isTNBC) {
      plan.chemoOptions.push({
        id: 'c_tp_ac',
        name: 'TP → AC (序贯方案)',
        description: '紫杉+卡铂 序贯 蒽环+环磷酰胺',
        cycle: '术前序贯',
        type: 'chemo',
        recommended: true,
        totalCycles: 8,
        frequencyDays: 21,
        reasoning: '基于KEYNOTE-522或CSCO指南，三阴性乳腺癌新辅助推荐紫杉+铂类序贯蒽环，以最大程度提高病理完全缓解率。',
        stages: [
          { name: 'TP 阶段', cycles: 4, drugs: [{ name: '紫杉醇', standardDose: 80, unit: 'mg/m²' }, { name: '卡铂', standardDose: 5, unit: 'AUC' }] },
          { name: 'AC 阶段', cycles: 4, drugs: [{ name: '多柔比星', standardDose: 60, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] }
        ]
      });
    } else {
      // Luminal型
      plan.chemoOptions.push({
        id: 'c_act',
        name: 'AC → T (序贯方案)',
        description: '蒽环序贯紫杉 (经典AC-T)',
        cycle: 'q3w × 8',
        type: 'chemo',
        recommended: nStage >= 1 || grade === 3,
        totalCycles: 8,
        frequencyDays: 21,
        reasoning: '经典序贯方案，适用于Luminal B型或存在淋巴结阳性的高危患者。',
        stages: [
          { name: 'AC 阶段', cycles: 4, drugs: [{ name: '表柔比星', standardDose: 90, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] },
          { name: 'T 阶段', cycles: 4, drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }] }
        ]
      });
      plan.chemoOptions.push({
        id: 'c_tc',
        name: 'TC 方案',
        description: '多西他赛 + 环磷酰胺',
        cycle: 'q3w × 4',
        type: 'chemo',
        recommended: nStage === 0 && (grade === 2 || ki67Val >= 20),
        totalCycles: 4,
        frequencyDays: 21,
        reasoning: '非蒽环方案，适用于复发风险中等且对心脏毒性敏感的早期患者。',
        drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }]
      });
    }
  }

  // --- 靶向/免疫/内分泌略（保留原有 OFS 识别关键词：戈舍瑞林） ---
  if (isHER2) {
    plan.targetOptions.push({
      id: 't_hp',
      name: 'HP 双靶向',
      description: '曲妥珠单抗 + 帕妥珠单抗',
      cycle: 'q3w 维持1年',
      type: 'target',
      recommended: true,
      totalCycles: 18,
      frequencyDays: 21,
      drugs: [
        { name: '曲妥珠单抗', standardDose: 6, loadingDose: 8, unit: 'mg/kg' }, 
        { name: '帕妥珠单抗', standardDose: 420, loadingDose: 840, unit: 'mg' }
      ]
    });
  }

  if (isHRPositive) {
    const needOFS = !isMeno && (nStage >= 1 || patient.age < 35);
    if (needOFS) {
      plan.endocrineOptions.push({
        id: 'e_ofs_ai',
        name: 'OFS + AI 方案',
        description: '卵巢功能抑制 序贯 芳香化酶抑制剂',
        cycle: '口服 + 28天/针',
        type: 'endocrine',
        recommended: true,
        totalCycles: 13, // 1年13针
        frequencyDays: 28,
        reasoning: '基于ASTRRA/SOFT/TEXT研究，高危绝经前患者使用OFS+AI能显著改善DFS。',
        drugs: [
          { name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' }, // 触发紫色标注
          { name: '来曲唑', standardDose: 2.5, unit: 'mg' }
        ]
      });
    } else {
        plan.endocrineOptions.push({
            id: 'e_tam',
            name: '他莫昔芬 (TAM)',
            description: '每日20mg',
            cycle: '每日口服',
            type: 'endocrine',
            recommended: !needOFS,
            totalCycles: 1825, 
            frequencyDays: 1,
            drugs: [{ name: '他莫昔芬', standardDose: 20, unit: 'mg' }]
        });
    }
  }

  return plan;
};
