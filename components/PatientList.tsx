import React, { useState } from 'react';
import { Patient, MolecularSubtype } from '../types';

interface PatientListProps {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onAddPatient: () => void;
}

export const PatientList: React.FC<PatientListProps> = ({ patients, onSelectPatient, onAddPatient }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPatients = patients.filter(p => 
    p.name.includes(searchTerm) || p.mrn.includes(searchTerm)
  );

  const getSubtypeColor = (subtype: MolecularSubtype) => {
    switch (subtype) {
      case MolecularSubtype.LuminalA: return 'bg-blue-100 text-blue-800';
      case MolecularSubtype.LuminalB: return 'bg-indigo-100 text-indigo-800';
      case MolecularSubtype.HER2Positive: return 'bg-pink-100 text-pink-800';
      case MolecularSubtype.TripleNegative: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Search Bar */}
      <div className="p-4 bg-white sticky top-14 z-40 shadow-sm">
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-medical-500 focus:ring-1 focus:ring-medical-500 sm:text-sm"
                placeholder="搜索姓名或住院号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        {filteredPatients.map(patient => (
          <div 
            key={patient.id}
            onClick={() => onSelectPatient(patient)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 active:scale-[0.98] transition-transform duration-100"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{patient.name} <span className="text-sm font-normal text-gray-500 ml-1">{patient.age}岁</span></h3>
                <p className="text-xs text-gray-400">ID: {patient.mrn}</p>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${getSubtypeColor(patient.subtype)}`}>
                {patient.subtype}
              </span>
            </div>
            
            <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-gray-600 truncate max-w-[70%]">
                    {patient.diagnosis}
                </div>
                <div className="text-xs text-medical-600 font-medium bg-medical-50 px-2 py-1 rounded">
                    {patient.stage}
                </div>
            </div>
          </div>
        ))}
        
        {filteredPatients.length === 0 && (
            <div className="text-center py-10 text-gray-400">
                无匹配患者
            </div>
        )}
      </div>

      {/* FAB Add Button */}
      <button 
        onClick={onAddPatient}
        className="fixed bottom-6 right-6 bg-medical-600 text-white rounded-full p-4 shadow-lg hover:bg-medical-500 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};