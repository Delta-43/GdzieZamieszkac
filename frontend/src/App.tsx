import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { ComparePage } from './pages/ComparePage'
import { DistrictPage } from './pages/DistrictPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { DistrictsPage } from './pages/DistrictsPage'
import { FindPage } from './pages/FindPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="districts" element={<DistrictsPage />} />
        <Route path="districts/:code" element={<DistrictPage />} />
        <Route path="find" element={<FindPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
