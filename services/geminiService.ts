
import { GoogleGenAI, Type } from "@google/genai";
import { ClinicalMarkers, Patient, TreatmentOption, DetailedRegimenPlan } from '../types';
import { AI_MODEL_NAME } from '../constants';

// Fix: Exclusively use process.env.API_KEY and use the GoogleGenAI class as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 核心通用请求函数
const callGeminiApi = async (prompt: string, schema: any) => {
  try {
    // Fix: Use ai.models.generateContent with the model name, prompt, and responseSchema.
    const response = await ai.models.generateContent({
      model: AI_MODEL_NAME,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    // Fix: Use response.text property to extract output.
    const text = response.text;
    if (!text) throw new Error("AI 返回数据为空");

    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error instanceof SyntaxError) {
      throw new Error("AI 返回的数据不是有效的 JSON 格式，请重试。");
    }
    throw error;
  }
};

export const generateTreatmentOptions = async (patient: Patient, markers: ClinicalMarkers): Promise<TreatmentOption[]> => {
const prompt = `
作为一名乳腺外科专家，请根据以下患者数据制定 2-3种 不同的总体治疗路径选项。
患者信息：
- 年龄: ${patient.age}岁, 绝经: ${markers.menopause ? '是' : '否'}
- 诊断: ${patient.diagnosis}
- 病理: ER:${markers.erStatus}, PR:${markers.prStatus}, HER2:${markers.her2Status}, Ki67:${markers.ki67}, T:${markers.tumorSize}, N:${markers.nodeStatus}

请返回一个包含治疗路径建议的 JSON 数组。
`;

const schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: '唯一ID，如 "plan_1"' },
      title: { type: Type.STRING, description: '方案标题' },
      iconType: { type: Type.STRING, description: '只能是 "surgery", "chemo", "drug", 或 "observation" 之一' },
      description: { type: Type.STRING, description: '详细临床描述' },
      duration: { type: Type.STRING, description: '预估时长' },
      pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: '优点列表' },
      cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: '缺点列表' },
      recommended: { type: Type.BOOLEAN, description: '是否为指南推荐的最佳方案' }
    },
    required: ["id", "title", "iconType", "description", "duration", "pros", "cons", "recommended"],
    propertyOrdering: ["id", "title", "iconType", "description", "duration", "pros", "cons", "recommended"],
  },
};

return await callGeminiApi(prompt, schema) as TreatmentOption[];
};

export const generateDetailedRegimens = async (patient: Patient, markers: ClinicalMarkers, highLevelPlan: TreatmentOption): Promise<DetailedRegimenPlan | null> => {
// Fix: Corrected stray parenthesis in prompt template.
const prompt = `
基于已选定的总体治疗路径: "${highLevelPlan.description}"，
请为该乳腺癌患者提供具体的药物/治疗方案选项。
患者数据：
- 年龄: ${patient.age}, 绝经: ${markers.menopause ? '是' : '否'}
- 分型: ${patient.subtype}
- 病理: ER:${markers.erStatus}, HER2:${markers.her2Status}, T:${markers.tumorSize}, N:${markers.nodeStatus}

请返回一个包含 chemoOptions, endocrineOptions, targetOptions, immuneOptions 的 JSON 对象。
`;

const regimenSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    name: { type: Type.STRING, description: '方案名称 (如 "AC-T")' },
    description: { type: Type.STRING },
    cycle: { type: Type.STRING },
    type: { type: Type.STRING, description: '对应 "chemo", "endocrine", "target", "immune"' },
    recommended: { type: Type.BOOLEAN },
    totalCycles: { type: Type.INTEGER },
    frequencyDays: { type: Type.INTEGER },
    drugs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          standardDose: { type: Type.NUMBER },
          unit: { type: Type.STRING, description: '单位: mg/m2, mg/kg, mg' }
        },
        required: ["name", "standardDose", "unit"]
      }
    }
  },
  required: ["id", "name", "description", "cycle", "type", "recommended", "totalCycles", "frequencyDays", "drugs"]
};

const schema = {
  type: Type.OBJECT,
  properties: {
    chemoOptions: { type: Type.ARRAY, items: regimenSchema },
    endocrineOptions: { type: Type.ARRAY, items: regimenSchema },
    targetOptions: { type: Type.ARRAY, items: regimenSchema },
    immuneOptions: { type: Type.ARRAY, items: regimenSchema }
  },
  required: ["chemoOptions", "endocrineOptions", "targetOptions", "immuneOptions"],
  propertyOrdering: ["chemoOptions", "endocrineOptions", "targetOptions", "immuneOptions"]
};

return await callGeminiApi(prompt, schema) as DetailedRegimenPlan;
};
