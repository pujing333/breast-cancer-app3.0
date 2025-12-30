
import React, { useState } from 'react';
import { TreatmentEvent, Patient } from '../types';
import { COMMON_SIDE_EFFECTS } from '../constants';

interface TimelineProps {
  patient: Patient;
  onAddEvent: (event: Omit<TreatmentEvent, 'id'>) => void;
  onUpdateEvent?: (event: TreatmentEvent) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ patient, onAddEvent, onUpdateEvent }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [isAdding, setIsAdding] = useState(false);
  const [activeEvent, setActiveEvent] = useState<TreatmentEvent | null>(null);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);

  const [newEvent, setNewEvent] = useState<Partial<TreatmentEvent>>({
    type: 'chemo' as any,
    date: selectedDateStr,
    completed: false
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'chemo': return 'bg-red-500';      // 化疗：红色
      case 'endocrine': return 'bg-blue-500';  // 内分泌：蓝色
      case 'target': return 'bg-green-500';    // 靶向：绿色
      case 'immune': return 'bg-teal-500';     // 免疫：青色
      case 'surgery': return 'bg-purple-500';  // 手术：紫色
      case 'exam': return 'bg-yellow-500';     // 检查：黄色
      default: return 'bg-gray-400';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'chemo': return '化疗';
      case 'endocrine': return '内分泌治疗';
      case 'target': return '靶向治疗';
      case 'immune': return '免疫治疗';
      case 'surgery': return '手术';
      case 'exam': return '检查';
      default: return '其他';
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); 

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); 
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const blankDays = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const eventsByDate: Record<string, TreatmentEvent[]> = {};
  patient.timeline.forEach(e => {
      if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
      eventsByDate[e.date].push(e);
  });

  const displayedEvents = viewMode === 'list' 
    ? [...patient.timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : (eventsByDate[selectedDateStr] || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEvent.title && newEvent.date) {
      onAddEvent({
        title: newEvent.title,
        date: newEvent.date,
        description: newEvent.description || '',
        type: newEvent.type as any,
        completed: newEvent.completed || false
      });
      setIsAdding(false);
      setNewEvent({ ...newEvent, title: '', description: '' });
    }
  };

  const openSideEffectModal = (event: TreatmentEvent) => {
      setActiveEvent(event);
      setSelectedEffects(event.sideEffects || []);
  };

  const saveSideEffects = () => {
      if (activeEvent && onUpdateEvent) {
          onUpdateEvent({...activeEvent, sideEffects: selectedEffects});
          setActiveEvent(null);
          setSelectedEffects([]);
      }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm h-full flex flex-col relative">
      {/* 不良反应记录与建议弹窗 */}
      {activeEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">不良反应记录</h3>
                        <p className="text-xs text-gray-500">{activeEvent.title} ({activeEvent.date})</p>
                      </div>
                      <button onClick={() => setActiveEvent(null)} className="text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                      <div className="mb-4 text-[11px] text-gray-400 font-bold uppercase">选择出现的症状</div>
                      <div className="flex flex-wrap gap-2 mb-8">
                          {Object.keys(COMMON_SIDE_EFFECTS).map(effect => (
                              <button
                                  key={effect}
                                  onClick={() => setSelectedEffects(prev => prev.includes(effect) ? prev.filter(e => e !== effect) : [...prev, effect])}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${selectedEffects.includes(effect) ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600'}`}
                              >
                                  {effect}
                              </button>
                          ))}
                      </div>

                      {/* 专家建议区域 (Management Guide) */}
                      {selectedEffects.length > 0 && (
                          <div className="space-y-6 animate-fade-in border-t pt-6">
                              <div className="text-xs font-bold text-medical-600 flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                  专家处理建议
                              </div>
                              {selectedEffects.map(effect => {
                                  const guide = COMMON_SIDE_EFFECTS[effect];
                                  if (!guide) return null;
                                  return (
                                      <div key={effect} className="bg-medical-50/50 rounded-xl p-4 border border-medical-100 shadow-sm">
                                          <div className="font-bold text-sm text-gray-800 mb-3 flex items-center">
                                              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                              {effect}
                                          </div>
                                          <div className="space-y-3">
                                              <div>
                                                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">应对策略 (Strategies)</div>
                                                  <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                                                      {guide.strategies.map((s, i) => <li key={i}>{s}</li>)}
                                                  </ul>
                                              </div>
                                              <div>
                                                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">参考药物 (Medications)</div>
                                                  <div className="flex flex-wrap gap-1">
                                                      {guide.medications.map((m, i) => (
                                                          <span key={i} className="text-[10px] bg-white border border-medical-200 text-medical-700 px-2 py-0.5 rounded-full">{m}</span>
                                                      ))}
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
                  <div className="p-4 border-t bg-gray-50 flex gap-3">
                      <button onClick={() => setActiveEvent(null)} className="flex-1 py-2.5 border rounded-lg text-gray-600 text-sm">取消</button>
                      <button onClick={saveSideEffects} className="flex-1 py-2.5 bg-medical-600 text-white rounded-lg text-sm font-medium shadow-md">保存记录</button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${viewMode === 'calendar' ? 'bg-white shadow text-medical-600' : 'text-gray-500'}`}>日历</button>
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${viewMode === 'list' ? 'bg-white shadow text-medical-600' : 'text-gray-500'}`}>列表</button>
        </div>
        <button onClick={() => setIsAdding(!isAdding)} className="text-sm bg-medical-600 text-white px-3 py-1.5 rounded-full shadow-sm">{isAdding ? '取消' : '+ 新建'}</button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 p-4 rounded-lg border animate-fade-in">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">类型</label>
                <select className="w-full rounded border p-2 text-sm" value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}>
                    <option value="chemo">化疗</option>
                    <option value="endocrine">内分泌</option>
                    <option value="target">靶向</option>
                    <option value="exam">检查</option>
                    <option value="surgery">手术</option>
                    <option value="other">其他</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">日期</label>
                <input type="date" required className="w-full rounded border p-2 text-sm" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
            </div>
          </div>
          <input type="text" required placeholder="标题" className="w-full rounded border p-2 text-sm mb-3" value={newEvent.title || ''} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
          <button type="submit" className="w-full bg-medical-600 text-white py-2 rounded text-sm font-medium">保存</button>
        </form>
      )}

      {viewMode === 'calendar' && (
          <div className="mb-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={handlePrevMonth} className="p-1 text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <h3 className="font-bold text-lg text-gray-800">{year}年 {month + 1}月</h3>
                <button onClick={handleNextMonth} className="p-1 text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            </div>
            <div className="grid grid-cols-7 text-center mb-2">
                {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-xs font-medium text-gray-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {blankDays.map((_, i) => <div key={`blank-${i}`} className="h-12"></div>)}
                {days.map(d => {
                    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isSelected = selectedDateStr === dateString;
                    const isToday = new Date().toISOString().split('T')[0] === dateString;
                    const dayEvents = eventsByDate[dateString] || [];
                    const hasSideEffects = dayEvents.some(e => e.sideEffects && e.sideEffects.length > 0);

                    return (
                        <div key={d} onClick={() => setSelectedDateStr(dateString)} className={`h-12 rounded-lg flex flex-col items-center justify-start pt-1 cursor-pointer transition-all border ${isSelected ? 'bg-medical-50 border-medical-500' : isToday ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-transparent'} ${hasSideEffects ? 'ring-1 ring-red-300' : ''}`}>
                            <span className={`text-sm font-medium ${isToday ? 'text-yellow-700' : 'text-gray-700'}`}>{d}</span>
                            <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                                {dayEvents.slice(0, 4).map((evt, i) => (
                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${getTypeColor(evt.type)}`} />
                                ))}
                                {dayEvents.length > 4 && <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>
      )}
      
      <div className="flex-1 overflow-y-auto min-h-[200px]">
         {viewMode === 'calendar' && <div className="mb-3 px-1 text-sm text-gray-500 font-medium border-b pb-2">{selectedDateStr} 的日程 ({displayedEvents.length})</div>}
         <div className="relative border-l-2 border-gray-100 ml-3 space-y-6 pb-4">
            {displayedEvents.map((event) => (
            <div key={event.id} className="relative ml-6">
                <span className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white ${getTypeColor(event.type)}`}></span>
                <div className="flex justify-between items-start">
                    <div>
                         {viewMode === 'list' && <span className="text-xs text-gray-400 block">{event.date}</span>}
                         <h4 className="text-sm font-bold text-gray-900">{event.title}</h4>
                         <p className="text-[10px] text-gray-400 uppercase tracking-wide">{getTypeLabel(event.type)}</p>
                    </div>
                    {onUpdateEvent && (
                        <button onClick={() => openSideEffectModal(event)} className={`text-[10px] border px-1.5 py-0.5 rounded font-bold transition-colors ${event.sideEffects && event.sideEffects.length > 0 ? 'bg-red-500 text-white border-red-500' : 'text-medical-600 border-medical-200'}`}>不良反应</button>
                    )}
                </div>
                {event.dosageDetails && <div className="mt-1.5 text-[10px] bg-blue-50 text-blue-700 p-1.5 rounded font-mono">{event.dosageDetails}</div>}
                {event.description && <p className="text-[11px] text-gray-500 mt-1">{event.description}</p>}
                {event.sideEffects && event.sideEffects.length > 0 && (
                    <div className="mt-2 bg-red-50 p-2 rounded border border-red-100 animate-fade-in">
                        <h5 className="text-[9px] font-bold text-red-800 mb-1 uppercase">当前记录症状:</h5>
                        <div className="flex flex-wrap gap-1">
                            {event.sideEffects.map((s, idx) => <span key={idx} className="text-[9px] bg-white px-1.5 py-0.5 rounded border border-red-200 text-red-600 font-medium">{s}</span>)}
                        </div>
                        <div className="mt-2 text-[8px] text-gray-400 italic">点击上方“不良反应”按钮查看专家建议</div>
                    </div>
                )}
            </div>
            ))}
         </div>
      </div>
    </div>
  );
};
