/**
 * Unit tests for lib/dashboard.ts query logic.
 * Uses Node.js built-in test runner (Node 18+).
 * Run: npx tsx --test lib/dashboard.test.ts
 */
import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// Build a mockSql factory that returns controlled per-call results
// ---------------------------------------------------------------------------
function makeMockSql(results: Record<string, unknown>[][]) {
  let i = 0
  return function (_strings: TemplateStringsArray, ..._values: unknown[]) {
    return Promise.resolve(results[i++] ?? [])
  }
}

// ---------------------------------------------------------------------------
// Helpers to create a getDashboardStats bound to a given mockSql
// ---------------------------------------------------------------------------
async function importWithMock(results: Record<string, unknown>[][]) {
  const mockSql = makeMockSql(results)
  mock.module('./db', { namedExports: { sql: mockSql } })
  // Re-import to pick up the new mock
  const mod = await import(`./dashboard?t=${Date.now()}`)
  return mod.getDashboardStats as (userId: number) => Promise<{
    activeContracts: number
    completedContracts: number
    totalEarnings: number
    escrowVolume: number
  }>
}

describe('getDashboardStats', () => {
  it('returns mapped stats from query results', async () => {
    const getDashboardStats = await importWithMock([
      [{ count: 3 }],
      [{ count: 10 }],
      [{ total: 2500.50 }],
      [{ total: 800.00 }],
    ])

    const stats = await getDashboardStats(1)
    assert.equal(stats.activeContracts, 3)
    assert.equal(stats.completedContracts, 10)
    assert.equal(stats.totalEarnings, 2500.50)
    assert.equal(stats.escrowVolume, 800.00)
  })

  it('handles zero values when no data exists', async () => {
    const getDashboardStats = await importWithMock([
      [{ count: 0 }],
      [{ count: 0 }],
      [{ total: 0 }],
      [{ total: 0 }],
    ])

    const stats = await getDashboardStats(99)
    assert.equal(stats.activeContracts, 0)
    assert.equal(stats.completedContracts, 0)
    assert.equal(stats.totalEarnings, 0)
    assert.equal(stats.escrowVolume, 0)
  })

  it('issues exactly 4 concurrent queries via Promise.all', async (t) => {
    let callCount = 0
    const mockSql = (_strings: TemplateStringsArray, ..._values: unknown[]) => {
      callCount++
      return Promise.resolve([{ count: 0, total: 0 }])
    }
    t.mock.module('./db', { namedExports: { sql: mockSql } })
    const { getDashboardStats } = await import(`./dashboard?t=${Date.now()}`)

    await getDashboardStats(1)
    assert.equal(callCount, 4, 'Expected exactly 4 SQL queries')
  })
})
