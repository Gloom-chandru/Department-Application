import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
  User, Mail, Shield, Phone, Heart, Calendar, Building, BookOpen, Loader2, Award, AlertCircle
} from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        if (user.role === 'STUDENT') {
          const res = await api.get('/student/profile');
          setProfile(res.data);
        } else {
          // For Faculty/Admin we already have their core info, or can fetch from backend
          // Let's create a generic profile loader if needed, otherwise read from token/user
          setProfile({
            user: {
              name: user.name,
              email: user.email,
              role: user.role,
              createdAt: new Date().toISOString(), // Mock fallback
            },
          });
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load profile details.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
        <span className="ml-3 text-slate-400">Loading profile card...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg mt-12 p-6 rounded-xl border border-red-500/20 bg-red-950/10 text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <p className="text-white font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      
      {/* Profil Header Card */}
      <div className="relative backdrop-blur-md bg-slate-900/40 border border-slate-800 p-8 rounded-2xl flex flex-col sm:flex-row items-center gap-6 shadow-xl">
        <div className="absolute top-0 right-0 h-40 w-40 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
        
        {/* Avatar Ring */}
        <div className="h-24 w-24 rounded-2xl bg-slate-950 border border-slate-850 flex items-center justify-center text-blue-500 shrink-0 shadow-inner">
          <User className="h-12 w-12" />
        </div>

        <div className="text-center sm:text-left space-y-2">
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-600/15 border border-blue-500/35 text-blue-400">
            {user.role} Account
          </span>
          <h1 className="text-2xl font-black text-white">{profile?.user.name}</h1>
          <p className="text-slate-400 text-sm flex items-center justify-center sm:justify-start gap-2">
            <Mail className="h-4 w-4" />
            <span>{profile?.user.email}</span>
          </p>
        </div>
      </div>

      {/* Role specific panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Account Parameters */}
        <div className="backdrop-blur-md bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            System Authentication
          </h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
              <span className="text-slate-500">Access Role</span>
              <span className="font-semibold text-white">{user.role}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
              <span className="text-slate-500">Department</span>
              <span className="font-semibold text-white">
                {user.department ? `${user.department.name} (${user.department.code})` : 'AI & DS (AIDS)'}
              </span>
            </div>
            {profile?.user.createdAt && (
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">Created At</span>
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  {new Date(profile.user.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Student Metadata (Only rendered for students) */}
        {user.role === 'STUDENT' && (
          <div className="backdrop-blur-md bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-500" />
              Enrollment Details
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                <span className="text-slate-500">Roll Number</span>
                <span className="font-semibold text-white font-mono">{profile?.rollNo}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                <span className="text-slate-500">Academic Batch</span>
                <span className="font-semibold text-white">{profile?.batchYear}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                <span className="text-slate-500">Section</span>
                <span className="font-semibold text-white">Section {profile?.section}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-850/60">
                <span className="text-slate-500">Mobile Phone</span>
                <span className="font-semibold text-slate-350 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  {profile?.mobileNo || 'Not specified'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">Guardian Contact</span>
                <span className="font-semibold text-slate-350 flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5 text-slate-500" />
                  {profile?.guardianContact || 'Not specified'}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Profile;
