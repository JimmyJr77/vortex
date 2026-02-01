import fetch from 'node-fetch'

// This script queries the production API to see registrations
// You'll need to provide an admin token

const PRODUCTION_API = 'https://vortex-backend-qybl.onrender.com'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''

async function checkProductionViaAPI() {
  try {
    console.log('🔍 Checking production registrations via API...\n')
    console.log(`📍 API: ${PRODUCTION_API}\n`)
    
    if (!ADMIN_TOKEN) {
      console.log('⚠️  No ADMIN_TOKEN provided')
      console.log('   Set it with: export ADMIN_TOKEN="your-token-here"')
      console.log('   Or get it from browser localStorage after logging into admin portal\n')
      return
    }
    
    const response = await fetch(`${PRODUCTION_API}/api/admin/registrations`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API Error: ${response.status} ${response.statusText}`)
      console.error(`   ${errorText}`)
      return
    }
    
    const data = await response.json()
    
    if (!data.success) {
      console.error('❌ API returned success: false')
      console.error(`   Message: ${data.message}`)
      return
    }
    
    const registrations = data.data || []
    console.log(`✅ Found ${registrations.length} registration(s) in production:\n`)
    console.log('='.repeat(100))
    
    registrations.forEach((reg, idx) => {
      console.log(`\n${idx + 1}. ID: ${reg.id}`)
      console.log(`   Name: ${reg.first_name} ${reg.last_name}`)
      console.log(`   Email: ${reg.email}`)
      console.log(`   Phone: ${reg.phone || 'N/A'}`)
      console.log(`   Age: ${reg.athlete_age || 'N/A'}`)
      if (reg.interests_array && reg.interests_array.length > 0) {
        console.log(`   Interests: ${reg.interests_array.join(', ')}`)
      } else if (reg.interests) {
        console.log(`   Interests: ${reg.interests}`)
      }
      if (reg.class_types && reg.class_types.length > 0) {
        console.log(`   Class Types: ${reg.class_types.join(', ')}`)
      }
      console.log(`   Created: ${reg.created_at}`)
      if (reg.archived !== undefined) {
        console.log(`   Archived: ${reg.archived ? 'Yes' : 'No'}`)
      }
      console.log('-'.repeat(100))
    })
    
    // Show registrations after Dec 31, 2025
    const recent = registrations.filter(r => new Date(r.created_at) > new Date('2025-12-31'))
    console.log(`\n📅 Registrations after Dec 31, 2025: ${recent.length}`)
    if (recent.length > 0) {
      recent.forEach(reg => {
        console.log(`   - ${reg.first_name} ${reg.last_name} (${reg.email}) - ${reg.created_at}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkProductionViaAPI()

