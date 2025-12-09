
import React, { useState } from 'react';
import { Patient, MolecularSubtype, TreatmentStage } from '../types';
import { Header } from './Header';

interface AddPatientFormProps {
  onSave: (patient: Omit<Patient, 'id'>) => void;
  onCancel: () => void;
}

export const AddPatientForm: React.FC<AddPatientFormProps> = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    mrn: '',
    admissionDate: new Date().toISOString().split('T')[0],
    diagnosis: '',
    subtype: MolecularSubtype.Unknown,
    stage: TreatmentStage.Diagnosis,
    height: '',
    weight: '',
    phone: '',
    address: '',
    occupation: '',
    histologicalGrade: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      age: Number(formData.age) || 0,
      mrn: formData.mrn,
      admissionDate: formData.admissionDate,
      diagnosis: formData.diagnosis,
      subtype: formData.subtype,
      stage: formData.stage,
      height: formData.height ? Number(formData.height) : undefined,
      weight: formData.weight ? Number(formData.weight) : undefined,
      phone: formData.phone,
      address: formData.address,
      occupation: formData.occupation,
      markers: {
          erStatus: '', 
          prStatus: '', 
          her2Status: '', 
          ki67: '', 
          tumorSize: '', 
          nodeStatus: '', 
          histologicalGrade: formData.histologicalGrade, 
          menopause: false
      },
      timeline: []
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      <Header title="新建患者档案" onBack={onCancel} />
      
      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
            
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">姓名 <span className="text-red-500">*</span></label>
                <input 
                    type="text" required
                    placeholder="输入患者姓名"
                    className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">年龄 <span className="text-red-500">*</span></label>
                    <input 
                        type="number" required min="0" max="120"
                        className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                        value={formData.age}
                        onChange={e => setFormData({...formData, age: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">入院日期</label>
                    <input 
                        type="date" required
                        className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                        value={formData.admissionDate}
                        onChange={e => setFormData({...formData, admissionDate: e.target.value})}
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">身高 (cm)</label>
                    <input 
                        type="number" min="0"
                        placeholder="可选"
                        className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                        value={formData.height}
                        onChange={e => setFormData({...formData, height: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">体重 (kg)</label>
                    <input 
                        type="number" min="0"
                        placeholder="可选"
                        className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                        value={formData.weight}
                        onChange={e => setFormData({...formData, weight: e.target.value})}
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">联系电话</label>
                <input 
                    type="tel" 
                    placeholder="可选"
                    className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                />
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">职业</label>
                <input 
                    type="text" 
                    placeholder="可选"
                    className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                    value={formData.occupation}
                    onChange={e => setFormData({...formData, occupation: e.target.value})}
                />
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">居住地址</label>
                <input 
                    type="text" 
                    placeholder="可选"
                    className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                />
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">住院号 / MRN <span className="text-red-500">*</span></label>
                <input 
                    type="text" required
                    placeholder="例如: MZ2024001"
                    className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                    value={formData.mrn}
                    onChange={e => setFormData({...formData, mrn: e.target.value})}
                />
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">临床诊断 <span className="text-red-500">*</span></label>
                <input 
                    type="text" required
                    placeholder="例如: 左乳浸润性导管癌"
                    className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none"
                    value={formData.diagnosis}
                    onChange={e => setFormData({...formData, diagnosis: e.target.value})}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">分子分型</label>
                    <select 
                        className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none bg-white"
                        value={formData.subtype}
                        onChange={e => setFormData({...formData, subtype: e.target.value as MolecularSubtype})}
                    >
                        {Object.values(MolecularSubtype).map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">组织学分级</label>
                    <select 
                        className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none bg-white"
                        value={formData.histologicalGrade}
                        onChange={e => setFormData({...formData, histologicalGrade: e.target.value})}
                    >
                         <option value="">未知</option>
                         <option value="G1">G1 (高分化)</option>
                         <option value="G2">G2 (中分化)</option>
                         <option value="G3">G3 (低分化)</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">当前治疗阶段</label>
                <select 
                    className="w-full rounded-lg border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none bg-white"
                    value={formData.stage}
                    onChange={e => setFormData({...formData, stage: e.target.value as TreatmentStage})}
                >
                    {Object.values(TreatmentStage).map(stage => (
                        <option key={stage} value={stage}>{stage}</option>
                    ))}
                </select>
            </div>

            <div className="pt-4 pb-4">
                <button 
                    type="submit" 
                    className="w-full bg-medical-600 text-white py-3.5 rounded-xl shadow-lg text-base font-bold hover:bg-medical-700 active:scale-[0.98] transition-all"
                >
                    确认添加
                </button>
            </div>

        </form>
      </div>
    </div>
  );
};
