import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Benchmark from './pages/Benchmark'
import Growth    from './pages/Growth'

const PAGES = [
  { id: 'dashboard', label: '📊 현황', component: Dashboard },
  { id: 'benchmark', label: '📐 벤치마킹', component: Benchmark },
  { id: 'growth',    label: '🌱 생육 분석', component: Growth },
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const Current = PAGES.find(p => p.id === page)?.component

  return (
    <div className="min-h-screen bg-gray-50">

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-gray-800 text-lg">스마트팜 벤치마킹</span>
          </div>

          <nav className="flex gap-1 ml-auto">
            {PAGES.map(p => (
              <button
                key={p.id}
                onClick={() => setPage(p.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  page === p.id
                    ? 'bg-green-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 페이지 타이틀 */}
      <div className="bg-white border-b border-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-800">
            {PAGES.find(p => p.id === page)?.label}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            스마트팜 빅데이터 공공 API 기반 · 전국 2,307개 농가
          </p>
        </div>
      </div>

      {/* 콘텐츠 */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {Current && <Current />}
      </main>

      {/* 푸터 */}
      <footer className="text-center text-xs text-gray-300 py-8">
        데이터 출처: 스마트팜코리아 빅데이터 제공 서비스 · 농림수산식품교육문화정보원
      </footer>
    </div>
  )
}
