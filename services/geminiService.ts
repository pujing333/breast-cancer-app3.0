
import { ClinicalMarkers, Patient, TreatmentOption, DetailedRegimenPlan } from '../types';
import { AI_MODEL_NAME } from '../constants';

// 获取 API Key
const getApiKey = () => {
let apiKey = '';
// 1. 优先尝试从 vite.config.ts 注入的全局变量中读取
// @ts-ignore
if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    // @ts-ignore
    apiKey = process.env.API_KEY;
} 

// 2. 后备尝试：读取标准的 Vite 环境变量
if (!apiKey) {
    // @ts-ignore
    apiKey = import.meta.env.VITE_API_KEY;
}

if (apiKey) {
    apiKey = apiKey.trim();
    console.log(`[GeminiService] API Key Loaded: ${apiKey.substring(0, 4)}****`);
} else {
    console.error("[GeminiService] API Key MISSING");
    throw new Error("API Key 未配置。请在 Vercel 环境变量中添加 API_KEY 或 VITE_API_KEY，并重新部署 (Redeploy)。");
}
return apiKey;
};

// 核心通用请求函数
const callGeminiApi = async (prompt: string) => {
const apiKey = getApiKey();
// 使用 v1beta 接口，对 Gemini 1.5 Flash 支持最好
const baseUrl = '/google-api/v1beta/models';

// URL 参数传递 Key，确保穿透代理
const url = `${baseUrl}/${AI_MODEL_NAME}:generateContent?key=${apiKey}`;

// 【关键修改】移除 generationConfig，完全依赖 Prompt 来引导 JSON 输出。
const body: any = {
    contents: [{
        parts: [{ text: prompt }]
    }]
};

try {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    // 获取响应文本
    const responseText = await response.text();
    let jsonErr: any = null;
    try {
        jsonErr = JSON.parse(responseText);
    } catch (e) {
        jsonErr = null;
    }

    if (!response.ok) {
        let errorDetails = response.statusText;
        if (jsonErr && jsonErr.error && jsonErr.error.message) {
            errorDetails = jsonErr.error.message;
        }

        if (response.status === 404) {
            if (!jsonErr || (typeof jsonErr === 'string' && jsonErr.includes('DOCTYPE'))) {
                throw new Error("网络配置错误 (404): Vercel 代理通道丢失。请检查 GitHub 根目录 vercel.json 是否上传成功。");
            } 
            else {
                throw new Error(`Google 模型错误 (404): 找不到模型 '${AI_MODEL_NAME}'。详细信息: ${errorDetails}`);
            }
        }
        
        if (response.status === 403) {
             if (errorDetails.includes("leaked") || errorDetails.includes("disabled")) {
                 throw new Error("⛔️ 严重安全警告: API Key 已被禁用。请去 AI Studio 生成新 Key 并更新 Vercel 变量。");
             }
             throw new Error(`权限拒绝 (403): ${errorDetails}。请检查 Vercel 后台 API_KEY。`);
        }
        
        if (response.status === 400) {
            throw new Error(`请求格式错误 (400): ${errorDetails}。已切换至无 Schema 兼容模式，请重试。`);
        }

        throw new Error(`API 请求失败 (${response.status}): ${errorDetails}`);
    }

    const data = JSON.parse(responseText);
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("AI 返回数据为空");

    // 【新增清洗逻辑】因为移除了 JSON Mode，AI 可能会返回 Markdown 代码块
    // 我们手动去除 ```json 和 ``` 标记，确保 JSON.parse 能成功
    text = text.trim();
    if (text.startsWith('```')) {
        text = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    }

    return JSON.parse(text);
} catch (error: any) {
    console.error("Gemini Error:", error);
    // 如果 JSON 解析失败，抛出更友好的错误
    if (error instanceof SyntaxError) {
        throw new Error("AI 返回的数据不是有效的 JSON 格式，请重试。");
    }
    throw error;
}
};

export const generateTreatmentOptions = async (patient: Patient, markers: ClinicalMarkers): Promise<TreatmentOption[]> => {
// 强化 Prompt，因为我们移除了 Schema，所以需要在 Prompt 里强调 JSON 结构
const prompt = `
作为一名乳腺外科专家，请根据以下患者数据制定 2-3种 不同的总体治疗路径选项。
患者信息：
- 年龄: ${patient.age}岁, 绝经: ${markers.menopause ? '是' : '否'}
- 诊断: ${patient.diagnosis}
- 病理: ER:${markers.erStatus}, PR:${markers.prStatus}, HER2:${markers.her2Status}, Ki67:${markers.ki67}, T:${markers.tumorSize}, N:${markers.nodeStatus}

请严格返回一个 **纯JSON数组** (Array of Objects)，不要包含任何Markdown标记或其他文字。
数组中每个对象必须包含以下字段：
- id (string): 唯一ID，如 "plan_1"
- title (string): 方案标题
- iconType (string): 只能是 "surgery", "chemo", "drug", 或 "observation" 之一
- description (string): 详细临床描述
- duration (string): 预估时长
- pros (string数组): 优点列表
- cons (string数组): 缺点列表
- recommended (boolean): 是否为指南推荐的最佳方案（仅一个为true）
`;

return await callGeminiApi(prompt) as TreatmentOption[];
};

export const generateDetailedRegimens = async (patient: Patient, markers: ClinicalMarkers, highLevelPlan: TreatmentOption): Promise<DetailedRegimenPlan | null> => {
const prompt = `
基于已选定的总体治疗路径："
${highLevelPlan.description})，
请为该乳腺癌患者提供具体的药物/治疗方案选项。
患者数据：
- 年龄: ${patient.age}, 绝经: ${markers.menopause ? '是' : '否'}
- 分型: ${patient.subtype}
- 病理: ER:${markers.erStatus}, HER2:${markers.her2Status}, T:${markers.tumorSize}, N:${markers.nodeStatus}

请严格返回一个 **纯JSON对象**，不要包含任何Markdown标记或其他文字。
对象需包含以下四个数组字段：chemoOptions, endocrineOptions, targetOptions, immuneOptions。

每个数组中的对象必须包含：
- id (string)
- name (string): 方案名称 (如 "AC-T")
- description (string): 描述
- cycle (string): 周期描述
- type (string): 对应 "chemo", "endocrine", "target", "immune"
- recommended (boolean)
- totalCycles (number): 总周期数 (数字)
- frequencyDays (number): 单周期天数 (数字)
- drugs (数组): 包含 name(药名), standardDose(数值), unit(单位: mg/m2, mg/kg, mg)
`;

return await callGeminiApi(prompt) as DetailedRegimenPlan;
};
