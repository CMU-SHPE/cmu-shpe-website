import { runVercelBuild } from './vercel-build-steps'

// Exiting explicitly ends any request or prompt a timed-out push left open.
runVercelBuild(process.env).then((code) => process.exit(code))
