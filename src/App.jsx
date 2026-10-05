import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, Clock, Save, RefreshCw, CheckSquare, Square, LogIn, 
  RotateCcw, Plus, X, Calendar, Settings, Trash2, Edit3, FileText, Info 
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// YYYY-MM-DD 포맷 변환 헬퍼
const formatDateToISO = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// 시작일~종료일 사이의 날짜 목록 생성 (최대 14일)
const generateDateList = (startDateStr, endDateStr) => {
  if (!startDateStr || !endDateStr) return [];
  const result = [];
  let current = new Date(startDateStr);
  const end = new Date(endDateStr);

  let count = 0;
  while (current <= end && count < 14) {
    const iso = formatDateToISO(current);
    const dayName = DAY_NAMES[current.getDay()];
    const month = current.getMonth() + 1;
    const dateNum = current.getDate();
    result.push({
      iso,
      dayName,
      dateShort: `${month}/${dateNum}`
    });
    current.setDate(current.getDate() + 1);
    count++;
  }
  return result;
};

// 시작시간~종료시간 타임 슬롯 생성 (30분 단위)
const generateTimeSlots = (startHour, endHour) => {
  const slots = [];
  const start = parseInt(startHour, 10);
  const end = parseInt(endHour, 10);

  for (let h = start; h < end; h++) {
    const hourStr = String(h).padStart(2, '0');
    slots.push(`${hourStr}:00`);
    slots.push(`${hourStr}:30`);
  }
  return slots;
};

export default function App() {
  const [userName, setUserName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 탭 목록 & 현재 활성 탭
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);

  // 현재 탭의 일정 데이터
  const [schedules, setSchedules] = useState([]);
  const [mySlots, setMySlots] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // 모달 창 State (생성 & 수정 겸용)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null); // null이면 생성, 문자열이면 수정
  const [newTitle, setNewTitle] = useState('발방 레이드');
  const [newDescription, setNewDescription] = useState('매주 목요일 보스 일정 조율');
  const [startDate, setStartDate] = useState(formatDateToISO(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return formatDateToISO(d);
  });
  const [startHour, setStartHour] = useState(0);
  const [endHour, setEndHour] = useState(24);

  // 드래그 및 범주 선택 State
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(true);
  const [lastSelectedSlot, setLastSelectedSlot] = useState(null);
  const isMouseDown = useRef(false);

  const fetchTabs = async () => {
    try {
      const { data, error } = await supabase
        .from('boss_tabs')
        .select('*')
        .order('created_at', { ascending: true });

      if (error && error.code !== 'PGRST116') {
        console.warn('boss_tabs 테이블 사용 불가 - 메모리 모드로 동작:', error.message);
      } else if (data && data.length > 0) {
        setTabs(data);
        if (!activeTabId) {
          setActiveTabId(data[0].id);
        }
        return;
      }
    } catch (e) {
      console.error('Fetch tabs error:', e);
    }

    // 기본 탭 설정
    const defaultTab = {
      id: 'default-tab-1',
      title: '주간 레이드',
      description: '파티원 가능 시간 조사',
      start_date: formatDateToISO(new Date()),
      end_date: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 6);
        return formatDateToISO(d);
      })(),
      start_hour: 0,
      end_hour: 24
    };
    setTabs([defaultTab]);
    setActiveTabId(defaultTab.id);
  };

  const fetchSchedules = async (tabId) => {
    if (!tabId) return;
    try {
      const { data, error } = await supabase
        .from('boss_schedules')
        .select('*')
        .eq('tab_id', tabId);

      if (error) {
        console.error('Error fetching schedules:', error);
      } else if (data) {
        setSchedules(data);
        if (userName) {
          const myData = data.find((s) => s.user_name === userName);
          if (myData) setMySlots(myData.slots || []);
          else setMySlots([]);
        }
        setSelectedUsers(data.map((s) => s.user_name));
      }
    } catch (err) {
      console.error('Fetch schedules catch:', err);
    }
  };

  useEffect(() => {
    fetchTabs();
  }, []);

  useEffect(() => {
    if (activeTabId) {
      fetchSchedules(activeTabId);
    }
  }, [activeTabId, userName]);

  // 현재 활성화된 탭 개체
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || {};
  const dateList = activeTab?.start_date ? generateDateList(activeTab.start_date, activeTab.end_date) : [];
  const timeSlots = activeTab ? generateTimeSlots(activeTab.start_hour || 0, activeTab.end_hour || 24) : [];

  const handleLogin = (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    setIsLoggedIn(true);
    const myData = schedules.find((s) => s.user_name === userName);
    if (myData) {
      setMySlots(myData.slots || []);
    } else {
      setMySlots([]);
    }
    if (!selectedUsers.includes(userName)) {
      setSelectedUsers([...selectedUsers, userName]);
    }
  };

  const handleSave = async () => {
    if (!userName || !activeTabId) return;
    try {
      const existing = schedules.find((s) => s.user_name === userName);

      if (existing) {
        await supabase
          .from('boss_schedules')
          .update({ slots: mySlots })
          .eq('tab_id', activeTabId)
          .eq('user_name', userName);
      } else {
        await supabase
          .from('boss_schedules')
          .insert([{ tab_id: activeTabId, user_name: userName, slots: mySlots }]);
      }
      alert('일정이 성공적으로 저장되었습니다!');
      fetchSchedules(activeTabId);
    } catch (err) {
      console.error('Save error:', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const openCreateModal = () => {
    setEditingTabId(null);
    setNewTitle('신규 레이드 시간표');
    setNewDescription('참여 가능 시간을 클릭해 주세요.');
    setStartDate(formatDateToISO(new Date()));
    const d = new Date();
    d.setDate(d.getDate() + 6);
    setEndDate(formatDateToISO(d));
    setStartHour(0);
    setEndHour(24);
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!activeTab) return;
    setEditingTabId(activeTab.id);
    setNewTitle(activeTab.title || '');
    setNewDescription(activeTab.description || '');
    setStartDate(activeTab.start_date || formatDateToISO(new Date()));
    setEndDate(activeTab.end_date || formatDateToISO(new Date()));
    setStartHour(activeTab.start_hour ?? 0);
    setEndHour(activeTab.end_hour ?? 24);
    setIsModalOpen(true);
  };

  const handleSaveTabModal = async (e) => {
    e.preventDefault();

    if (editingTabId) {
      // 1. 탭 정보 업데이트
      const updatedTabObj = {
        id: editingTabId,
        title: newTitle || '시간표',
        description: newDescription || '',
        start_date: startDate,
        end_date: endDate,
        start_hour: parseInt(startHour, 10),
        end_hour: parseInt(endHour, 10)
      };

      try {
        await supabase.from('boss_tabs').update(updatedTabObj).eq('id', editingTabId);
      } catch (err) {
        console.warn('Supabase update tab fail:', err);
      }

      setTabs((prev) => prev.map((t) => (t.id === editingTabId ? updatedTabObj : t)));

      // 2. 스마트 데이터 보존: 변경된 날짜/시간 범위 계산
      const validDates = generateDateList(startDate, endDate).map((d) => d.iso);
      const validTimes = generateTimeSlots(startHour, endHour);
      const validKeysSet = new Set();
      validDates.forEach((d) => {
        validTimes.forEach((t) => {
          validKeysSet.add(`${d}-${t}`);
        });
      });

      // 기존 유저 일정 필터링 및 DB 업데이트
      const updatedSchedules = schedules.map((s) => {
        const filteredSlots = (s.slots || []).filter((slotKey) => validKeysSet.has(slotKey));
        return { ...s, slots: filteredSlots };
      });

      setSchedules(updatedSchedules);

      // 내 슬롯도 정제
      const myFiltered = mySlots.filter((slotKey) => validKeysSet.has(slotKey));
      setMySlots(myFiltered);

      // Supabase에도 정제된 슬롯 업데이트
      for (const s of updatedSchedules) {
        try {
          await supabase
            .from('boss_schedules')
            .update({ slots: s.slots })
            .eq('tab_id', editingTabId)
            .eq('user_name', s.user_name);
        } catch (err) {
          console.warn('Filtered slot sync fail:', err);
        }
      }

      alert('시간표 설정이 수정되었습니다. (새 범위 내 기존 일정 자동 유지)');
    } else {
      // 신규 탭 추가
      const newTabObj = {
        id: `tab-${Date.now()}`,
        title: newTitle || '새 시간표',
        description: newDescription || '',
        start_date: startDate,
        end_date: endDate,
        start_hour: parseInt(startHour, 10),
        end_hour: parseInt(endHour, 10)
      };

      try {
        await supabase.from('boss_tabs').insert([newTabObj]);
      } catch (err) {
        console.warn('Supabase insert tab fail:', err);
      }

      setTabs((prev) => [...prev, newTabObj]);
      setActiveTabId(newTabObj.id);
    }

    setIsModalOpen(false);
  };

  const handleDeleteTab = async (tabId, e) => {
    if (e) e.stopPropagation();
    if (tabs.length <= 1) {
      alert('최소 하나의 시간표는 존재해야 합니다.');
      return;
    }
    if (!window.confirm('이 시간표를 정말 삭제하시겠습니까? 관련된 인원 일정 데이터도 함께 삭제됩니다.')) return;

    try {
      await supabase.from('boss_tabs').delete().eq('id', tabId);
      await supabase.from('boss_schedules').delete().eq('tab_id', tabId);
    } catch (err) {
      console.warn('Delete tab error:', err);
    }

    const filtered = tabs.filter((t) => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[0].id);
    }
  };

  const handleResetTabSchedules = async () => {
    if (!window.confirm(`⚠️ [${activeTab?.title}] 시간표의 모든 파티원 가능 시간을 초기화하시겠습니까?\n(시간표 설정은 유지됩니다.)`)) {
      return;
    }

    try {
      await supabase
        .from('boss_schedules')
        .delete()
        .eq('tab_id', activeTabId);

      setMySlots([]);
      setSchedules([]);
      alert('시간표의 모든 유저 일정이 초기화되었습니다.');
      fetchSchedules(activeTabId);
    } catch (err) {
      console.error('초기화 에러:', err);
      alert('초기화 중 오류가 발생했습니다.');
    }
  };

  const handleSlotMouseDown = (slotKey, dateIdx, timeIdx, e) => {
    if (!isLoggedIn) return;

    if (e.shiftKey && lastSelectedSlot) {
      const startDateIdx = Math.min(lastSelectedSlot.dateIdx, dateIdx);
      const endDateIdx = Math.max(lastSelectedSlot.dateIdx, dateIdx);
      const startTimeIdx = Math.min(lastSelectedSlot.timeIdx, timeIdx);
      const endTimeIdx = Math.max(lastSelectedSlot.timeIdx, timeIdx);

      const rangeSlots = [];
      for (let d = startDateIdx; d <= endDateIdx; d++) {
        for (let t = startTimeIdx; t <= endTimeIdx; t++) {
          if (dateList[d] && timeSlots[t]) {
            rangeSlots.push(`${dateList[d].iso}-${timeSlots[t]}`);
          }
        }
      }

      const allSelected = rangeSlots.every((s) => mySlots.includes(s));

      if (allSelected) {
        setMySlots((prev) => prev.filter((s) => !rangeSlots.includes(s)));
      } else {
        setMySlots((prev) => Array.from(new Set([...prev, ...rangeSlots])));
      }

      setLastSelectedSlot({ dateIdx, timeIdx });
      return;
    }

    isMouseDown.current = true;
    setIsDragging(true);
    setLastSelectedSlot({ dateIdx, timeIdx });

    const exists = mySlots.includes(slotKey);
    setDragMode(!exists);

    if (!exists) {
      setMySlots((prev) => [...prev, slotKey]);
    } else {
      setMySlots((prev) => prev.filter((s) => s !== slotKey));
    }
  };

  const handleSlotMouseEnter = (slotKey) => {
    if (!isMouseDown.current || !isLoggedIn) return;
    if (dragMode) {
      if (!mySlots.includes(slotKey)) setMySlots((prev) => [...prev, slotKey]);
    } else {
      setMySlots((prev) => prev.filter((s) => s !== slotKey));
    }
  };

  const handleMouseUp = () => {
    isMouseDown.current = false;
    setIsDragging(false);
  };

  const activeSchedules = schedules.filter((s) => selectedUsers.includes(s.user_name));
  const activeUserCount = selectedUsers.length;

  const getSlotAvailability = (slotKey) => {
    if (activeUserCount === 0) return 0;
    const availableCount = activeSchedules.filter((s) => s.slots?.includes(slotKey)).length;
    return availableCount / activeUserCount;
  };

  const getCellColor = (slotKey) => {
    const ratio = getSlotAvailability(slotKey);
    if (ratio === 0) return 'bg-white';
    if (ratio <= 0.25) return 'bg-emerald-100';
    if (ratio <= 0.5) return 'bg-emerald-300';
    if (ratio <= 0.75) return 'bg-emerald-500 text-white';
    return 'bg-emerald-700 text-white font-bold';
  };

  const toggleUserSelect = (name) => {
    if (selectedUsers.includes(name)) {
      setSelectedUsers(selectedUsers.filter((u) => u !== name));
    } else {
      setSelectedUsers([...selectedUsers, name]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6 select-none flex flex-col pb-12" onMouseUp={handleMouseUp}>
      {/* 최상단 헤더 */}
      <header className="max-w-7xl w-full mx-auto mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <Clock className="w-7 h-7 text-emerald-600" />
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">발방 시간표</h1>
            <p className="text-xs text-slate-500">원하는 시간 드래그 또는 Shift+클릭 범위 선택</p>
          </div>
        </div>

        {/* 닉네임 입력 및 저장 바 */}
        {!isLoggedIn ? (
          <form onSubmit={handleLogin} className="flex gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm w-full sm:w-auto">
            <input
              type="text"
              placeholder="캐릭터명 입력"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="px-2.5 py-1 text-xs border rounded outline-none focus:border-emerald-500 w-36"
            />
            <button type="submit" className="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-emerald-700 flex items-center gap-1 shrink-0">
              <LogIn className="w-3.5 h-3.5" /> 입장
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 bg-white p-1.5 px-3 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-700">
              접속자: <strong className="text-emerald-600">{userName}</strong>
            </span>
            <button onClick={handleSave} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-emerald-700 flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> 내 일정 저장
            </button>
          </div>
        )}
      </header>

      {/* 탭 바 영역 */}
      <div className="max-w-7xl w-full mx-auto mb-2 flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-all border-t border-x shrink-0 ${
                isActive
                  ? 'bg-white border-slate-300 text-emerald-700 font-bold border-b-2 border-b-emerald-600 shadow-sm'
                  : 'bg-slate-200/70 border-transparent text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleDeleteTab(tab.id, e)}
                  className="hover:bg-slate-300 p-0.5 rounded-full transition-colors text-slate-400 hover:text-slate-700"
                  title="탭 삭제"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* 새 시간표 추가 버튼 */}
        <button
          onClick={openCreateModal}
          className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors flex items-center gap-1 text-xs font-semibold px-2.5 shrink-0"
          title="새 시간표 추가"
        >
          <Plus className="w-4 h-4" />
          <span>새 시간표</span>
        </button>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <main className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* 좌측 메인 시간표 */}
        <div className="lg:col-span-3 bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          {/* 상단 액션 바 */}
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3 shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              * {isLoggedIn ? 'Shift + 클릭으로 직사각형 범위를 선택할 수 있습니다.' : '입장 후 가능 시간을 수정할 수 있습니다.'}
            </span>

            <div className="flex items-center gap-1.5">
              <button onClick={() => fetchSchedules(activeTabId)} className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1 px-2 py-1 rounded bg-slate-100">
                <RefreshCw className="w-3.5 h-3.5" /> 새로고침
              </button>
              
              {/* 탭 관리 버튼그룹: 수정 / 초기화 / 삭제 */}
              <button
                onClick={openEditModal}
                className="text-slate-700 hover:text-emerald-700 text-xs font-semibold flex items-center gap-1 bg-slate-100 hover:bg-emerald-50 px-2 py-1 rounded border border-slate-200 transition-colors"
                title="시간표 설정 수정"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-600" /> 설정 수정
              </button>

              <button
                onClick={handleResetTabSchedules}
                className="text-amber-700 hover:text-amber-900 text-xs font-semibold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 transition-colors"
                title="현재 시간표 유저 선택 데이터만 초기화"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 일정 초기화
              </button>

              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleDeleteTab(activeTabId, e)}
                  className="text-red-600 hover:text-red-800 text-xs font-semibold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors"
                  title="현재 시간표 탭 전체 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 탭 삭제
                </button>
              )}
            </div>
          </div>

          {/* 시간표 그리드 */}
          <div className="flex flex-col w-full overflow-x-auto">
            {/* 요일 헤더 */}
            <div
              className="grid gap-1 mb-1.5 text-center text-xs font-semibold text-slate-600 min-w-[500px]"
              style={{ gridTemplateColumns: `70px repeat(${dateList.length}, minmax(0, 1fr))` }}
            >
              <div className="py-1 bg-slate-100 rounded text-slate-500 flex items-center justify-center text-[11px]">
                시간 \ 날짜
              </div>
              {dateList.map((item) => (
                <div key={item.iso} className="py-1 bg-slate-100 rounded flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-slate-800">{item.dayName}</span>
                  <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">{item.dateShort}</span>
                </div>
              ))}
            </div>

            {/* 타임 슬롯 리스트 */}
            <div className="space-y-[1px] min-w-[500px]">
              {timeSlots.map((time, timeIdx) => {
                const isHour = time.endsWith(':00');

                return (
                  <div
                    key={time}
                    className="grid gap-1 w-full h-6 items-center"
                    style={{ gridTemplateColumns: `70px repeat(${dateList.length}, minmax(0, 1fr))` }}
                  >
                    <div
                      className={`h-full text-slate-500 font-mono flex items-center justify-center text-[10px] bg-slate-50 rounded ${
                        isHour ? 'font-bold text-slate-800 bg-slate-100' : ''
                      }`}
                    >
                      {time}
                    </div>

                    {dateList.map((dateItem, dateIdx) => {
                      const slotKey = `${dateItem.iso}-${time}`;
                      const isMySelected = mySlots.includes(slotKey);
                      const cellColor = getCellColor(slotKey);

                      return (
                        <div
                          key={slotKey}
                          onMouseDown={(e) => handleSlotMouseDown(slotKey, dateIdx, timeIdx, e)}
                          onMouseEnter={() => handleSlotMouseEnter(slotKey)}
                          className={`h-full rounded-[2px] transition-colors cursor-pointer flex items-center justify-center ${cellColor} ${
                            isMySelected ? 'ring-1 ring-emerald-600 z-10' : ''
                          } ${
                            isHour ? 'border-t-2 border-t-slate-300' : 'border-t border-t-slate-100'
                          }`}
                        ></div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측 사이드바 (탭 제목, 설명 및 파티원 필터) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:sticky lg:top-4 space-y-4">
          {/* 탭 헤더 정보 (상단 크게 표시) */}
          <div className="border-b border-slate-100 pb-3">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">
              Active Schedule
            </span>
            <h2 className="text-lg font-black text-slate-800 mt-1 leading-snug">
              {activeTab?.title || '시간표'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">
              {activeTab?.description || '설명이 없습니다.'}
            </p>
          </div>

          {/* 파티원 필터 목록 */}
          <div>
            <div className="shrink-0 mb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" /> 파티원 필터
              </h3>
              <span className="text-[10px] text-slate-400">
                선택인원: {selectedUsers.length}/{schedules.length}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {schedules.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded border border-dashed border-slate-200">
                  등록된 파티원이 없습니다.
                </p>
              ) : (
                schedules.map((s) => {
                  const isSelected = selectedUsers.includes(s.user_name);
                  return (
                    <div
                      key={s.user_name}
                      onClick={() => toggleUserSelect(s.user_name)}
                      className="flex items-center justify-between p-2 rounded hover:bg-slate-50 cursor-pointer border border-slate-100 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={`${isSelected ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
                          {s.user_name}
                        </span>
                      </div>
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">
                        {s.slots?.length || 0}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 시간표 생성 및 수정 설정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" /> 
                {editingTabId ? '시간표 설정 수정' : '새 시간표 설정'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTabModal} className="space-y-3.5">
              {/* 시간표 제목 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">시간표 이름</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 10월 2주차 발방 레이드"
                  className="w-full px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* 시간표 설명 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">시간표 설명</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="예: 목요일~수요일 보스 조율용입니다."
                  className="w-full px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              {/* 시작날짜 / 종료날짜 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">시작 날짜</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">종료 날짜</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* 시작시간 / 종료시간 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">시작 시간</label>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">종료 시간</label>
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow"
                >
                  {editingTabId ? '수정사항 저장' : '시간표 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}