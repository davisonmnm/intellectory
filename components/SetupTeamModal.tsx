

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Session } from '@supabase/supabase-js';
import { INITIAL_STOCK_DATA, INITIAL_ACTIVITY_LOG_DATA } from '../constants';
import { Loader, Users } from 'lucide-react';

interface SetupTeamModalProps {
  session: Session;
  onTeamCreated: () => void;
}
/*
const seedInitialData = async (teamId: string, userId: string) => {
    console.log(`Seeding data for team: ${teamId}, user: ${userId}`);

    // Seed Stock Items
    const stockItemsToInsert = INITIAL_STOCK_DATA.map(item => ({
        ...item,
        team_id: teamId,
    }));
    const { error: stockError } = await supabase.from('stock_items').insert(stockItemsToInsert);
    if (stockError) console.error('Error seeding stock items:', stockError.message);
    else console.log("Seeded stock items.");

    // Seed Activity Log
    const activityLogToInsert = INITIAL_ACTIVITY_LOG_DATA.map(item => {
        const { actor, ...rest } = item;
        return {
            ...rest,
            team_id: teamId,
            user_id: actor === 'user' ? userId : null,
        };
    });
    
    const { error: activityLogError } = await supabase.from('activity_log').insert(activityLogToInsert);
    if (activityLogError) console.error('Error seeding activity_log:', activityLogError.message);
    else console.log("Seeded activity log.");
};
*/

const SetupTeamModal: React.FC<SetupTeamModalProps> = ({ session, onTeamCreated }) => {
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
        setError('Team name cannot be empty.');
        return;
    }
    setLoading(true);
    setError('');

    try {
      // 1. Create a new team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({ name: teamName.trim(), owner_id: session.user.id })
        .select()
        .single();
      
      if (teamError || !teamData) {
        throw teamError || new Error("Failed to create team.");
      }
      const teamId = teamData.id;

      // 2. Add user to the team as an Owner
      const { error: teamMemberError } = await supabase
        .from('team_members')
        .insert({ team_id: teamId, user_id: session.user.id, role: 'Owner' });

      if (teamMemberError) {
        throw teamMemberError;
      }
      
      // 3. Seed initial data for the new team - DISABLED
      // await seedInitialData(teamId, session.user.id);

      // 4. Signal to the parent component that setup is complete
      onTeamCreated();

    } catch (err: any) {
      console.error(err);
      setError(err.error_description || err.message || 'An unexpected error occurred.');
      setLoading(false);
    } 
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-bg-secondary p-8 rounded-2xl shadow-2xl border border-border-primary animate-fade-in-up">
        <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-accent-primary/20 rounded-full mb-4">
                <Users className="text-accent-primary" size={32} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
                Welcome to Intellectory!
            </h2>
            <p className="text-text-secondary mb-8">
                Let's start by creating a team for your inventory.
            </p>
        </div>

        {error && <div className="bg-danger/20 border border-danger text-danger text-sm p-3 rounded-md mb-4">{error}</div>}
        
        <form onSubmit={handleSetup} className="space-y-6">
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">Team Name</label>
            <input 
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              className="w-full bg-bg-primary border border-border-primary rounded-md p-3 text-text-primary focus:ring-2 focus:ring-accent-primary outline-none"
              placeholder="e.g., Afrivon Tech Farm"
              autoFocus
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 bg-accent-primary text-white font-semibold rounded-md hover:bg-purple-700 transition-colors disabled:bg-border-primary disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="animate-spin" /> : 'Create Team & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupTeamModal;