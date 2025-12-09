
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
  
  // Side Effect Modal State
  const [activeEvent, setActiveEvent] = useState<TreatmentEvent | null>(null);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);

  const [newEvent, setNewEvent] = useState<Partial<TreatmentEvent>>({
    type: 'medication',
    date: selectedDateStr,
    completed: false
  });

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

  // Side Effect Logic
  const openSideEffectModal = (event: TreatmentEvent) => {
      setActiveEvent(event);
      setSelectedEffects(event.sideEffects || []);
  };

  const closeSideEffectModal = () => {
      setActiveEvent(null);
      setSelectedEffects([]);
  };

  const toggleEffect = (effect: string) => {
      if (selectedEffects.includes(effect)) {
          setSelectedEffects(selectedEffects.filter(e => e !== effect));
      } else {
          setSelectedEffects([...selectedEffects, effect]);
      }
  };

  const saveSideEffects = () => {
      if (activeEvent && onUpdateEvent) {
          onUpdateEvent({
              ...activeEvent,
              sideEffects: selectedEffects
          });
          closeSideEffectModal();
      }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'surgery': return 'bg-red-500';
      case 'medication': return 'bg-blue-500';
      case 'exam': return 'bg-yellow-500';
      case 'other': return 'bg-purple-500'; 
      default: return 'bg-gray-500';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'surgery': return '手术';
      case 'medication': return '药物/化疗';
      case 'exam': return '检查';
      case 'other': return '其他/记录';
      default: return '其他';
    }
  };

  // --- Calendar Helpers ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); 

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

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

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm h-full flex flex-col relative">
      
      {/* Side Effect Modal */}
      {activeEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">记录不良反应</h3>
                        <p className="text-xs text-gray-500">事件: {activeEvent.title} ({activeEvent.date})</p>
                      </div>
                      <button onClick={closeSideEffectModal} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5">
                      <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">请勾选今日出现的症状</label>
                      <div className="flex flex-wrap gap-2 mb-6">
                          {Object.keys(COMMON_SIDE_EFFECTS).map(effect => (
                              <button
                                  key={effect}
                                  onClick={() => toggleEffect(effect)}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                      selectedEffects.includes(effect)
                                      ? 'bg-red-50 border-red-500 text-red-700 shadow-sm'
                                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                  }`}
                              >
                                  {effect}
                              </button>
                          ))}
                      </div>

                      {selectedEffects.length > 0 && (
                          <div className="space-y-4 animate-fade-in">
                             <h4 className="text-sm font-bold text-gray-800 border-l-4 border-medical-500 pl-2">护理与用药建议</h4>
                             {selectedEffects.map(effect => (
                                 <div key={effect} className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                     <h5 className="font-bold text-sm text-blue-800 mb-2">{effect}</h5>
                                     
                                     <div className="mb-2">
                                         <span className="text-xs font-bold text-gray-500 block mb-1">护理策略:</span>
                                         <ul className="list-disc list-inside text-xs text-gray-700 space-y-0.5">
                                             {COMMON_SIDE_EFFECTS[effect].strategies.map((s, i) => <li key={i}>{s}</li>)}
                                         </ul>
                                     </div>
                                     
                                     <div>
                                         <span className="text-xs font-bold text-gray-500 block mb-1">推荐药物 (请遵医嘱):</span>
                                         <div className="flex flex-wrap gap-1">
                                            {COMMON_SIDE_EFFECTS[effect].medications.map((m, i) => (
                                                <span key={i} className="text-[10px] bg-white border border-blue-200 text-blue-600 px-1.5 py-0.5 rounded">
                                                    {m}
                                                </span>
                                            ))}
                                         </div>
                                     </div>
                                 </div>
                             ))}
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t bg-gray-50 flex gap-3">
                      <button onClick={closeSideEffectModal} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-600 text-sm font-medium hover:bg-white">
                          取消
                      </button>
                      <button onClick={saveSideEffects} className="flex-1 py-2.5 bg-medical-600 text-white rounded-lg text-sm font-medium hover:bg-medical-700 shadow-sm">
                          保存记录
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button 
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white shadow text-medical-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                日历视图
            </button>
            <button 
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-medical-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                列表视图
            </button>
        </div>
        <button 
          onClick={() => {
            setNewEvent(prev => ({...prev, date: selectedDateStr}));
            setIsAdding(!isAdding);
          }}
          className="text-sm bg-medical-600 text-white px-3 py-1.5 rounded-full hover:bg-medical-700 shadow-sm"
        >
          {isAdding ? '取消' : '+ 新建'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200 animate-fade-in flex-shrink-0">
          <h4 className="text-sm font-bold text-gray-700 mb-3">添加新日程</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">类型</label>
                    <select 
                        className="w-full rounded-md border-gray-300 border p-2 text-sm"
                        value={newEvent.type}
                        onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}
                    >
                        <option value="medication">药物/化疗</option>
                        <option value="surgery">手术</option>
                        <option value="exam">检查</option>
                        <option value="other">其他</option>
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">日期</label>
                    <input 
                        type="date" 
                        required
                        className="w-full rounded-md border-gray-300 border p-2 text-sm"
                        value={newEvent.date}
                        onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                    />
                </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">标题</label>
              <input 
                type="text" 
                required
                placeholder="例如: 第3次化疗"
                className="w-full rounded-md border-gray-300 border p-2 text-sm"
                value={newEvent.title || ''}
                onChange={e => setNewEvent({...newEvent, title: e.target.value})}
              />
            </div>
            <div>
               <label className="block text-xs font-medium text-gray-700 mb-1">详情备注</label>
               <textarea 
                 className="w-full rounded-md border-gray-300 border p-2 text-sm h-16"
                 placeholder="备注信息..."
                 value={newEvent.description || ''}
                 onChange={e => setNewEvent({...newEvent, description: e.target.value})}
               />
            </div>
            <button type="submit" className="w-full bg-medical-600 text-white py-2 rounded-md text-sm font-medium mt-2">保存日程</button>
          </div>
        </form>
      )}

      {viewMode === 'calendar' && (
          <div className="mb-6 animate-fade-in">
            {/* Calendar Header */}
            <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h3 className="font-bold text-lg text-gray-800">
                    {year}年 {month + 1}月
                </h3>
                <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 text-center mb-2">
                {['日','一','二','三','四','五','六'].map(d => (
                    <div key={d} className="text-xs font-medium text-gray-400">{d}</div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
                {blankDays.map((_, i) => <div key={`blank-${i}`} className="h-12"></div>)}
                {days.map(d => {
                    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isSelected = selectedDateStr === dateString;
                    const isToday = new Date().toISOString().split('T')[0] === dateString;
                    const dayEvents = eventsByDate[dateString] || [];
                    
                    return (
                        <div 
                            key={d}
                            onClick={() => setSelectedDateStr(dateString)}
                            className={`h-12 rounded-lg flex flex-col items-center justify-start pt-1 cursor-pointer transition-all border ${
                                isSelected 
                                    ? 'bg-medical-50 border-medical-500 ring-1 ring-medical-500' 
                                    : isToday 
                                        ? 'bg-yellow-50 border-yellow-200' 
                                        : 'bg-white border-transparent hover:bg-gray-50'
                            }`}
                        >
                            <span className={`text-sm font-medium ${isToday ? 'text-yellow-700' : 'text-gray-700'}`}>{d}</span>
                            
                            {/* Event Dots */}
                            <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                                {dayEvents.slice(0, 4).map((evt, i) => (
                                    <div 
                                        key={i} 
                                        className={`w-1.5 h-1.5 rounded-full ${getTypeColor(evt.type)}`}
                                    />
                                ))}
                                {dayEvents.length > 4 && <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>
      )}
      
      {/* Event List (Filtered or Full) */}
      <div className="flex-1 overflow-y-auto min-h-[200px]">
         {viewMode === 'calendar' && (
             <div className="mb-3 px-1 flex items-center text-sm text-gray-500 font-medium border-b pb-2">
                 {selectedDateStr} 的日程 ({displayedEvents.length})
             </div>
         )}

         <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-4">
            {displayedEvents.length === 0 && (
                <p className="ml-6 text-gray-400 text-sm py-4">暂无记录</p>
            )}
            {displayedEvents.map((event) => (
            <div key={event.id} className="relative ml-6 group">
                <span className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white ${getTypeColor(event.type)} ring-2 ring-gray-100`}></span>
                
                <div className="flex justify-between items-start">
                    <div>
                         {viewMode === 'list' && <span className="text-sm text-gray-500 font-mono mb-1 block">{event.date}</span>}
                         <h4 className="text-base font-semibold text-gray-900">{event.title}</h4>
                         <p className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">{getTypeLabel(event.type)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${event.completed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'} w-fit`}>
                            {event.completed ? '已完成' : '计划中'}
                        </span>
                        
                        {onUpdateEvent && (
                            <button 
                                onClick={() => openSideEffectModal(event)}
                                className="text-xs text-medical-600 hover:bg-medical-50 px-2 py-1 rounded border border-medical-100 flex items-center transition-colors"
                            >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                记录不良反应
                            </button>
                        )}
                    </div>
                </div>
                
                {/* Dosage Display */}
                {event.dosageDetails && (
                    <div className="mt-2 text-xs bg-blue-50 text-blue-700 p-2 rounded border border-blue-100 font-mono">
                        <span className="font-bold mr-1">用药剂量:</span>
                        {event.dosageDetails}
                    </div>
                )}
                
                {event.description && (
                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded border border-gray-100 whitespace-pre-line">
                        {event.description}
                    </p>
                )}

                {/* Side Effects Display */}
                {event.sideEffects && event.sideEffects.length > 0 && (
                    <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
                        <h5 className="text-xs font-bold text-red-800 mb-2 flex items-center">
                             <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                             已记录症状 & 建议
                        </h5>
                        <div className="space-y-2">
                            {event.sideEffects.map((effect, idx) => {
                                const details = COMMON_SIDE_EFFECTS[effect];
                                return (
                                    <div key={idx} className="text-xs border-l-2 border-red-200 pl-2 py-1">
                                        <div className="font-bold text-gray-800">{effect}</div>
                                        {details ? (
                                            <div className="mt-1 text-gray-600">
                                                <div className="flex gap-1 mb-0.5">
                                                    <span className="text-red-400 font-bold">Rx:</span>
                                                    <span className="truncate">{details.medications.slice(0, 2).join(', ')}...</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500">请咨询医生。</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};
