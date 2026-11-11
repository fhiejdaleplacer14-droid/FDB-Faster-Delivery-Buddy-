import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Lazy routes load their module on first visit, which can pass 1s when the whole suite runs in parallel.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => cleanup())
