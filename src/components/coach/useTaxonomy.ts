import { useEffect, useState } from 'react'
import { fetchTaxonomy, type Taxonomy } from '../../coach/taxonomy'

export function useTaxonomy() {
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchTaxonomy()
      .then((data) => {
        if (active) setTaxonomy(data)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load taxonomy')
      })
    return () => {
      active = false
    }
  }, [])

  return { taxonomy, error }
}
