import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'

// 환경 항목 정의
const ENV_ITEMS = [
  { sect: 'EI', fatr: 'TI', label: '내부온도',   unit: '°C',  color: '#e74c6f', icon: '🌡️' },
  { sect: 'EI', fatr: 'HI', label: '내부습도',   unit: '%',   color: '#3b82f6', icon: '💧' },
  { sect: 'EI', fatr: 'CI', label: '내부CO₂',   unit: 'ppm', color: '#22c55e', icon: '🌿' },
  { sect: 'EI', fatr: 'IS', label: '내부일사량', unit: 'W/㎡', color: '#f59e0b', icon: '☀️' },
]

// 딸기 스마트팜 적정 환경 기준
const OPTIMAL = {
  TI: { min: 18, max: 25, label: '적정 18~25°C' },
  HI: { min: 60, max: 80, label: '적정 60~80%' },
  CI: { min: 800, max: 1200, label: '적정 800~1200ppm' },
  IS: { min: 0,  max: 9999, label: '' },
}

export default function Environment() {
  const [selectedItem, setSelectedItem] = useState(ENV_ITEMS[0])
  const [summary, setSummary]           = useState([])
  const [sidoData, setSidoData]         = useState([])
  const [monthlyData, setMonthlyData]   = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    fetchSummary()
  }, [])

  useEffect(() => {
    fetchCharts()
  }, [selectedItem])

  async function fetchSummary() {
    const { data } = await supabase.rpc('get_env_summary')
    if (data) setSummary(data)
    setLoading(false)
  }

  async function fetchCharts() {
    setLoading(true)
    await Promise.all([fetchSido(), fetchMonthly()])
    setLoading(false)
  }

  async function fetchSido() {
    const { data } = await supabase.rpc('get_env_sido_avg', {
      p_sect_code: selectedItem.sect,
      p_fatr_code: selectedItem.fatr,
    })
    if (data) setSidoData(data.map(r => ({
      sido: r.sido,
      avg: Number(r.avg),
      cnt: Number(r.cnt),
    })))
  }

  async function fetchMonthly() {
    const { data } = await supabase.rpc('get_env_monthly_avg', {
      p_sect_code: selectedItem.sect,
      p_fatr_code: selectedItem.fatr,
    })
    if (data) setMonthlyData(data.map(r => ({
      ym: r.ym,
      avg: Number(r.avg),
    })))
  }

  const optimal = OPTIMAL[selectedItem.fatr]

  return (
    <div className="space-y-8">

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ENV_ITEMS.map(item => {
          const s = summary.find(r => r.fatr_code === item.fatr)
          const isSelected = selectedItem.fatr === item.fatr
          return (
            <div
              key={item.fatr}
              onClick={() => setSelectedItem(item)}
              className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                isSelected
                  ? 'border-2 shadow-md'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
              style={isSelected ? { borderColor: item.color, backgroundColor: item.color + '10' } : {}}
            >
              <div className="text-xl mb-1">{item.icon}</div>
              <div className="text-xs text-gray-400 mb-1">{item.label}</div>
              <div className="text-2xl font-bold text-gray-800">
                {s ? Number(s.avg).toFixed(1) : '-'}
                <span className="text-sm font-normal text-gray-400 ml-1">{item.unit}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {s ? Number(s.cnt).toLocaleString() + '건 기준' : '로딩 중'}
              </div>
              {optimal && optimal.label && item.fatr === selectedItem.fatr && (
                <div className="text-xs mt-1.5 font-medium" style={{ color: item.color }}>
                  {optimal.label}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 차트 영역 */}
      {loading ? (
        <div className="text-center text-green-500 py-12 animate-pulse">분석 중...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 시도별 평균 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-700 mb-1">
              시도별 평균 {selectedItem.label}
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              {selectedItem.unit} 기준 · 딸기 스마트팜
            </p>
            {sidoData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-300 text-sm">
                데이터 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sidoData} layout="vertical" margin={{ left: 10, right: 60 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="sido" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    formatter={(v, _, props) => [
                      `${v} ${selectedItem.unit} (${Number(props.payload.cnt).toLocaleString()}건)`,
                      selectedItem.label
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="avg" fill={selectedItem.color} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 월별 추이 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-700 mb-1">
              월별 평균 추이
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              {selectedItem.label} · {selectedItem.unit}
            </p>
            {monthlyData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-300 text-sm">
                데이터 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ym" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={v => [`${v} ${selectedItem.unit}`, selectedItem.label]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke={selectedItem.color}
                    strokeWidth={2}
                    dot={false}
                  />
                  {/* 적정 범위 표시 */}
                  {optimal && optimal.min > 0 && (
                    <>
                      <Line dataKey={() => optimal.min} stroke={selectedItem.color}
                        strokeDasharray="4 4" strokeWidth={1} dot={false}
                        legendType="none" />
                      <Line dataKey={() => optimal.max} stroke={selectedItem.color}
                        strokeDasharray="4 4" strokeWidth={1} dot={false}
                        legendType="none" />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
            {optimal && optimal.label && (
              <p className="text-xs text-gray-400 mt-2">
                점선: {optimal.label}
              </p>
            )}
          </div>

        </div>
      )}

      {/* 환경 관리 가이드 */}
      <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-green-700 mb-3">
          🌱 딸기 스마트팜 환경 관리 기준
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '내부온도', value: '18~25°C', sub: '야간 10°C 이상 유지' },
            { label: '내부습도', value: '60~80%', sub: '80% 초과 시 병해 주의' },
            { label: '내부CO₂', value: '800~1200ppm', sub: '광합성 촉진' },
            { label: '일사량', value: '충분한 광 확보', sub: '보광등 활용' },
          ].map(g => (
            <div key={g.label} className="bg-white rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-0.5">{g.label}</div>
              <div className="text-sm font-bold text-green-700">{g.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{g.sub}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
