import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { DistrictPage } from './pages/DistrictPage'
import { DistrictsPage } from './pages/DistrictsPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="districts" element={<DistrictsPage />} />
        <Route path="districts/:code" element={<DistrictPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
