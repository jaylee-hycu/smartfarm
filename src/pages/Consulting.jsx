import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ITEM_NAMES, SIDO_LIST } from '../lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

// KAMIS 가격 데이터 (collect_kamis_prices.py 결과 기반)
const KAMIS_PRICES = {
  '080400': { name: '딸기',      avgPrice: 12810, monthly: {1:15651,2:13681,3:9631,4:8740,5:8678,12:19285} },
  '080300': { name: '토마토',    avgPrice: 4031,  monthly: {1:3737,2:4659,3:4436,4:3477,5:2706,6:2203,7:2724,8:3653,9:5873,10:6464,11:4750,12:3922} },
  '080600': { name: '방울토마토', avgPrice: 10800, monthly: {1:11573,2:12669,3:13044,4:11078,5:8763,6:8166,7:7401,8:9448,9:11290,10:12173,11:12241,12:12070} },
  '132600': { name: '파프리카',  avgPrice: 6433,  monthly: {1:7979,2:8686,3:8253,4:6721,5:4911,6:4186,7:3117,8:7542,9:8203,10:7145,11:5160,12:5656} },
  '090100': { name: '오이',      avgPrice: 2858,  monthly: {6:1450,7:2550,8:3045,9:3042,10:3145,11:3930} },
  '080200': { name: '참외',      avgPrice: 5372,  monthly: {3:8480,4:8142,5:4260,6:3918,7:3364,8:4232} },
  '080500': { name: '멜론',      avgPrice: 5596,  monthly: {1:7084,2:7919,3:7471,4:5879,5:5815,6:4545,7:4082,8:4438,9:3932,10:3920,11:5567,12:6600} },
}

// 품목별 단위수확량 (kg/㎡, 스마트팜 기준)
const YIELD_PER_SQM = {
  '080400': 3.5,   // 딸기
  '080300': 20,    // 토마토
  '080600': 15,    // 방울토마토
  '132600': 12,    // 파프리카
  '090100': 25,    // 오이
  '080200': 8,     // 참외
  '080500': 10,    // 멜론
}

// 시설비 (원/㎡)
const FACILITY_COST_PER_SQM = 150000  // 스마트팜 평균 약 15만원/㎡

// 운영비율 (매출 대비)
const OPERATING_COST_RATIO = 0.35

const ITEM_OPTIONS = Object.entries(KAMIS_PRICES).map(([code, data]) => ({
  code, name: data.name
}))

export default function Consulting() {
  const [sido, setSido]       = useState('전체')
  const [itemCode, setItemCode] = useState('080400')
  const [budget, setBudget]   = useState('')
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep]       = useState(1) // 1: 입력, 2: 리포트

  async function generateReport() {
    if (!budget || isNaN(budget) || Number(budget) <= 0) {
      alert('초기 투자 예산을 입력해주세요.')
      return
    }
    setLoading(true)

    // 1. 지역+품목 통계 조회
    const { data: stats } = await supabase.rpc('get_consulting_stats', {
      p_item_code: itemCode,
      p_sido: sido,
    })

    // 2. 작기 시작월 조회
    const { data: monthData } = await supabase.rpc('get_season_months', {
      p_item_code: itemCode,
    })

    // 3. 예산 기반 계산
    const budgetWon = Number(budget) * 10000  // 만원 → 원
    const area = Math.floor(budgetWon / FACILITY_COST_PER_SQM)  // 적정 면적
    const priceData = KAMIS_PRICES[itemCode]
    const yieldPerSqm = YIELD_PER_SQM[itemCode] || 5
    const annualYield = area * yieldPerSqm          // 연간 수확량 (kg)
    const annualRevenue = annualYield * priceData.avgPrice  // 연간 매출
    const operatingCost = annualRevenue * OPERATING_COST_RATIO
    const netProfit = annualRevenue - operatingCost

    // 낙관/기본/보수 시나리오
    const scenarios = [
      { label: '낙관', yieldMult: 1.3, priceMult: 1.2, color: '#22c55e' },
      { label: '기본', yieldMult: 1.0, priceMult: 1.0, color: '#3b82f6' },
      { label: '보수', yieldMult: 0.7, priceMult: 0.8, color: '#f59e0b' },
    ].map(s => ({
      ...s,
      revenue: Math.round(area * yieldPerSqm * s.yieldMult * priceData.avgPrice * s.priceMult),
      profit: Math.round(area * yieldPerSqm * s.yieldMult * priceData.avgPrice * s.priceMult * (1 - OPERATING_COST_RATIO)),
    }))

    // 월별 가격 차트용
    const monthlyChart = Object.entries(priceData.monthly)
      .map(([m, price]) => ({ month: m + '월', price }))
      .sort((a, b) => parseInt(a.month) - parseInt(b.month))

    // 작기 캘린더
    const monthMap = {}
    if (monthData) monthData.forEach(r => { monthMap[r.month] = Number(r.count) })
    const seasonChart = Array.from({ length: 12 }, (_, i) => ({
      month: (i + 1) + '월',
      count: monthMap[i + 1] || 0,
    }))

    setReport({
      sido,
      itemName: priceData.name,
      itemCode,
      budget: Number(budget),
      area,
      stats,
      annualYield,
      annualRevenue,
      operatingCost,
      netProfit,
      scenarios,
      monthlyChart,
      seasonChart,
      avgPrice: priceData.avgPrice,
      yieldPerSqm,
    })
    setStep(2)
    setLoading(false)
  }

  function reset() {
    setStep(1)
    setReport(null)
  }

  return (
    <div className="space-y-8">
      {step === 1 && (
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">🌱</div>
              <h2 className="text-xl font-bold text-gray-800">귀농 컨설팅</h2>
              <p className="text-sm text-gray-400 mt-1">
                지역, 품목, 예산을 입력하면 맞춤형 귀농 리포트를 생성합니다
              </p>
            </div>

            <div className="space-y-5">
              {/* 지역 */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  🗺️ 희망 지역
                </label>
                <select
                  value={sido}
                  onChange={e => setSido(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                >
                  <option value="전체">전체 (지역 미정)</option>
                  {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* 품목 */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  🌿 재배 품목
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ITEM_OPTIONS.map(item => (
                    <button
                      key={item.code}
                      onClick={() => setItemCode(item.code)}
                      className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        itemCode === item.code
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 예산 */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  💰 초기 투자 예산
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    placeholder="예: 30000"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">만원</span>
                </div>
                {budget && !isNaN(budget) && Number(budget) > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    예상 재배면적: 약{' '}
                    <span className="text-green-600 font-medium">
                      {Math.floor(Number(budget) * 10000 / FACILITY_COST_PER_SQM).toLocaleString()}㎡
                    </span>
                    {' '}(시설비 15만원/㎡ 기준)
                  </p>
                )}
              </div>

              <button
                onClick={generateReport}
                disabled={loading}
                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50"
              >
                {loading ? '리포트 생성 중...' : '귀농 리포트 생성 →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && report && (
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {report.sido === '전체' ? '전국' : report.sido} · {report.itemName} 귀농 리포트
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                초기투자 {report.budget.toLocaleString()}만원 기준 · 예상 재배면적 {report.area.toLocaleString()}㎡
              </p>
            </div>
            <button
              onClick={reset}
              className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5"
            >
              ← 다시 입력
            </button>
          </div>

          {/* 핵심 수치 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '예상 재배면적', value: report.area.toLocaleString(), unit: '㎡', color: 'green' },
              { label: '연간 예상 수확량', value: Math.round(report.annualYield).toLocaleString(), unit: 'kg', color: 'blue' },
              { label: '연간 예상 매출', value: Math.round(report.annualRevenue / 10000).toLocaleString(), unit: '만원', color: 'purple' },
              { label: '연간 예상 순이익', value: Math.round(report.netProfit / 10000).toLocaleString(), unit: '만원', color: 'red' },
            ].map(card => (
              <div key={card.label} className={`rounded-2xl border p-4 ${
                card.color === 'green'  ? 'bg-green-50 border-green-100' :
                card.color === 'blue'   ? 'bg-blue-50 border-blue-100' :
                card.color === 'purple' ? 'bg-purple-50 border-purple-100' :
                'bg-red-50 border-red-100'
              }`}>
                <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                <div className="text-xl font-bold text-gray-800">
                  {card.value}
                  <span className="text-sm font-normal text-gray-400 ml-1">{card.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 수익 시나리오 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-700 mb-1">수익 시나리오</h3>
            <p className="text-xs text-gray-400 mb-4">
              kg당 평균가 {report.avgPrice.toLocaleString()}원 · 단위수확량 {report.yieldPerSqm}kg/㎡ · 운영비 35% 가정
            </p>
            <div className="grid grid-cols-3 gap-3">
              {report.scenarios.map(s => (
                <div
                  key={s.label}
                  className="rounded-xl border p-4 text-center"
                  style={{ borderColor: s.color + '40', backgroundColor: s.color + '10' }}
                >
                  <div className="text-sm font-medium mb-2" style={{ color: s.color }}>
                    {s.label} 시나리오
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {Math.round(s.revenue / 10000).toLocaleString()}
                    <span className="text-xs font-normal text-gray-400 ml-1">만원 매출</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    순이익 {Math.round(s.profit / 10000).toLocaleString()}만원
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 월별 가격 패턴 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-700 mb-1">월별 도매가격 패턴</h3>
              <p className="text-xs text-gray-400 mb-4">
                {report.itemName} · 최근 3년 평균 (원/kg)
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report.monthlyChart}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v/1000).toFixed(0) + 'k'} />
                  <Tooltip
                    formatter={v => [v.toLocaleString() + '원/kg']}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                    {report.monthlyChart.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.price >= report.avgPrice * 1.1 ? '#22c55e' :
                              entry.price <= report.avgPrice * 0.9 ? '#f59e0b' : '#3b82f6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>고가 시즌</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>평균</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/>저가 시즌</span>
              </div>
            </div>

            {/* 작기 시작월 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-700 mb-1">작기 시작 시기</h3>
              <p className="text-xs text-gray-400 mb-4">
                전국 {report.itemName} 농가 기준 · 언제 심기 시작하는지
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report.seasonChart}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={v => [v + '개 작기']}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 지역 현황 */}
          {report.stats && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-700 mb-4">
                {report.sido === '전체' ? '전국' : report.sido} {report.itemName} 농가 현황
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '농가 수', value: report.stats.facility_count?.toLocaleString(), unit: '개소' },
                  { label: '평균 재배면적', value: Number(report.stats.avg_area)?.toLocaleString(), unit: '㎡' },
                  { label: '중앙값 재배면적', value: Number(report.stats.med_area)?.toLocaleString(), unit: '㎡' },
                  { label: '평균 재식수', value: Number(report.stats.avg_plant_num)?.toLocaleString(), unit: '주' },
                ].map(card => (
                  <div key={card.label} className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                    <div className="text-lg font-bold text-gray-700">
                      {card.value}
                      <span className="text-sm font-normal text-gray-400 ml-1">{card.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                💡 내 계획 면적({report.area.toLocaleString()}㎡)은 전국 평균({Number(report.stats.avg_area)?.toLocaleString()}㎡) 대비{' '}
                <span className={report.area >= Number(report.stats.avg_area) ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                  {report.area >= Number(report.stats.avg_area) ? '크거나 같은' : '작은'} 규모
                </span>
                입니다.
              </p>
            </div>
          )}

          {/* 주의사항 */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-amber-700 mb-2">⚠️ 참고사항</h3>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• 시설비는 스마트팜 기준 평균값(15만원/㎡)으로 추정됩니다. 실제 비용은 지역·시설 종류에 따라 다릅니다.</li>
              <li>• 단위수확량은 스마트팜 표준 수치이며, 기술 수준에 따라 크게 달라질 수 있습니다.</li>
              <li>• 가격 데이터는 KAMIS 도매가격 기준이며, 실제 판매가격과 다를 수 있습니다.</li>
              <li>• 환경 데이터(온도/습도/CO₂) 기반 분석은 추후 업데이트 예정입니다.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
