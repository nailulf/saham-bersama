import { NextResponse } from 'next/server'

// Health check endpoint for admin dashboard
export async function GET() {
  try {
    // Check critical services
    const checks = {
      database: await checkDatabase(),
      cache: await checkCache(),
      externalAPIs: await checkExternalAPIs(),
    }

    const allHealthy = Object.values(checks).every(check => check.status === 'healthy')

    return NextResponse.json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    }, {
      status: allHealthy ? 200 : 503,
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

async function checkDatabase() {
  try {
    // Add your database check logic here
    // Example: await prisma.$queryRaw`SELECT 1`
    return { status: 'healthy', latency: '12ms' }
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function checkCache() {
  try {
    // Add your cache check logic here
    return { status: 'healthy', latency: '2ms' }
  } catch (error) {
    return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function checkExternalAPIs() {
  try {
    // Add your external API checks here
    return { status: 'healthy', services: { yahoo: 'up', idx: 'up' } }
  } catch (error) {
    return { status: 'degraded', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
