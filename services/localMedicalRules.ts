
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, MolecularSubtype } from '../types';

/**

本地专家系统规则库 (2024/2025 指南版 - 全覆盖增强版)

逻辑依据：CSCO 乳腺癌诊疗指南 / NCCN Breast Cancer Guidelines
*/

// 辅助函数：解析肿瘤大小 (cm)
const getTumorSize = (sizeStr: string): number => {
const size = parseFloat(sizeStr.replace(/[^\d.]/g, ''));
return isNaN(size) ? 0 : size;
};

// 辅助函数：解析淋巴结状态 (N0, N1, N2, N3)
const getNodeStage = (nodeStr: string): number => {
if (!nodeStr) return 0;
if (nodeStr.includes('N3')) return 3;
if (nodeStr.includes('N2')) return 2;
if (nodeStr.includes('N1')) return 1;
return 0; // N0
};

// 解析组织学分级 (1, 2, 3)
const getGrade = (gradeStr: string): number => {
    if (!gradeStr) return 0;
    if (gradeStr.includes('G3')) return 3;
    if (gradeStr.includes('G2')) return 2;
    if (gradeStr.includes('G1')) return 1;
    return 0; 
};

// 解析21基因RS评分
const getRSScore = (scoreStr?: string): number | null => {
if (!scoreStr) return null;
const score = parseFloat(scoreStr.replace(/[^\d.]/g, ''));
return isNaN(score) ? null : score;
};

// 1. 生成总体治疗路径
export const generateLocalTreatmentOptions = (patient: Patient, markers: ClinicalMarkers): TreatmentOption[] => {
const options: TreatmentOption[] = [];
// 解析关键指标
const tSize = getTumorSize(markers.tumorSize);
const nStage = getNodeStage(markers.nodeStatus);
const grade = getGrade(markers.histologicalGrade);
const subtype = patient.subtype;
const rsScore = getRSScore(markers.geneticTestResult);

// 分型判断
const isHER2 = subtype === MolecularSubtype.HER2Positive;
const isTNBC = subtype === MolecularSubtype.TripleNegative;
const isLuminal = subtype === MolecularSubtype.LuminalA || subtype === MolecularSubtype.LuminalB;

// --- 路径判定逻辑 ---

// 1. 新辅助治疗 (Neoadjuvant) 指征
// CSCO/NCCN: HER2+ 或 TNBC，若 T>2cm 或 N+，推荐新辅助
const needNeoadjuvant = (isHER2 || isTNBC) && (tSize > 2.0 || nStage >= 1);

// Luminal型 通常首选手术，除非局部晚期(N3) 或者 N2且G3
const luminalNeoadjuvant = isLuminal && (nStage >= 3 || (nStage >= 2 && grade === 3));

// 2. 豁免化疗 (Conservative) 指征
// 满足以下任一条件：
// A. Luminal型 + N0 + RS < 26 (TAILORx / RxPONDER 研究)
// B. Luminal A型 (G1/G2, Low Ki67) + N0 + T1a/b
let canWaiveChemo = false;
let waiverReason = "";

if (isLuminal && nStage === 0) {
    if (rsScore !== null) {
        // 有基因检测结果
        if (rsScore < 26) {
            canWaiveChemo = true;
            waiverReason = `RS评分为 ${rsScore} (<26)，根据TAILORx研究，获益于化疗的可能性极低。`;
        }
    } else {
        // 无基因检测结果
        if (tSize <= 1.0 && grade <= 2) { // T1a/b + 非G3
            canWaiveChemo = true; 
            waiverReason = "肿瘤≤1cm，淋巴结阴性且分级较低，临床极低危，通常无需化疗。";
        } else if (subtype === MolecularSubtype.LuminalA && grade <= 1) {
            // Luminal A G1 N0
            canWaiveChemo = true; 
            waiverReason = "Luminal A型 (G1) N0 患者，临床低危。建议进行21基因检测确认。";
        } else {
            // Luminal B N0 或 G2/G3 -> 提示检测
            waiverReason = "Luminal型 N0 患者，若21基因RS评分低可豁免化疗。建议完善检测。";
            canWaiveChemo = true; 
        }
    }
}

// --- 方案构建 ---

// 方案 A: 新辅助治疗 (优先推荐给符合指征的高危人群)
const neoadjuvantOption: TreatmentOption = {
    id: 'path_neoadjuvant',
    title: '新辅助治疗 → 手术 → 辅助治疗',
    iconType: 'chemo',
    description: '术前进行药物治疗(化疗/靶向/免疫)。目标：肿瘤降期提高保乳率，获取体内药敏信息(pCR)，指导术后强化治疗。',
    duration: '6-8个月(术前) + 手术 + 术后',
    pros: ['直观评价药物敏感性', '部分患者可实现pCR(病理完全缓解)', '降期手术'],
    cons: ['治疗周期较长', '需穿刺确诊病理'],
    recommended: false
};

// 方案 B: 手术优先 (优先推荐给早期或Luminal型)
const surgeryOption: TreatmentOption = {
    id: 'path_surgery',
    title: '手术 → 辅助治疗',
    iconType: 'surgery',
    description: '先行手术切除病灶(保乳或全切)，根据术后大病理结果精准制定后续化疗、放疗及内分泌方案。',
    duration: '1个月(手术恢复) + 4-6个月(化疗) + 5-10年(内分泌)',
    pros: ['迅速去除负荷', '精准TNM分期'],
    cons: ['无法获取pCR信息'],
    recommended: false
};

// 方案 C: 豁免化疗 (仅针对低危 Luminal A/B)
const conservativeOption: TreatmentOption = {
    id: 'path_conservative',
    title: '手术 → 单纯内分泌 (豁免化疗)',
    iconType: 'drug',
    description: waiverReason ? `建议豁免化疗: ${waiverReason}` : '适用于Luminal型、低危、基因检测RS评分较低的患者。仅需手术和内分泌治疗。',
    duration: '5-10年(服药)',
    pros: ['生活质量高', '避免化疗毒性', '精准医疗获益'],
    cons: ['需严格评估复发风险 (建议Oncotype DX检测)'],
    recommended: false
};

// --- 推荐打标 ---
if (needNeoadjuvant || luminalNeoadjuvant) {
    neoadjuvantOption.recommended = true;
    options.push(neoadjuvantOption, surgeryOption);
} else if (canWaiveChemo) {
    conservativeOption.recommended = true;
    options.push(conservativeOption, surgeryOption); // 豁免方案排第一
} else {
    surgeryOption.recommended = true;
    options.push(surgeryOption, neoadjuvantOption);
}

return options;
};

// 2. 生成详细用药方案 (核心药物逻辑)
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
const ki67Val = parseFloat(markers.ki67) || 0;
const isMeno = markers.menopause; // true=绝经后

const subtype = patient.subtype;
const isHER2 = subtype === MolecularSubtype.HER2Positive || (markers.her2Status && markers.her2Status.includes('3+'));
const isTNBC = subtype === MolecularSubtype.TripleNegative || (!isHER2 && markers.erStatus.includes('阴') && markers.prStatus.includes('阴'));
const isLuminal = !isHER2 && !isTNBC; // 兜底

// 是否为新辅助路径
const isNeoadjuvantPath = highLevelPlan.id === 'path_neoadjuvant';
// 是否为豁免化疗路径
const isConservativePath = highLevelPlan.id === 'path_conservative';

// ================= 化疗方案 (Chemotherapy) =================

if (!isConservativePath) {
    // 1. HER2阳性化疗
    if (isHER2) {
        // 首选：TCbH (P) - 毒性相对较低，心脏安全性好
        plan.chemoOptions.push({
            id: 'c_tchp',
            name: 'TCbHP (TCHP)',
            description: '多西他赛 + 卡铂 + 曲妥珠单抗 + 帕妥珠单抗',
            cycle: '每3周1次 × 6周期',
            type: 'chemo',
            recommended: true, 
            reasoning: '指南首选方案(非蒽环类)，心脏毒性低，pCR率高。适用于大部分HER2+患者。',
            totalCycles: 6,
            frequencyDays: 21,
            drugs: [
                { name: '多西他赛', standardDose: 75, unit: 'mg/m²' },
                { name: '卡铂 (AUC)', standardDose: 6, unit: 'AUC' }
            ]
        });
        
        // 备选：AC-TH (P) - 经典含蒽环方案
        plan.chemoOptions.push({
            id: 'c_acth',
            name: 'AC-TH(P)',
            description: '阿霉素+环磷酰胺 x4 → 序贯 紫杉醇+双靶 x4',
            cycle: '每2-3周1次，共8周期',
            type: 'chemo',
            recommended: false, 
            reasoning: '经典含蒽环方案，适用于极高危患者，但需注意心脏毒性叠加风险。',
            totalCycles: 8,
            frequencyDays: 14, // 密集型AC
            drugs: [
                { name: '多柔比星', standardDose: 60, unit: 'mg/m²' },
                { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' },
                { name: '紫杉醇', standardDose: 80, unit: 'mg/m²' } // 周疗
            ]
        });
    }
    
    // 2. 三阴性化疗 (TNBC)
    else if (isTNBC) {
        if (isNeoadjuvantPath) {
            // Keynote-522 模式
            plan.chemoOptions.push({
                id: 'c_kn522',
                name: 'TP-AC (KN522模式)',
                description: '紫杉醇+卡铂(周疗/3周) → 序贯 AC',
                cycle: '术前化疗 + 免疫',
                type: 'chemo',
                recommended: true,
                reasoning: 'Keynote-522研究证实：含铂化疗联合免疫治疗可显著提高TNBC的pCR率。',
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
            // 辅助治疗标准：密集 AC-T
            plan.chemoOptions.push({
                id: 'c_dd_act',
                name: 'ddAC-T (密集型)',
                description: '阿霉素+环磷酰胺 (2周1次) → 紫杉醇 (2周1次)',
                cycle: '每2周1次 x 8周期 (需升白支持)',
                type: 'chemo',
                recommended: true,
                reasoning: '剂量密集型化疗(ddAC-T)对于三阴性乳腺癌的生存获益优于常规方案。',
                totalCycles: 8,
                frequencyDays: 14,
                drugs: [
                    { name: '多柔比星', standardDose: 60, unit: 'mg/m²' },
                    { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' },
                    { name: '紫杉醇', standardDose: 175, unit: 'mg/m²' }
                ]
            });
            // 备选：TC方案 (适用于复发风险中等或不能耐受蒽环)
            plan.chemoOptions.push({
                id: 'c_tc_tnbc',
                name: 'TC 方案',
                description: '多西他赛 + 环磷酰胺',
                cycle: '每3周1次 x 4-6周期',
                type: 'chemo',
                recommended: false,
                reasoning: '去蒽环方案，毒性较低。适用于中低危或有心脏基础疾病的患者。',
                totalCycles: 6,
                frequencyDays: 21,
                drugs: [
                    { name: '多西他赛', standardDose: 75, unit: 'mg/m²' },
                    { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }
                ]
            });
        }
    }
    
    // 3. Luminal型化疗
    else if (isLuminal) {
        // 高危: N2+ 或 (N1且(G3或高Ki67))
        const isHighRisk = nStage >= 2 || (nStage >= 1 && (ki67Val >= 20 || grade === 3));
        
        plan.chemoOptions.push({
            id: 'c_act_lum',
            name: 'AC-T 方案',
            description: '蒽环类序贯紫杉类',
            cycle: '8周期',
            type: 'chemo',
            recommended: isHighRisk,
            reasoning: isHighRisk ? '淋巴结转移较多或分级/增殖指数高(G3/Ki67高)，属于高危复发人群，需强效化疗。' : '备选方案。',
            totalCycles: 8,
            frequencyDays: 21,
            drugs: [
                { name: '表柔比星', standardDose: 90, unit: 'mg/m²' },
                { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' },
                { name: '多西他赛', standardDose: 75, unit: 'mg/m²' }
            ]
        });

        // 中危：TC方案
        plan.chemoOptions.push({
            id: 'c_tc_lum',
            name: 'TC 方案',
            description: '多西他赛 + 环磷酰胺 (无蒽环)',
            cycle: '4-6周期',
            type: 'chemo',
            recommended: !isHighRisk,
            reasoning: !isHighRisk ? '中危Luminal型，TC方案(无蒽环)疗效肯定且心脏/白血病风险更低，优选推荐。' : '备选方案。',
            totalCycles: 4,
            frequencyDays: 21,
            drugs: [
                { name: '多西他赛', standardDose: 75, unit: 'mg/m²' },
                { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }
            ]
        });
    }
}

// ================= 靶向治疗 (Targeted) =================

// 1. HER2 靶向
if (isHER2) {
    const useDualTarget = nStage >= 1 || tSize > 2.0;
    
    if (useDualTarget) {
        plan.targetOptions.push({
            id: 't_hp',
            name: 'HP 双靶向',
            description: '曲妥珠单抗 + 帕妥珠单抗',
            cycle: '每3周1次，维持1年',
            type: 'target',
            recommended: true,
            reasoning: '高危HER2+ (N+或T>2cm)，双靶向治疗(APHINITY研究)显著降低复发风险。',
            totalCycles: 18,
            frequencyDays: 21,
            drugs: [
                { name: '曲妥珠单抗(维持)', standardDose: 6, unit: 'mg/kg' },
                { name: '帕妥珠单抗(维持)', standardDose: 420, unit: 'mg' }
            ]
        });
    } else {
        plan.targetOptions.push({
            id: 't_h',
            name: 'H 单靶向',
            description: '曲妥珠单抗 (赫赛汀)',
            cycle: '每3周1次，维持1年',
            type: 'target',
            recommended: true,
            reasoning: '低危HER2+ (N0且T<2cm)，单靶向治疗已足够，无需帕妥珠单抗。',
            totalCycles: 18,
            frequencyDays: 21,
            drugs: [
                { name: '曲妥珠单抗', standardDose: 6, unit: 'mg/kg' }
            ]
        });
    }
}

// 2. Luminal 靶向 (CDK4/6)
if (isLuminal) {
    // MonarchE标准: N2+ 或 (N1 且 (T>=5cm 或 G3 或 Ki67>=20%))
    const monarchECriteria = nStage >= 2 || (nStage === 1 && (tSize >= 5.0 || grade === 3 || ki67Val >= 20));
    
    if (monarchECriteria) {
        plan.targetOptions.push({
            id: 't_cdk46',
            name: 'CDK4/6 抑制剂',
            description: '阿贝西利 (Abemaciclib) 强化辅助治疗',
            cycle: '每日口服 x 2年',
            type: 'target',
            recommended: true,
            reasoning: 'MonarchE研究及指南推荐：对于高危HR+/HER2-早期乳腺癌（如N2+，或N1伴G3/高Ki67/大肿瘤），联合阿贝西利可显著改善iDFS。',
            totalCycles: 730, // 2 years
            frequencyDays: 1,
            drugs: [
                { name: '阿贝西利', standardDose: 150, unit: 'mg (BID)' }
            ]
        });
    }
}

// ================= 内分泌治疗 (Endocrine) =================

if (isLuminal) {
    // 绝经前且需要OFS的指征:
    // 1. 极高危 (N2+, T3+, G3)
    // 2. 中危且推荐化疗 (STEPP分析)
    // 3. 极年轻 (<35岁)
    const isHighRiskClinic = nStage >= 2 || grade === 3 || tSize > 5.0;
    const recommendChemo = plan.chemoOptions.some(c => c.recommended);
    const needOFS = !isMeno && (isHighRiskClinic || (nStage >= 1 && recommendChemo) || patient.age < 35);

    if (isMeno) {
        // --- 绝经后选项 ---
        
        // 1. 来曲唑
        plan.endocrineOptions.push({
            id: 'e_letrozole',
            name: '来曲唑 (Letrozole)',
            description: '非甾体类芳香化酶抑制剂 (AI)',
            cycle: '每日1次 口服 x 5年',
            type: 'endocrine',
            recommended: true,
            reasoning: '绝经后一线标准方案，疗效优于他莫昔芬。',
            pros: ['强效抑制雌激素', 'DFS获益优于他莫昔芬', '每日一次服用方便'],
            cons: ['骨质疏松/骨折风险增加', '关节肌肉疼痛', '血脂代谢异常'],
            totalCycles: 1825,
            frequencyDays: 1,
            drugs: [
                 { name: '来曲唑', standardDose: 2.5, unit: 'mg' }
            ]
        });

        // 2. 阿那曲唑
        plan.endocrineOptions.push({
            id: 'e_anastrozole',
            name: '阿那曲唑 (Anastrozole)',
            description: '非甾体类芳香化酶抑制剂 (AI)',
            cycle: '每日1次 口服 x 5年',
            type: 'endocrine',
            recommended: false, // 也是一线，但默认选一个
            reasoning: '绝经后一线标准方案，与来曲唑疗效相当。',
            pros: ['强效抑制雌激素', '耐受性相对良好'],
            cons: ['骨丢失风险', '关节痛', '潮热'],
            totalCycles: 1825,
            frequencyDays: 1,
            drugs: [
                 { name: '阿那曲唑', standardDose: 1, unit: 'mg' }
            ]
        });

        // 3. 依西美坦
        plan.endocrineOptions.push({
            id: 'e_exemestane',
            name: '依西美坦 (Exemestane)',
            description: '甾体类芳香化酶抑制剂 (AI)',
            cycle: '每日1次 口服 x 5年',
            type: 'endocrine',
            recommended: false,
            reasoning: '甾体类AI，结构不同，可作为非甾体AI耐受不良或耐药后的转换选择。',
            pros: ['无交叉耐药可能', '对血脂影响可能较小'],
            cons: ['偶尔出现雄激素样副作用(多毛/痤疮)', '骨关节痛'],
            totalCycles: 1825,
            frequencyDays: 1,
            drugs: [
                 { name: '依西美坦', standardDose: 25, unit: 'mg' }
            ]
        });

    } else {
        // --- 绝经前选项 ---
        
        if (needOFS) {
            // 1. 戈舍瑞林 + 依西美坦 (SOFT/TEXT 推荐)
            plan.endocrineOptions.push({
                id: 'e_gos_exe',
                name: '戈舍瑞林 + 依西美坦',
                description: 'OFS + 甾体类AI',
                cycle: '戈舍瑞林q28d + 依西美坦每日',
                type: 'endocrine',
                recommended: true,
                reasoning: `高危患者(G${grade > 0 ? grade : '?'} / ${markers.nodeStatus})，SOFT/TEXT研究证实联合AI疗效最优。`,
                pros: ['TEXT研究显示DFS获益最大', '极高危患者首选'],
                cons: ['绝经症状严重', '性功能障碍', '骨质疏松风险最高'],
                totalCycles: 1825,
                frequencyDays: 28,
                drugs: [
                    { name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' },
                    { name: '依西美坦', standardDose: 25, unit: 'mg' }
                ]
            });

            // 2. 戈舍瑞林 + 来曲唑
            plan.endocrineOptions.push({
                id: 'e_gos_let',
                name: '戈舍瑞林 + 来曲唑',
                description: 'OFS + 非甾体类AI',
                cycle: '戈舍瑞林q28d + 来曲唑每日',
                type: 'endocrine',
                recommended: false,
                reasoning: '强效抑制雌激素组合，适用于高危患者。',
                pros: ['强效降雌', '降低复发风险'],
                cons: ['严重骨丢失', '关节痛明显'],
                totalCycles: 1825,
                frequencyDays: 28,
                drugs: [
                    { name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' },
                    { name: '来曲唑', standardDose: 2.5, unit: 'mg' }
                ]
            });

             // 3. 亮丙瑞林 + AI (备选GnRH)
            plan.endocrineOptions.push({
                id: 'e_leu_let',
                name: '亮丙瑞林 + 来曲唑',
                description: 'OFS (亮丙瑞林) + AI',
                cycle: '亮丙瑞林q28d + 来曲唑每日',
                type: 'endocrine',
                recommended: false,
                reasoning: '另一种GnRH激动剂选择。',
                pros: ['药物选择灵活'],
                cons: ['同OFS+AI类副作用'],
                totalCycles: 1825,
                frequencyDays: 28,
                drugs: [
                    { name: '亮丙瑞林', standardDose: 3.75, unit: 'mg' },
                    { name: '来曲唑', standardDose: 2.5, unit: 'mg' }
                ]
            });

            // 4. 戈舍瑞林 + 他莫昔芬
            plan.endocrineOptions.push({
                id: 'e_gos_tam',
                name: '戈舍瑞林 + 他莫昔芬',
                description: 'OFS + SERM',
                cycle: '戈舍瑞林q28d + TAM每日',
                type: 'endocrine',
                recommended: false,
                reasoning: '中高危患者备选方案，若不能耐受AI的骨关节症状可选择此方案。',
                pros: ['骨质疏松风险低于AI组', '血脂影响小'],
                cons: ['潮热', '血栓风险', '子宫内膜增厚风险'],
                totalCycles: 1825,
                frequencyDays: 28,
                drugs: [
                    { name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' },
                    { name: '他莫昔芬', standardDose: 20, unit: 'mg' }
                ]
            });

        } else {
            // 低危绝经前: 他莫昔芬
            plan.endocrineOptions.push({
                id: 'e_tam',
                name: '他莫昔芬 (TAM)',
                description: '经典单药口服',
                cycle: '每日1次 x 5年',
                type: 'endocrine',
                recommended: true,
                reasoning: '低危绝经前患者，他莫昔芬单药是标准方案，无需OFS过度强化。',
                pros: ['经典药物疗效确切', '骨保护作用(绝经前)', '心血管获益'],
                cons: ['子宫内膜增厚', '深静脉血栓风险', '潮热'],
                totalCycles: 1825,
                frequencyDays: 1,
                drugs: [
                    { name: '他莫昔芬', standardDose: 20, unit: 'mg' }
                ]
            });
        }
    }
}

// ================= 免疫治疗 (Immune) =================

// 指征：
// 1. 早期高危 TNBC (T>2cm 或 N+): 新辅助+辅助 (Keynote-522)
// 2. 晚期 TNBC (PD-L1+): 一线治疗 (Keynote-355 / IMpassion130)

if (isTNBC) {
    const isHighRiskEarly = tSize > 2.0 || nStage >= 1;
    
    // 场景 A: 新辅助治疗路径 (Keynote-522 模式)
    if (isNeoadjuvantPath && isHighRiskEarly) {
        // Option 1: Pembrolizumab
        plan.immuneOptions.push({
            id: 'i_pembro_neo',
            name: '帕博利珠单抗 (Keytruda)',
            description: 'PD-1抑制剂，联合化疗',
            cycle: '200mg q3w 或 400mg q6w',
            type: 'immune',
            recommended: true,
            reasoning: 'Keynote-522模式：术前联合化疗，术后继续单药维持，显著改善EFS，是高危TNBC的标准治疗。',
            totalCycles: 17, // 8 neoadjuvant + 9 adjuvant
            frequencyDays: 21,
            drugs: [
                { name: '帕博利珠单抗', standardDose: 200, unit: 'mg' } // Fixed dose
            ],
            pros: ['全球最高级别证据 (KN522)', '显著降低复发风险'],
            cons: ['免疫相关不良反应(irAEs)', '价格较高']
        });

        // Option 2: Toripalimab (China option, TORCHlight)
        plan.immuneOptions.push({
            id: 'i_tori_neo',
            name: '特瑞普利单抗 (拓益)',
            description: '国产PD-1抑制剂，联合化疗',
            cycle: '240mg q3w',
            type: 'immune',
            recommended: false,
            reasoning: '基于TORCHlight等研究数据，在TNBC围手术期治疗中显示出良好疗效，且具有药物经济学优势。',
            totalCycles: 17,
            frequencyDays: 21,
            drugs: [
                { name: '特瑞普利单抗', standardDose: 240, unit: 'mg' }
            ],
            pros: ['国产药物性价比高', '临床数据支持'],
            cons: ['免疫相关不良反应']
        });
    }
}

return plan;
};
