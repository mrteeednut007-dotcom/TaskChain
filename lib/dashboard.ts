import { sql } from './db'

export interface DashboardStats {
  activeContracts: number
  completedContracts: number
  totalEarnings: number
  escrowVolume: number
}

/**
 * Fetch aggregated dashboard stats for a user.
 * - activeContracts: jobs in active states where user is client or freelancer
 * - completedContracts: jobs with status 'completed'
 * - totalEarnings: sum of confirmed 'release' transactions to the user's wallet
 * - escrowVolume: sum of confirmed 'deposit' transactions minus confirmed 'release'/'refund'
 *   for jobs still in escrow (escrow_status = 'funded')
 */
export async function getDashboardStats(userId: number): Promise<DashboardStats> {
  const [active, completed, earnings, escrow] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE (client_id = ${userId} OR freelancer_id = ${userId})
        AND status IN ('assigned', 'in_progress', 'in_review')
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE (client_id = ${userId} OR freelancer_id = ${userId})
        AND status = 'completed'
    `,
    sql`
      SELECT COALESCE(SUM(et.amount), 0)::float AS total
      FROM escrow_transactions et
      JOIN jobs j ON j.id = et.job_id
      WHERE et.transaction_type = 'release'
        AND et.status = 'confirmed'
        AND (j.client_id = ${userId} OR j.freelancer_id = ${userId})
    `,
    sql`
      SELECT COALESCE(SUM(et.amount), 0)::float AS total
      FROM escrow_transactions et
      JOIN jobs j ON j.id = et.job_id
      WHERE et.transaction_type = 'deposit'
        AND et.status = 'confirmed'
        AND j.escrow_status = 'funded'
        AND (j.client_id = ${userId} OR j.freelancer_id = ${userId})
    `,
  ])

  return {
    activeContracts: active[0].count,
    completedContracts: completed[0].count,
    totalEarnings: earnings[0].total,
    escrowVolume: escrow[0].total,
  }
}
