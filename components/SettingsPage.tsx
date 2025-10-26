import React, { useState, useEffect, useRef } from 'react';
import { User, Users, Mail, Trash2, ShieldAlert, Upload, AlertTriangle, KeyRound, CheckCircle, Edit3, Archive } from 'lucide-react';
import { TeamMember } from '../types';

interface SettingsPageProps {
    teamName: string;
    teamMembers: TeamMember[];
    onUpdateTeamName: (newName: string) => void;
    onAddMember: (email: string) => void;
    onRemoveMember: (memberId: string) => void;
    onUpdateMemberRole: (memberId: string, newRole: 'Manager' | 'Worker') => void;
    onResetData: () => void;
    onResetBinData: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ teamName, teamMembers, onUpdateTeamName, onAddMember, onRemoveMember, onUpdateMemberRole, onResetData, onResetBinData }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'danger'>('profile');
    const [fullName, setFullName] = useState('Davison Munemo');
    const [editableTeamName, setEditableTeamName] = useState(teamName);
    const [inviteEmail, setInviteEmail] = useState('');
    const [notification, setNotification] = useState<string | null>(null);
    const [profilePic, setProfilePic] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditableTeamName(teamName);
    }, [teamName]);
    
    const showNotification = (message: string) => {
        setNotification(message);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleProfileSave = (e: React.FormEvent) => {
        e.preventDefault();
        showNotification("Profile updated successfully!");
    };
    
    const handleTeamNameSave = () => {
        onUpdateTeamName(editableTeamName);
        showNotification("Team name updated successfully!");
    };

    const handleSendInvite = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        onAddMember(inviteEmail);
        showNotification(`Invitation sent to ${inviteEmail}.`);
        setInviteEmail('');
    };
    
    const handleRemoveMember = (memberId: string, memberName: string) => {
        if (window.confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
            onRemoveMember(memberId);
            showNotification(`${memberName} has been removed.`);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                setProfilePic(loadEvent.target?.result as string);
                showNotification("Profile picture updated.");
            };
            reader.readAsDataURL(file);
        }
    };

    const TabButton: React.FC<{tabId: 'profile' | 'team' | 'danger'; children: React.ReactNode}> = ({ tabId, children }) => (
        <button onClick={() => setActiveTab(tabId)} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-2 ${activeTab === tabId ? 'bg-accent-primary text-white' : 'text-text-secondary hover:bg-bg-secondary'}`}>
            {children}
        </button>
    );
    
    const SettingsCard: React.FC<{title: string; description: string; children: React.ReactNode}> = ({ title, description, children }) => (
        <div className="bg-bg-secondary rounded-lg border border-border-primary">
            <div className="p-4 border-b border-border-primary"><h3 className="text-lg font-bold text-white">{title}</h3><p className="text-sm text-text-secondary mt-1">{description}</p></div>
            <div className="p-4">{children}</div>
        </div>
    );

    const FormRow: React.FC<{ label: string; children: React.ReactNode}> = ({label, children}) => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center py-1.5"><label className="text-sm font-medium text-text-secondary">{label}</label><div className="md:col-span-2">{children}</div></div>
    );

    return (
        <div className="space-y-4">
            {notification && (<div className="fixed top-5 right-5 bg-success border border-green-500 shadow-2xl rounded-lg p-4 max-w-sm w-full animate-fade-in-up z-50"><div className="flex items-center gap-3"><CheckCircle size={20} className="text-white"/><p className="text-sm text-white font-semibold">{notification}</p></div></div>)}
            <div><h2 className="text-3xl font-bold text-white">Settings</h2><p className="text-text-secondary">Manage your profile, team, and application settings.</p></div>
            <div className="flex items-center gap-1 border-b border-border-primary pb-1"><TabButton tabId="profile"><User size={16}/> Profile</TabButton><TabButton tabId="team"><Users size={16}/> Team Management</TabButton><TabButton tabId="danger"><ShieldAlert size={16}/> Danger Zone</TabButton></div>
            <div className="animate-fade-in">
            {activeTab === 'profile' && (
                <form onSubmit={handleProfileSave}>
                <SettingsCard title="Profile Information" description="Update your personal details and profile picture.">
                    <div className="space-y-3">
                    <FormRow label="Profile Picture">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-bg-primary rounded-full flex items-center justify-center overflow-hidden">
                                {profilePic ? (
                                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={32} className="text-text-secondary"/>
                                )}
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept="image/png, image/jpeg" 
                            />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-border-primary hover:bg-gray-700 text-white font-semibold">
                                <Upload size={14}/> Upload New
                            </button>
                        </div>
                    </FormRow>
                    <FormRow label="Full Name"><input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" /></FormRow>
                    <FormRow label="Email Address"><input type="email" value="davison@afrivon.com" readOnly className="w-full bg-bg-primary border border-border-primary rounded-md p-2 text-gray-500 cursor-not-allowed" /></FormRow>
                    <div className="flex justify-end pt-2"><button type="submit" className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">Save Changes</button></div>
                    </div>
                </SettingsCard>
                </form>
            )}
            {activeTab === 'team' && (
                <div className="space-y-4">
                    <SettingsCard title="Team Settings" description="Manage your team's name.">
                        <FormRow label="Team Name">
                            <div className="flex items-center gap-2">
                                <Edit3 className="h-5 w-5 text-text-secondary"/>
                                <input 
                                    type="text" 
                                    value={editableTeamName} 
                                    onChange={e => setEditableTeamName(e.target.value)} 
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTeamNameSave(); }}}
                                    className="flex-grow bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" 
                                />
                                <button type="button" onClick={handleTeamNameSave} className="px-4 py-2 rounded-md bg-accent-primary hover:bg-purple-700 text-white font-semibold">Save</button>
                            </div>
                        </FormRow>
                    </SettingsCard>
                    <SettingsCard title="Team Members" description="Manage who has access to this inventory.">
                        <div className="space-y-2">
                            {teamMembers.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-2 bg-bg-primary rounded-md">
                                    <div>
                                        <p className="font-semibold text-white">{member.name}</p>
                                        <p className="text-sm text-text-secondary">{member.email}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {member.role === 'Owner' ? (
                                            <span className="text-sm font-semibold text-accent-primary px-2">Owner</span>
                                        ) : (
                                            <select
                                                value={member.role}
                                                onChange={(e) => onUpdateMemberRole(member.id, e.target.value as 'Manager' | 'Worker')}
                                                className="bg-bg-secondary border border-border-primary rounded-md p-1 text-xs text-white focus:ring-1 focus:ring-accent-primary outline-none"
                                            >
                                                <option value="Manager">Manager</option>
                                                <option value="Worker">Worker</option>
                                            </select>
                                        )}
                                        {member.role !== 'Owner' && (
                                            <button type="button" onClick={() => handleRemoveMember(member.id, member.name)} className="text-text-secondary hover:text-danger" title="Remove Member">
                                                <Trash2 size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SettingsCard>
                    <form onSubmit={handleSendInvite}>
                    <SettingsCard title="Invite New Member" description="Enter an email address to invite a new member to your team.">
                        <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-text-secondary"/><input type="email" placeholder="new.member@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required className="flex-grow bg-bg-primary border border-border-primary rounded-md p-2 text-white focus:ring-2 focus:ring-accent-primary outline-none" /><button type="submit" className="px-4 py-2 rounded-md bg-success hover:bg-green-700 text-white font-semibold">Send Invite</button></div>
                    </SettingsCard>
                    </form>
                </div>
            )}
            {activeTab === 'danger' && (
                <SettingsCard title="Danger Zone" description="These actions are irreversible. Please be certain.">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-danger/10 border border-danger/30 rounded-lg">
                            <div><h4 className="font-bold text-danger">Reset Bin Data</h4><p className="text-sm text-red-400/80">Deletes all bin parties, balances, and history. Keeps your bin type configurations.</p></div>
                            <button onClick={onResetBinData} className="px-4 py-2 rounded-md bg-danger hover:bg-red-700 text-white font-semibold whitespace-nowrap flex items-center gap-2"><Archive size={16}/> Reset Bin Data</button>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-danger/10 border border-danger/30 rounded-lg">
                            <div><h4 className="font-bold text-danger">Reset All Data</h4><p className="text-sm text-red-400/80">This will permanently delete all inventory items, history, suppliers, and transactions. Your team will remain.</p></div>
                            <button onClick={onResetData} className="px-4 py-2 rounded-md bg-danger hover:bg-red-700 text-white font-semibold whitespace-nowrap flex items-center gap-2"><AlertTriangle size={16}/> Reset Application</button>
                        </div>
                    </div>
                </SettingsCard>
            )}
            </div>
        </div>
    );
};

export default SettingsPage;