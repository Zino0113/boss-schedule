import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Users, Clock, Save, RefreshCw, CheckSquare, Square, LogIn, 
  RotateCcw, Plus, X, Calendar, Settings, Trash2, Edit3, Sun, Moon, MoonStar
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

// 날짜에 일수 더하기 헬퍼
const addDaysToISO = (isoStr, days) => {
  if (!isoStr) return isoStr;
  const d = new Date(isoStr);
  d.setDate(d.getDate() + days);
  return formatDateToISO(d);
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

// 시작 시각(기본 9시)부터 총 운영 시간(기본 24시간) 동안의 타임 슬롯 생성
const generateTimeSlotsEx = (startHour = 9, durationHours = 24) => {
  const slots = [];
  const start = parseInt(startHour, 10);
  const count = parseInt(durationHours, 10);

  for (let i = 0; i < count; i++) {
    const rawHour = start + i;
    const actualHour = rawHour % 24;
    const dayOffset = Math.floor(rawHour / 24);
    const hourStr = String(actualHour).padStart(2, '0');

    slots.push({
      time: `${hourStr}:00`,
      displayTime: `${hourStr}:00`,
      dayOffset,
      actualHour,
      isMidnight: actualHour === 0 && i > 0,
      isHour: true
    });
    slots.push({
      time: `${hourStr}:30`,
      displayTime: `${hourStr}:30`,
      dayOffset,
      actualHour,
      isMidnight: false,
      isHour: false
    });
  }
  return slots;
};

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const [userName, setUserName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 탭 목록 & 현재 활성 탭
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);

  // 현재 탭의 일정 데이터
  const [schedules, setSchedules] = useState([]);
  const [mySlots, setMySlots] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // 모달 창 State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null);
  const [newTitle, setNewTitle] = useState('발방 레이드');
  const [newDescription, setNewDescription] = useState('매주 목요일 보스 일정 조율');
  const [startDate, setStartDate] = useState(formatDateToISO(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return formatDateToISO(d);
  });
  const [startHour, setStartHour] = useState(9); // 기본 09:00 시작
  const [durationHours, setDurationHours] = useState(24); // 기본 24시간 기준

  // 드래그 및 범주 선택 State
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(true);
  const [lastSelectedSlot, setLastSelectedSlot] = useState(null);
  const isMouseDown = useRef(false);

  // 다크모드 토글 및 저장
  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const fetchTabs = async () => {
    try {
      const { data, error } = await supabase
        .from('boss_tabs')
        .select('*')
        .order('created_at', { ascending: true });

      if (error && error.code !== 'PGRST116') {
        console.warn('boss_tabs 테이블 조회 경고:', error.message);
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

    // 기본 탭 설정 (09:00 시작 ~ 24시간)
    const defaultTab = {
      id: 'default-tab-1',
      title: '주간 레이드',
      description: '파티원 가능 시간 조사 (09:00 ~ 다음날 09:00)',
      start_date: formatDateToISO(new Date()),
      end_date: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 6);
        return formatDateToISO(d);
      })(),
      start_hour: 9,
      duration_hours: 24
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
  const timeSlots = generateTimeSlotsEx(
    activeTab.start_hour ?? 9,
    activeTab.duration_hours ?? 24
  );

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
      const { data: existingList, error: selectError } = await supabase
        .from('boss_schedules')
        .select('id')
        .eq('tab_id', activeTabId)
        .eq('user_name', userName);

      if (selectError) {
        console.error('Select schedule error:', selectError);
      }

      if (existingList && existingList.length > 0) {
        const targetId = existingList[0].id;
        const { error: updateError } = await supabase
          .from('boss_schedules')
          .update({ slots: mySlots })
          .eq('id', targetId);

        if (updateError) throw updateError;

        if (existingList.length > 1) {
          const duplicateIds = existingList.slice(1).map((item) => item.id);
          await supabase.from('boss_schedules').delete().in('id', duplicateIds);
        }
      } else {
        const { error: insertError } = await supabase
          .from('boss_schedules')
          .insert([{ tab_id: activeTabId, user_name: userName, slots: mySlots }]);

        if (insertError) throw insertError;
      }

      alert('일정이 성공적으로 저장되었습니다!');
      fetchSchedules(activeTabId);
    } catch (err) {
      console.error('Save error:', err);
      alert(`저장 실패: ${err.message || '저장 중 오류가 발생했습니다.'}`);
    }
  };

  const openCreateModal = () => {
    setEditingTabId(null);
    setNewTitle('신규 레이드 시간표');
    setNewDescription('참여 가능 시간을 선택해 주세요.');
    setStartDate(formatDateToISO(new Date()));
    const d = new Date();
    d.setDate(d.getDate() + 6);
    setEndDate(formatDateToISO(d));
    setStartHour(9);
    setDurationHours(24);
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!activeTab) return;
    setEditingTabId(activeTab.id);
    setNewTitle(activeTab.title || '');
    setNewDescription(activeTab.description || '');
    setStartDate(activeTab.start_date || formatDateToISO(new Date()));
    setEndDate(activeTab.end_date || formatDateToISO(new Date()));
    setStartHour(activeTab.start_hour ?? 9);
    setDurationHours(activeTab.duration_hours ?? 24);
    setIsModalOpen(true);
  };

  const handleSaveTabModal = async (e) => {
    e.preventDefault();

    const startH = parseInt(startHour, 10);
    const durH = parseInt(durationHours, 10);

    if (editingTabId) {
      const updatedTabObj = {
        id: editingTabId,
        title: newTitle || '시간표',
        description: newDescription || '',
        start_date: startDate,
        end_date: endDate,
        start_hour: startH,
        duration_hours: durH
      };

      try {
        await supabase.from('boss_tabs').update(updatedTabObj).eq('id', editingTabId);
      } catch (err) {
        console.warn('Supabase update tab fail:', err);
      }

      setTabs((prev) => prev.map((t) => (t.id === editingTabId ? updatedTabObj : t)));

      // 변경된 범위 계산 및 유효 슬롯 필터링
      const newDates = generateDateList(startDate, endDate);
      const newSlotsEx = generateTimeSlotsEx(startH, durH);
      const validKeysSet = new Set();

      newDates.forEach((d) => {
        newSlotsEx.forEach((slot) => {
          const actualDate = slot.dayOffset > 0 ? addDaysToISO(d.iso, slot.dayOffset) : d.iso;
          validKeysSet.add(`${actualDate}-${slot.time}`);
        });
      });

      const updatedSchedules = schedules.map((s) => {
        const filteredSlots = (s.slots || []).filter((slotKey) => validKeysSet.has(slotKey));
        return { ...s, slots: filteredSlots };
      });

      setSchedules(updatedSchedules);

      const myFiltered = mySlots.filter((slotKey) => validKeysSet.has(slotKey));
      setMySlots(myFiltered);

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

      alert('시간표 설정이 수정되었습니다. (범위 내 기존 일정 유지)');
    } else {
      const newTabObj = {
        id: `tab-${Date.now()}`,
        title: newTitle || '새 시간표',
        description: newDescription || '',
        start_date: startDate,
        end_date: endDate,
        start_hour: startH,
        duration_hours: durH
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
    if (!window.confirm('이 시간표를 정말 삭제하시겠습니까? 관련 데이터도 모두 삭제됩니다.')) return;

    try {
      const { error: schedErr } = await supabase.from('boss_schedules').delete().eq('tab_id', tabId);
      if (schedErr) console.warn('Delete schedules warn:', schedErr.message);

      const { error: tabErr } = await supabase.from('boss_tabs').delete().eq('id', tabId);
      if (tabErr) throw tabErr;
    } catch (err) {
      console.warn('Delete tab error:', err);
      alert(`삭제 실패: ${err.message || '오류가 발생했습니다.'}`);
      return;
    }

    const filtered = tabs.filter((t) => t.id !== tabId);
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[0].id);
    }
  };

  const handleResetTabSchedules = async () => {
    if (!window.confirm(`⚠️ [${activeTab?.title}] 시간표의 모든 파티원 가능 시간 및 참여자 목록을 초기화하시겠습니까?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('boss_schedules')
        .delete()
        .eq('tab_id', activeTabId);

      if (error) throw error;

      setMySlots([]);
      setSchedules([]);
      setSelectedUsers([]);
      alert('시간표의 모든 유저 일정 및 참여자 목록이 초기화되었습니다.');
    } catch (err) {
      console.error('초기화 에러:', err);
      alert(`초기화 실패: ${err.message || 'DB 삭제 중 오류가 발생했습니다.'}`);
    }
  };

  const handleDeleteUser = async (targetUserName, e) => {
    e.stopPropagation();
    if (!window.confirm(`'${targetUserName}' 파티원의 일정을 이 시간표에서 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('boss_schedules')
        .delete()
        .eq('tab_id', activeTabId)
        .eq('user_name', targetUserName);

      if (error) throw error;

      setSchedules((prev) => prev.filter((s) => s.user_name !== targetUserName));
      setSelectedUsers((prev) => prev.filter((u) => u !== targetUserName));
      if (targetUserName === userName) {
        setMySlots([]);
      }
    } catch (err) {
      console.error('User delete error:', err);
      alert(`삭제 실패: ${err.message || 'DB 삭제 중 오류가 발생했습니다.'}`);
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
            const slotObj = timeSlots[t];
            const baseDateIso = dateList[d].iso;
            const actualDateIso = slotObj.dayOffset > 0 ? addDaysToISO(baseDateIso, slotObj.dayOffset) : baseDateIso;
            rangeSlots.push(`${actualDateIso}-${slotObj.time}`);
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
    if (ratio === 0) return darkMode ? 'bg-slate-900' : 'bg-white';
    if (ratio <= 0.25) return darkMode ? 'bg-emerald-950/70 text-emerald-300' : 'bg-emerald-100 text-emerald-900';
    if (ratio <= 0.5) return darkMode ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-300 text-slate-900';
    if (ratio <= 0.75) return 'bg-emerald-500 text-white font-medium';
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
    <div className={`${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'} min-h-screen p-3 md:p-6 select-none flex flex-col pb-12 transition-colors duration-200`} onMouseUp={handleMouseUp}>
      {/* 최상단 헤더 */}
      <header className="max-w-7xl w-full mx-auto mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <Clock className="w-7 h-7 text-emerald-500" />
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
              발방 시간표
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">원하는 시간 드래그 또는 Shift+클릭 범위 선택</p>
          </div>
        </div>

        {/* 다크모드 토글 및 닉네임 바 */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title={darkMode ? '라이트 모드로 변경' : '다크 모드로 변경'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {!isLoggedIn ? (
            <form onSubmit={handleLogin} className="flex gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm w-full sm:w-auto">
              <input
                type="text"
                placeholder="캐릭터명 입력"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="px-2.5 py-1 text-xs border dark:border-slate-700 rounded outline-none focus:border-emerald-500 bg-transparent w-36"
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-medium flex items-center gap-1 shrink-0 transition-colors">
                <LogIn className="w-3.5 h-3.5" /> 입장
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                접속자: <strong className="text-emerald-500">{userName}</strong>
              </span>
              <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors">
                <Save className="w-3.5 h-3.5" /> 내 일정 저장
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 탭 바 영역 */}
      <div className="max-w-7xl w-full mx-auto mb-2 flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-all border-t border-x shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-bold border-b-2 border-b-emerald-500 shadow-sm'
                  : 'bg-slate-200/70 dark:bg-slate-800/60 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleDeleteTab(tab.id, e)}
                  className="hover:bg-slate-300 dark:hover:bg-slate-700 p-0.5 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
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
          className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 transition-colors flex items-center gap-1 text-xs font-semibold px-2.5 shrink-0"
          title="새 시간표 추가"
        >
          <Plus className="w-4 h-4" />
          <span>새 시간표</span>
        </button>
      </div>

      {}
      {/* 메인 콘텐츠 영역 */}
      <main className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* 좌측 메인 시간표 */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
          {/* 상단 액션 바 */}
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3 shrink-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              * {isLoggedIn ? 'Shift + 클릭으로 직사각형 범위를 선택할 수 있습니다.' : '입장 후 가능 시간을 수정할 수 있습니다.'}
            </span>

            <div className="flex items-center gap-1.5">
              <button onClick={() => fetchSchedules(activeTabId)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> 새로고침
              </button>
              
              <button
                onClick={openEditModal}
                className="text-slate-700 dark:text-slate-300 hover:text-emerald-600 text-xs font-semibold flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                title="시간표 설정 수정"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-500" /> 설정 수정
              </button>

              <button
                onClick={handleResetTabSchedules}
                className="text-amber-700 dark:text-amber-400 hover:text-amber-900 text-xs font-semibold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2 py-1 rounded border border-amber-200 dark:border-amber-800 transition-colors"
                title="현재 시간표 유저 선택 및 목록 초기화"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 일정 초기화
              </button>

              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleDeleteTab(activeTabId, e)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 text-xs font-semibold flex items-center gap-1 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 px-2 py-1 rounded border border-red-200 dark:border-red-800 transition-colors"
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
              className="grid gap-1 mb-1.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 min-w-[500px]"
              style={{ gridTemplateColumns: `80px repeat(${dateList.length}, minmax(0, 1fr))` }}
            >
              <div className="py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 dark:text-slate-400 flex items-center justify-center text-[11px]">
                시간 \ 날짜
              </div>
              {dateList.map((item) => (
                <div key={item.iso} className="py-1 bg-slate-100 dark:bg-slate-800 rounded flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.dayName}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-none mt-0.5">{item.dateShort}</span>
                </div>
              ))}
            </div>

            {/* 타임 슬롯 리스트 */}
            <div className="space-y-[1px] min-w-[500px]">
              {timeSlots.map((slotObj, timeIdx) => {
                const { time, isHour, isMidnight, dayOffset } = slotObj;

                return (
                  <div
                    key={`${timeIdx}-${time}`}
                    className="grid gap-1 w-full h-6 items-center"
                    style={{ gridTemplateColumns: `80px repeat(${dateList.length}, minmax(0, 1fr))` }}
                  >
                    {/* 시간 축 피드백 */}
                    <div
                      className={`h-full font-mono flex items-center justify-center text-[10px] rounded px-1 transition-colors ${
                        isMidnight
                          ? 'bg-purple-900/40 dark:bg-purple-950 text-purple-300 font-extrabold border border-purple-500/50'
                          : isHour
                          ? 'font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800'
                          : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60'
                      }`}
                    >
                      {isMidnight ? (
                        <span className="flex items-center gap-0.5 text-[9px] text-purple-400 dark:text-purple-300">
                          <MoonStar className="w-3 h-3 text-purple-400 shrink-0" />
                          00:00 (+1d)
                        </span>
                      ) : (
                        time
                      )}
                    </div>

                    {dateList.map((dateItem, dateIdx) => {
                      // 실제 저장될 ISO 날짜 계산 (자정을 넘어선 새벽 시간대일 경우 다음날로 마핑)
                      const actualSlotDate = dayOffset > 0 ? addDaysToISO(dateItem.iso, dayOffset) : dateItem.iso;
                      const slotKey = `${actualSlotDate}-${time}`;
                      const isMySelected = mySlots.includes(slotKey);
                      const cellColor = getCellColor(slotKey);

                      return (
                        <div
                          key={slotKey}
                          onMouseDown={(e) => handleSlotMouseDown(slotKey, dateIdx, timeIdx, e)}
                          onMouseEnter={() => handleSlotMouseEnter(slotKey)}
                          className={`h-full rounded-[2px] transition-colors cursor-pointer flex items-center justify-center ${cellColor} ${
                            isMySelected ? 'ring-1 ring-emerald-500 z-10' : ''
                          } ${
                            isMidnight
                              ? 'border-t-2 border-t-purple-500 dark:border-t-purple-400 border-slate-200 dark:border-slate-800'
                              : isHour
                              ? 'border-t-2 border-t-slate-400 dark:border-t-slate-600 border-slate-200 dark:border-slate-800'
                              : 'border-t border-t-slate-100 dark:border-t-slate-800/60'
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

        {}
        {/* 우측 사이드바 (탭 제목, 설명 및 파티원 필터) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col lg:sticky lg:top-4 space-y-4">
          {/* 탭 헤더 정보 */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded">
              Active Schedule
            </span>
            <h2 className="text-lg font-black mt-1 leading-snug">
              {activeTab?.title || '시간표'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap leading-relaxed">
              {activeTab?.description || '설명이 없습니다.'}
            </p>
          </div>

          {/* 파티원 필터 및 관리 목록 */}
          <div>
            <div className="shrink-0 mb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-500" /> 파티원 필터
              </h3>
              <span className="text-[10px] text-slate-400">
                선택인원: {selectedUsers.length}/{schedules.length}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {schedules.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center bg-slate-50 dark:bg-slate-950/40 rounded border border-dashed border-slate-200 dark:border-slate-800">
                  등록된 파티원이 없습니다.
                </p>
              ) : (
                schedules.map((s) => {
                  const isSelected = selectedUsers.includes(s.user_name);
                  return (
                    <div
                      key={s.user_name}
                      onClick={() => toggleUserSelect(s.user_name)}
                      className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer border border-slate-100 dark:border-slate-800/80 text-xs transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        )}
                        <span className={`${isSelected ? 'font-medium' : 'text-slate-400'}`}>
                          {s.user_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-mono">
                          {s.slots?.length || 0}
                        </span>
                        <button
                          onClick={(e) => handleDeleteUser(s.user_name, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded transition-all text-slate-400"
                          title="파티원 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {}
      {/* 시간표 생성 및 수정 설정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-800 dark:text-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-500" /> 
                {editingTabId ? '시간표 설정 수정' : '새 시간표 설정'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTabModal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">시간표 이름</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 10월 2주차 발방 레이드"
                  className="w-full px-3 py-1.5 text-xs border dark:border-slate-700 bg-transparent rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">시간표 설명</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="예: 목요일~수요일 보스 조율용입니다."
                  className="w-full px-3 py-1.5 text-xs border dark:border-slate-700 bg-transparent rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">시작 날짜</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border dark:border-slate-700 bg-transparent rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">종료 날짜</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border dark:border-slate-700 bg-transparent rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">일일 시작 시각</label>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value={9}>09:00 (발방 기준)</option>
                    <option value={6}>06:00 (일반인 기준)</option>
                    <option value={0}>00:00 (자정 기준)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">하루 표기 범위</label>
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value={24}>24시간 (전일 표시)</option>
                    <option value={18}>18시간</option>
                    <option value={12}>12시간</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow transition-colors"
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