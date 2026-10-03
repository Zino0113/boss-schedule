/* File: src/App.jsx */
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Clock, Save, RefreshCw, CheckSquare, Square, LogIn, RotateCcw } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 00시부터 24시까지 (30분 단위, 총 48개 슬롯)
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2).toString().padStart(2, '0');
  const min = i % 2 === 0 ? '00' : '30';
  return `${hour}:${min}`;
});

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export default function App() {
  const [userName, setUserName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [mySlots, setMySlots] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  
  // 드래그 및 범주 선택 (Shift + 클릭) 관련 State
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(true); // true: 추가, false: 제거
  const [lastSelectedSlot, setLastSelectedSlot] = useState(null); // { dayIdx, timeIdx }
  const isMouseDown = useRef(false);

  // 1. Supabase에서 모든 유저의 일정 불러오기
  const fetchSchedules = async () => {
    const { data, error } = await supabase.from('boss_schedules').select('*');
    if (error) {
      console.error('Error fetching schedules:', error);
    } else if (data) {
      setSchedules(data);
      if (userName) {
        const myData = data.find((s) => s.user_name === userName);
        if (myData) setMySlots(myData.slots || []);
      }
      if (selectedUsers.length === 0) {
        setSelectedUsers(data.map((s) => s.user_name));
      }
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  // 2. 입장 처리
  const handleLogin = (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    setIsLoggedIn(true);
    const myData = schedules.find((s) => s.user_name === userName);
    if (myData) {
      setMySlots(myData.slots || []);
    }
    if (!selectedUsers.includes(userName)) {
      setSelectedUsers([...selectedUsers, userName]);
    }
  };

  // 3. 내 일정 저장하기
  const handleSave = async () => {
    if (!userName) return;
    const existing = schedules.find((s) => s.user_name === userName);
    
    if (existing) {
      await supabase
        .from('boss_schedules')
        .update({ slots: mySlots })
        .eq('user_name', userName);
    } else {
      await supabase
        .from('boss_schedules')
        .insert([{ user_name: userName, slots: mySlots }]);
    }
    alert('저장 완료!');
    fetchSchedules();
  };

  // 4. 전체 일정 초기화
  const handleResetAll = async () => {
    if (!window.confirm('⚠️ 이번 주 모든 파티원의 일정을 정말로 초기화하시겠습니까?\n(이 작업은 되돌릴 수 없습니다.)')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('boss_schedules')
        .update({ slots: [] })
        .neq('user_name', '');

      if (error) throw error;

      setMySlots([]);
      alert('모든 파티원의 일정이 초기화되었습니다.');
      fetchSchedules();
    } catch (err) {
      console.error('초기화 에러:', err);
      alert('초기화 중 오류가 발생했습니다.');
    }
  };

  // 5. 셀 클릭 / 드래그 / Shift + 클릭 범위 선택 로직
  const handleSlotMouseDown = (slotKey, e) => {
    if (!isLoggedIn) return;

    const [day, time] = slotKey.split('-');
    const dayIdx = DAYS.indexOf(day);
    const timeIdx = TIMES.indexOf(time);

    // Shift 키 누른 상태에서의 사각형 범위 선택
    if (e.shiftKey && lastSelectedSlot) {
      const startDay = Math.min(lastSelectedSlot.dayIdx, dayIdx);
      const endDay = Math.max(lastSelectedSlot.dayIdx, dayIdx);
      const startTime = Math.min(lastSelectedSlot.timeIdx, timeIdx);
      const endTime = Math.max(lastSelectedSlot.timeIdx, timeIdx);

      const rangeSlots = [];
      for (let d = startDay; d <= endDay; d++) {
        for (let t = startTime; t <= endTime; t++) {
          rangeSlots.push(`${DAYS[d]}-${TIMES[t]}`);
        }
      }

      // 범위 내 모든 칸이 이미 선택되어 있으면 전체 해제, 하나라도 비어 있으면 전체 선택
      const allSelected = rangeSlots.every((s) => mySlots.includes(s));

      if (allSelected) {
        setMySlots((prev) => prev.filter((s) => !rangeSlots.includes(s)));
      } else {
        setMySlots((prev) => Array.from(new Set([...prev, ...rangeSlots])));
      }

      setLastSelectedSlot({ dayIdx, timeIdx });
      return;
    }

    // 일반 단일 클릭 및 드래그 시작
    isMouseDown.current = true;
    setIsDragging(true);
    setLastSelectedSlot({ dayIdx, timeIdx });

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

  // 6. 선택한 유저 필터링 및 색상 계산
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
    <div className="h-screen w-screen bg-slate-50 p-2 md:p-3 select-none flex flex-col overflow-hidden" onMouseUp={handleMouseUp}>
      {/* 상단 헤더 (컴팩트 바) */}
      <header className="max-w-7xl w-full mx-auto mb-2 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-bold text-slate-800">보스 레이드 일정 조율기</h1>
          <span className="hidden sm:inline text-xs text-slate-400">| 스크롤 없는 한 화면 시간표</span>
        </div>

        {/* 닉네임 입력 및 저장 */}
        {!isLoggedIn ? (
          <form onSubmit={handleLogin} className="flex gap-1.5 bg-white p-1 rounded border border-slate-200">
            <input
              type="text"
              placeholder="캐릭터명 입력"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="px-2 py-1 text-xs border rounded outline-none focus:border-emerald-500 w-32"
            />
            <button type="submit" className="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-emerald-700 flex items-center gap-1">
              <LogIn className="w-3.5 h-3.5" /> 입장
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 bg-white p-1 px-3 rounded border border-slate-200">
            <span className="text-xs font-medium text-slate-700">
              <strong className="text-emerald-600">{userName}</strong>
            </span>
            <button onClick={handleSave} className="bg-emerald-600 text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-emerald-700 flex items-center gap-1">
              <Save className="w-3.5 h-3.5" /> 내 일정 저장
            </button>
          </div>
        )}
      </header>

      {/* 메인 컨텐츠 영역 (100% 높이 맞춤) */}
      <main className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-4 gap-3 flex-1 min-h-0 overflow-hidden">
        {/* 시간표 메인 영역 */}
        <div className="lg:col-span-3 bg-white p-2.5 rounded-lg shadow-sm border border-slate-200 flex flex-col min-h-0 h-full">
          <div className="flex justify-between items-center mb-1.5 shrink-0">
            <span className="text-[11px] text-slate-500">
              * {isLoggedIn ? '드래그 또는 Shift+클릭으로 대량 범위를 한 번에 선택할 수 있습니다.' : '입장 후 시간을 수정할 수 있습니다.'}
            </span>
            
            <div className="flex items-center gap-2">
              <button onClick={fetchSchedules} className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> 새로고침
              </button>
              <button 
                onClick={handleResetAll} 
                className="text-red-500 hover:text-red-700 text-[11px] font-semibold flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-100 transition-colors"
                title="매주 초기화용"
              >
                <RotateCcw className="w-3 h-3" /> 이번 주 일정 초기화
              </button>
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0 w-full">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-8 gap-1 mb-1 text-center text-xs font-semibold text-slate-600 shrink-0">
              <div className="py-0.5">시간</div>
              {DAYS.map((day) => (
                <div key={day} className="py-0.5 bg-slate-100 rounded text-[11px]">{day}</div>
              ))}
            </div>

            {/* 48개 슬롯 그리드 (스크롤 없이 높이 비율 자동 조절) */}
            <div className="flex-1 grid grid-rows-[repeat(48,minmax(0,1fr))] gap-[1px] min-h-0 w-full">
              {TIMES.map((time) => {
                const isHour = time.endsWith(':00');

                return (
                  <div key={time} className="grid grid-cols-8 gap-1 w-full h-full items-center">
                    {/* 시간 표시 */}
                    <div className={`h-full text-slate-500 font-mono flex items-center justify-center text-[9px] bg-slate-50 rounded ${isHour ? 'font-bold text-slate-700' : ''}`}>
                      {time}
                    </div>

                    {/* 요일별 셀 */}
                    {DAYS.map((day) => {
                      const slotKey = `${day}-${time}`;
                      const isMySelected = mySlots.includes(slotKey);
                      const cellColor = getCellColor(slotKey);

                      return (
                        <div
                          key={slotKey}
                          onMouseDown={(e) => handleSlotMouseDown(slotKey, e)}
                          onMouseEnter={() => handleSlotMouseEnter(slotKey)}
                          className={`h-full rounded-[2px] transition-colors cursor-pointer flex items-center justify-center ${cellColor} ${
                            isMySelected ? 'ring-1 ring-emerald-600 z-10' : ''
                          } ${
                            isHour ? 'border-t border-t-slate-400' : 'border-t border-t-slate-100'
                          }`}
                        >
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측 파티원 필터 */}
        <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex flex-col h-full min-h-0">
          <div className="shrink-0 mb-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" /> 파티원 필터
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              체크된 멤버의 교집합 시간이 표시됩니다.
            </p>
          </div>

          <div className="space-y-1 overflow-y-auto flex-1 min-h-0 pr-1">
            {schedules.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">등록된 파티원이 없습니다.</p>
            ) : (
              schedules.map((s) => {
                const isSelected = selectedUsers.includes(s.user_name);
                return (
                  <div
                    key={s.user_name}
                    onClick={() => toggleUserSelect(s.user_name)}
                    className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-300" />
                      )}
                      <span className={`${isSelected ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
                        {s.user_name}
                      </span>
                    </div>
                    <span className="text-[9px] bg-slate-100 px-1 py-0.2 rounded text-slate-500">
                      {s.slots?.length || 0}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}