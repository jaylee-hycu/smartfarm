import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ITEM_NAMES, ITEM_COLORS } from '../lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

export default function Dashboard() {
  const [stats, setStats]         = useState(null)
  const [sidoData, setSidoData]   = useState([])
  const [itemData, setItemData]   = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchStats(), fetchSido(), fetchItems()])
    setLoading(false)
  }

  async function fetchStats() {
    const [{ count: facCount }, { count: seaCount }, { count: culCount }] =
      await Promise.all([
        supabase.from('facilities').select('*', { count: 'exact', head: true }),
        supabase.from('cropping_seasons').select('*', { count: 'exact', head: true }),
        supabase.from('cultivate_data').select('*', { count: 'exact', head: true }),
      ])
    setStats({ facCount, seaCount, culCount })
  }

  async function fetchSido() {
    // RPC 함수로 DB에서 직접 집계 (row limit / URL length 문제 없음)
    const { data } = await supabase.rpc('get_sido_counts')
    if (!data) return
    setSidoData(data.map(r => ({ sido: r.sido, count: Number(r.count) })))
  }

  async function fetchItems() {
    // RPC 함수로 DB에서 직접 집계
    const { data } = await supabase.rpc('get_item_counts')
    if (!data) return

    const sorted = data.map(r => ({
      code: r.item_code,
      name: ITEM_NAMES[r.item_code] || (r.item_code === '기타' ? '기타' : `기타(${r.item_code})`),
      count: Number(r.count),
      color: ITEM_COLORS[r.item_code] || '#94a3b8'
    }))

    // 상위 7개 + 나머지 기타 합산
    const top7 = sorted.slice(0, 7)
    const etcCount = sorted.slice(7).reduce((sum, d) => sum + d.count, 0)
    const result = etcCount > 0
      ? [...top7, { code: 'etc', name: '기타', count: etcCount, color: '#94a3b8' }]
      : top7

    setItemData(result)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-green-600 text-lg animate-pulse">데이터 불러오는 중...</div>
    </div>
  )

  return (
    <div className="space-y-8">

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="전체 농가"
          value={stats?.facCount?.toLocaleString()}
          unit="개소"
          color="green"
          icon="🏡"
        />
        <StatCard
          label="딸기 작기"
          value={stats?.seaCount?.toLocaleString()}
          unit="개"
          color="red"
          icon="🍓"
        />
        <StatCard
          label="생육 조사 건수"
          value={stats?.culCount?.toLocaleString()}
          unit="건"
          color="blue"
          icon="🌱"
        />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 시도별 농가 수 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">
            시도별 농가 수
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={sidoData}
              layout="vertical"
              margin={{ left: 10, right: 30 }}
            >
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="sido"
                tick={{ fontSize: 11 }}
                width={120}
              />
              <Tooltip
                formatter={(v) => [`${v.toLocaleString()}개 농가`]}
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
              />
              <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 품목별 농가 수 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">
            품목별 농가 수
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={itemData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) =>
                  percent > 0.03 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                }
                labelLine={true}
              >
                {itemData.map((entry) => (
                  <Cell key={entry.code} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [`${v.toLocaleString()}개 농가`, n]}
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* 범례 */}
          <div className="flex flex-wrap gap-2 mt-2">
            {itemData.map(item => (
              <span
                key={item.code}
                className="flex items-center gap-1 text-xs text-gray-600"
              >
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.name} ({item.count.toLocaleString()})
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function StatCard({ label, value, unit, color, icon }) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-100',
    red:   'bg-red-50 text-red-700 border-red-100',
    blue:  'bg-blue-50 text-blue-700 border-blue-100',
  }
  return (
    <div className={`rounded-2xl border p-6 ${colors[color]}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm font-medium opacity-70 mb-1">{label}</div>
      <div className="text-3xl font-bold">
        {value}
        <span className="text-base font-normal ml-1">{unit}</span>
      </div>
    </div>
  )
}
