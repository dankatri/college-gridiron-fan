// Simple debug script to test data loading
import { getPlayers, getConferences, getTeams } from './src/lib/data.js';

async function debugDataLoading() {
  console.log('=== Testing Data Loading ===');
  
  try {
    console.log('\n1. Testing Conferences...');
    const conferences = await getConferences();
    console.log(`Loaded ${conferences.length} conferences:`, conferences);
    
    console.log('\n2. Testing Teams...');
    const teams = await getTeams();
    console.log(`Loaded ${teams.length} teams:`, teams.slice(0, 10), '...');
    
    console.log('\n3. Testing Default Players...');
    const allPlayers = await getPlayers();
    console.log(`Loaded ${allPlayers.length} total players`);
    
    const qbs = allPlayers.filter(p => p.position === 'QB');
    const rbs = allPlayers.filter(p => p.position === 'RB');
    const wrs = allPlayers.filter(p => p.position === 'WR');
    console.log(`By position: QB=${qbs.length}, RB=${rbs.length}, WR=${wrs.length}`);
    
    console.log('\n4. Testing Conference Filtering (SEC)...');
    const secPlayers = await getPlayers({ specificConference: 'SEC' });
    console.log(`SEC players: ${secPlayers.length}`);
    
    console.log('\n5. Testing Team Filtering (Alabama)...');
    const alabamaPlayers = await getPlayers({ specificTeam: 'Alabama' });
    console.log(`Alabama players: ${alabamaPlayers.length}`);
    
    console.log('\n=== Debug Complete ===');
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

// Run if this is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugDataLoading();
}

export { debugDataLoading };