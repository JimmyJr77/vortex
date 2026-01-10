// Using Node.js built-in fetch (available in Node 18+)
const PRODUCTION_API_URL = 'https://vortex-backend-qybl.onrender.com'

async function checkMembersViaAPI() {
  try {
    console.log('🔍 Checking for members via production API...')
    console.log(`🌐 API URL: ${PRODUCTION_API_URL}`)
    console.log('')
    
    // Note: This endpoint likely requires authentication
    // If it doesn't work, you'll need to provide an admin token
    const response = await fetch(`${PRODUCTION_API_URL}/api/admin/members`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add Authorization header if you have an admin token
        // 'Authorization': `Bearer YOUR_ADMIN_TOKEN`
      }
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        console.log('❌ Authentication required')
        console.log('   This endpoint requires admin authentication.')
        console.log('   You need to provide a valid admin JWT token.')
        console.log('')
        console.log('   To get members:')
        console.log('   1. Login as admin to get a token')
        console.log('   2. Then use:')
        console.log('      export ADMIN_TOKEN="your-token-here"')
        console.log('      node check-members-via-api.js')
        console.log('')
        console.log('   Or use the direct database script with DATABASE_URL')
        return
      }
      
      const errorText = await response.text()
      console.log(`❌ API request failed: ${response.status} ${response.statusText}`)
      console.log(`   Response: ${errorText}`)
      return
    }
    
    const data = await response.json()
    
    if (data.success && data.data) {
      const members = data.data
      console.log(`✅ Found ${members.length} members`)
      console.log('')
      
      if (members.length > 0) {
        const activeMembers = members.filter(m => m.isActive).length
        const archivedMembers = members.length - activeMembers
        
        console.log(`   Active: ${activeMembers}`)
        console.log(`   Archived/Inactive: ${archivedMembers}`)
        console.log('')
        console.log('📋 Sample members (first 5):')
        console.log('─'.repeat(80))
        
        members.slice(0, 5).forEach((member, index) => {
          console.log(`${index + 1}. ${member.firstName} ${member.lastName}`)
          console.log(`   Email: ${member.email || 'N/A'}`)
          console.log(`   Phone: ${member.phone || 'N/A'}`)
          console.log(`   Age: ${member.age || 'N/A'}`)
          console.log(`   Status: ${member.status || 'N/A'} | Active: ${member.isActive ? 'Yes' : 'No'}`)
          console.log(`   Family: ${member.familyName || 'N/A'}`)
          console.log('')
        })
      } else {
        console.log('⚠️  No members found in production database')
      }
    } else {
      console.log('⚠️  Unexpected API response format')
      console.log('   Response:', JSON.stringify(data, null, 2))
    }
    
  } catch (error) {
    console.error('')
    console.error('❌ Error checking members via API:', error.message)
    console.error('')
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('   Could not connect to production API.')
      console.error('   Check your internet connection and verify the API URL is correct.')
    }
    throw error
  }
}

checkMembersViaAPI()
  .then(() => {
    console.log('✅ Check completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

