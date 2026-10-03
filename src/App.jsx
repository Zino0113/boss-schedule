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
  
  // 드래그 선택 관련 State
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(true); // true: 추가, false: 제거
  const isMouseDown = useRef(false);

  // 1. Supabase에서 모든 유저의 일정 불러오기
  const fetchSchedules = async () => {
    const { data, error } = await supabase.from('boss_schedules').select('*');
    if (error) {
      console.error('Error fetching schedules:', error);
    } else if (data) {
      setSchedules(data);
      // 로그인되어 있다면 내 기존 데이터 로드
      if (userName) {
        const myData = data.find((s) => s.user_name === userName);
        if (myData) setMySlots(myData.slots || []);
      }
      // 처음 로드 시 전원 선택 처리
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

  // 4. 전체 일정 초기화 (매주 리셋용)
  const handleResetAll = async () => {
    if (!window.confirm('⚠️ 이번 주 모든 파티원의 일정을 정말로 초기화하시겠습니까?\n(이 작업은 되돌릴 수 없습니다.)')) {
      return;
    }

    try {
      // DB의 모든 유저 slots를 빈 배열로 업데이트
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

  // 5. 드래그로 셀 선택
  const handleSlotMouseDown = (slotKey) => {
    if (!isLoggedIn) return;
    isMouseDown.current = true;
    setIsDragging(true);
    const exists = mySlots.includes(slotKey);
    setDragMode(!exists); // 없으면 추가 모드, 있으면 제거 모드

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
    return availableCount / activeUserCount; // 0 ~ 1 비율
  };

  const getCellColor = (slotKey) => {
    const ratio = getSlotAvailability(slotKey);
    if (ratio === 0) return 'bg-white';
    if (ratio <= 0.25) return 'bg-emerald-100';
    if (ratio <= 0.5) return 'bg-emerald-300';
    if (ratio <= 0.75) return 'bg-emerald-500 text-white';
    return 'bg-emerald-700 text-white font-bold'; // 전원 가능
  };

  const toggleUserSelect = (name) => {
    if (selectedUsers.includes(name)) {
      setSelectedUsers(selectedUsers.filter((u) => u !== name));
    } else {
      setSelectedUsers([...selectedUsers, name]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 select-none" onMouseUp={handleMouseUp}>
      <header className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-7 h-7 text-emerald-600" /> 보스 레이드 일정 조율기
          </h1>
          <p className="text-sm text-slate-500">When2Meet + 파티원 선택 필터 기능</p>
        </div>

        {/* 닉네임 입력 및 저장 바 */}
        {!isLoggedIn ? (
          <form onSubmit={handleLogin} className="flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
            <input
              type="text"
              placeholder="내 캐릭터명/이름"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded outline-none focus:border-emerald-500"
            />
            <button type="submit" className="bg-emerald-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-emerald-700 flex items-center gap-1">
              <LogIn className="w-4 h-4" /> 입장
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-lg shadow-sm border border-slate-200">
            <span className="text-sm font-medium text-slate-700">
              접속자: <strong className="text-emerald-600">{userName}</strong>
            </span>
            <button onClick={handleSave} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-emerald-700 flex items-center gap-1">
              <Save className="w-4 h-4" /> 내 일정 저장
            </button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 시간표 메인 영역 */}
        <div className="lg:col-span-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs text-slate-500">
              * {isLoggedIn ? '표를 드래그해서 가능한 시간을 선택하세요.' : '입장 후 가능 시간을 수정할 수 있습니다.'}
            </span>
            
            <div className="flex items-center gap-3">
              <button onClick={fetchSchedules} className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> 새로고침
              </button>
              <button 
                onClick={handleResetAll} 
                className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded border border-red-100 transition-colors"
                title="매주 목요일 초기화용"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 이번 주 일정 전체 초기화
              </button>
            </div>
          </div>

          <div className="min-w-[500px]">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-8 gap-1 mb-2 text-center text-xs font-semibold text-slate-600">
              <div className="py-1">시간</div>
              {DAYS.map((day) => (
                <div key={day} className="py-1 bg-slate-100 rounded">{day}</div>
              ))}
            </div>

            {/* 타임 슬롯 테이블 (00시~24시) */}
            <div className="max-h-[600px] overflow-y-auto pr-1">
              {TIMES.map((time) => {
                const isHour = time.endsWith(':00'); // 정각 구분선 확인

                return (
                  <div key={time} className="grid grid-cols-8 gap-1 mb-1 text-center text-xs">
                    <div className={`text-slate-400 font-mono flex items-center justify-center text-[11px] bg-slate-50 rounded ${isHour ? 'font-semibold text-slate-600' : ''}`}>
                      {time}
                    </div>
                    {DAYS.map((day) => {
                      const slotKey = `${day}-${time}`;
                      const isMySelected = mySlots.includes(slotKey);
                      const cellColor = getCellColor(slotKey);

                      return (
                        <div
                          key={slotKey}
                          onMouseDown={() => handleSlotMouseDown(slotKey)}
                          onMouseEnter={() => handleSlotMouseEnter(slotKey)}
                          className={`h-7 rounded border transition-colors cursor-pointer flex items-center justify-center font-mono text-[10px] ${cellColor} ${
                            isMySelected ? 'ring-2 ring-emerald-500 ring-offset-1 z-10' : ''
                          } ${
                            // 정각이면 상단 테두리를 굵게 강조!
                            isHour ? 'border-t-2 border-t-slate-400 border-slate-200' : 'border-slate-100'
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

        {/* 우측 파티원 선택 필터 사이드바 */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" /> 파티원 필터
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            체크된 파티원들 간의 겹치는 시간만 표시됩니다.
          </p>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {schedules.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">아직 등록된 파티원이 없습니다.</p>
            ) : (
              schedules.map((s) => {
                const isSelected = selectedUsers.includes(s.user_name);
                return (
                  <div
                    key={s.user_name}
                    onClick={() => toggleUserSelect(s.user_name)}
                    className="flex items-center justify-between p-2 rounded hover:bg-slate-50 cursor-pointer border border-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                      <span className={`text-sm ${isSelected ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
                        {s.user_name}
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                      {s.slots?.length || 0}개
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