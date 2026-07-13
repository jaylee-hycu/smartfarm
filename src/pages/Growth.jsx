import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ITEM_NAMES } from '../lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'

// 딸기 조사 항목 (examin_iem_code 기준)
const GROWTH_ITEMS = {
  '10000001': '엽수 (개)',
  '10000002': '생장길이 (mm)',
  '10000003': '엽장 (mm)',
  '10000004': '엽폭 (mm)',
  '10000005': '관부직경 (mm)',
  '10000006': '화방수 (개)',
  '10000008': '1화방 착과수 (개)',
}

export default function Growth() {
  const [itemFilter, setItemFilter]     = useState('080400')
  const [growthItem, setGrowthItem]     = useState('10000001')
  const [summaryCards, setSummaryCards] = useState([])
  const [sidoCompare, setSidoCompare]   = useState([])
  const [monthlyTrend, setMonthlyTrend] = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    fetchData()
  }, [itemFilter, growthItem])

  async function fetchData() {
    setLoading(true)
    await Promise.all([fetchSummary(), fetchSidoCompare(), fetchMonthlyTrend()])
    setLoading(false)
  }

  async function fetchSummary() {
    const cards = []
    for (const [code, label] of Object.entries(GROWTH_ITEMS)) {
      const { data } = await supabase
        .from('cultivate_data')
        .select('examin_iem_value')
        .eq('item_code', itemFilter)
        .eq('examin_iem_code', code)
        .not('examin_iem_value', 'is', null)
        .gt('examin_iem_value', 0)
        .lt('examin_iem_value', 10000)
        .limit(10000)

      if (data && data.length > 0) {
        const vals = data.map(r => r.examin_iem_value)
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        cards.push({ code, label, avg: avg.toFixed(1), count: vals.length })
      }
    }
    setSummaryCards(cards)
  }

  async function fetchSidoCompare() {
    // RPC 함수로 DB에서 직접 조인+집계 (URL length 제한 없음)
    const { data } = await supabase.rpc('get_sido_growth_avg', {
      p_item_code: itemFilter,
      p_growth_code: growthItem,
    })
    if (!data) return
    setSidoCompare(data.map(r => ({
      sido: r.sido,
      avg: Number(r.avg),
      count: Number(r.count),
    })))
  }

  async function fetchMonthlyTrend() {
    const { data } = await supabase
      .from('cultivate_data')
      .select('examin_de, examin_iem_value')
      .eq('item_code', itemFilter)
      .eq('examin_iem_code', growthItem)
      .not('examin_iem_value', 'is', null)
      .not('examin_de', 'is', null)
      .gt('examin_iem_value', 0)
      .lt('examin_iem_value', 10000)
      .limit(20000)

    if (!data) return

    const monthSums = {}, monthCounts = {}
    data.forEach(r => {
      if (!r.examin_de || r.examin_de.length < 6) return
      const ym = r.examin_de.substring(0, 6)
      const val = r.examin_iem_value
      monthSums[ym]   = (monthSums[ym] || 0) + val
      monthCounts[ym] = (monthCounts[ym] || 0) + 1
    })

    const trend = Object.keys(monthSums)
      .sort()
      .map(ym => ({
        month: `${ym.substring(0, 4)}.${ym.substring(4, 6)}`,
        avg: parseFloat((monthSums[ym] / monthCounts[ym]).toFixed(1)),
      }))
      .slice(-24)

    setMonthlyTrend(trend)
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

        <span className="text-sm font-medium text-gray-500 ml-2">조사 항목</span>
        <select
          value={growthItem}
          onChange={e => setGrowthItem(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-300"
        >
          {Object.entries(GROWTH_ITEMS).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>

      {/* 생육 항목 요약 카드 */}
      {summaryCards.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">생육 항목 전국 평균</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summaryCards.map(card => (
              <div
                key={card.code}
                className={`rounded-xl border p-4 shadow-sm cursor-pointer transition-all ${
                  growthItem === card.code
                    ? 'bg-green-50 border-green-300'
                    : 'bg-white border-gray-100 hover:border-green-200'
                }`}
                onClick={() => setGrowthItem(card.code)}
              >
                <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                <div className="text-xl font-bold text-gray-800">{card.avg}</div>
                <div className="text-xs text-gray-400 mt-1">{card.count.toLocaleString()}건 기준</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-green-500 py-12 animate-pulse">분석 중...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 시도별 평균 비교 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-700 mb-1">
              시도별 평균 비교
            </h2>
            <p className="text-xs text-gray-400 mb-4">{GROWTH_ITEMS[growthItem]}</p>
            {sidoCompare.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-300 text-sm">
                데이터 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sidoCompare} layout="vertical" margin={{ left: 10, right: 50 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="sido" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    formatter={(v, _, props) => [
                      `${v} (${props.payload.count.toLocaleString()}건)`,
                      GROWTH_ITEMS[growthItem]
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="avg" fill="#e74c6f" radius={[0, 4, 4, 0]} />
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
              최근 24개월 · {GROWTH_ITEMS[growthItem]}
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [v, GROWTH_ITEMS[growthItem]]}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#e74c6f"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </div>
  )
}
