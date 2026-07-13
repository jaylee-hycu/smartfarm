import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ITEM_NAMES, SIDO_LIST } from '../lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const AREA_BUCKETS = [
  { label: '500㎡ 이하',   min: 0,    max: 500  },
  { label: '500~1000㎡',  min: 500,  max: 1000 },
  { label: '1000~2000㎡', min: 1000, max: 2000 },
  { label: '2000~5000㎡', min: 2000, max: 5000 },
  { label: '5000㎡ 이상', min: 5000, max: Infinity },
]

export default function Benchmark() {
  const [itemFilter, setItemFilter]     = useState('080400')
  const [sidoFilter, setSidoFilter]     = useState('전체')
  const [areaData, setAreaData]         = useState([])
  const [sidoAreaData, setSidoAreaData] = useState([])
  const [seasonMonths, setSeasonMonths] = useState([])
  const [loading, setLoading]           = useState(true)
  const [summary, setSummary]           = useState(null)

  useEffect(() => { fetchData() }, [itemFilter, sidoFilter])

  async function fetchData() {
    setLoading(true)
    await Promise.all([fetchAreaData(), fetchSeasonMonths()])
    setLoading(false)
  }

  async function fetchAreaData() {
    const { data, error } = await supabase.rpc('get_benchmark_data', {
      p_item_code: itemFilter,
      p_sido: sidoFilter,
    })
    if (!data || error) return

    // 재배면적 구간별 집계
    const buckets = Object.fromEntries(AREA_BUCKETS.map(b => [b.label, 0]))
    data.forEach(r => {
      const a = Number(r.cal_cultivation_area)
      const bucket = AREA_BUCKETS.find(b => a > b.min && a <= b.max)
        || (a <= 500 ? AREA_BUCKETS[0] : AREA_BUCKETS[4])
      buckets[bucket.label]++
    })
    setAreaData(AREA_BUCKETS.map(b => ({ range: b.label, count: buckets[b.label] })))

    // 시도별 평균 재배면적 (plant_density 대신 - 90% 채움률)
    const sidoCounts = {}, sidoSums = {}
    data.forEach(r => {
      const s = r.sido || '미상'
      const a = Number(r.cal_cultivation_area)
      if (!a) return
      sidoCounts[s] = (sidoCounts[s] || 0) + 1
      sidoSums[s]   = (sidoSums[s] || 0) + a
    })
    const sidoArr = Object.keys(sidoCounts)
      .map(sido => ({
        sido,
        avg: Math.round(sidoSums[sido] / sidoCounts[sido]),
        count: sidoCounts[sido],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    setSidoAreaData(sidoArr)

    // 요약 통계 (평균 재식수 포함)
    const areas = data.map(r => Number(r.cal_cultivation_area)).filter(Boolean).sort((a, b) => a - b)
    const plantNums = data.map(r => Number(r.cal_plant_num)).filter(Boolean)
    setSummary({
      count: data.length,
      avgArea:     areas.length     ? Math.round(areas.reduce((a, b) => a + b, 0) / areas.length) : 0,
      medArea:     areas.length     ? Math.round(areas[Math.floor(areas.length / 2)]) : 0,
      avgPlantNum: plantNums.length ? Math.round(plantNums.reduce((a, b) => a + b, 0) / plantNums.length) : 0,
    })
  }

  async function fetchSeasonMonths() {
    const { data, error } = await supabase.rpc('get_season_months', {
      p_item_code: itemFilter,
    })
    if (!data || error) return

    const monthMap = {}
    data.forEach(r => { monthMap[r.month] = Number(r.count) })
    setSeasonMonths(
      Array.from({ length: 12 }, (_, i) => ({
        month: `${i + 1}월`,
        count: monthMap[i + 1] || 0,
      }))
    )
  }

  return (
    <div className="space-y-8">
      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <span className="text-sm font-medium text-gray-500">품목</span>
        <select
          value={itemFilter}
          onChange={e => setItemFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300"
        >
          {Object.entries(ITEM_NAMES).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
        <span className="text-sm font-medium text-gray-500 ml-2">지역</span>
        <select
          value={sidoFilter}
          onChange={e => setSidoFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300"
        >
          <option value="전체">전체</option>
          {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {summary && (
          <span className="ml-auto text-sm text-gray-400">
            분석 대상: <strong className="text-gray-700">{summary.count.toLocaleString()}개</strong> 작기
          </span>
        )}
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '평균 재배면적',   value: summary.avgArea.toLocaleString(),     unit: '㎡' },
            { label: '중앙값 재배면적', value: summary.medArea.toLocaleString(),     unit: '㎡' },
            { label: '평균 재식수',     value: summary.avgPlantNum.toLocaleString(), unit: '주' },
            { label: '분석 작기 수',    value: summary.count.toLocaleString(),       unit: '개' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-400 mb-1">{card.label}</div>
              <div className="text-xl font-bold text-gray-800">
                {card.value}
                <span className="text-sm font-normal text-gray-400 ml-1">{card.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center text-green-500 py-12 animate-pulse">분석 중...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 재배면적 분포 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-700 mb-4">재배면적 분포</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={areaData}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`${v.toLocaleString()}개 작기`]}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 시도별 평균 재배면적 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-700 mb-4">
              시도별 평균 재배면적 (㎡)
            </h2>
            {sidoAreaData.length === 0 ? (
              <div className="flex items-center justify-center h-56 text-gray-300 text-sm">
                데이터 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sidoAreaData} layout="vertical" margin={{ left: 10, right: 60 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    tickFormatter={v => v.toLocaleString()} />
                  <YAxis type="category" dataKey="sido" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    formatter={(v, _, props) => [
                      `${v.toLocaleString()} ㎡ (${props.payload.count}개 작기)`,
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="avg" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 작기 시작 월 분포 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm lg:col-span-2">
            <h2 className="text-base font-semibold text-gray-700 mb-1">작기 시작 월 분포</h2>
            <p className="text-xs text-gray-400 mb-4">
              {ITEM_NAMES[itemFilter]}을 가장 많이 심기 시작하는 달
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={seasonMonths}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`${v.toLocaleString()}개 작기`]}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </div>
  )
}
