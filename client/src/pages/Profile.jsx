import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
  User, Mail, Shield, Phone, Heart, Calendar, Building, BookOpen, Loader2, Award, AlertCircle, Briefcase
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
        let res;
        if (user.role === 'STUDENT') {
          res = await api.get('/student/profile');
        } else if (user.role === 'FACULTY') {
          res = await api.get('/faculty/profile');
        } else {
          // ADMIN
          res = await api.get('/admin/profile');
        }
        setProfile(res.data);
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
        <span className="ml-3 text-text-muted">Loading profile card...</span>
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

  // Normalise shape across roles:
  // STUDENT  → { user, rollNo, section, batchYear, mobileNo, guardianContact, department }
  // FACULTY  → { user, designation, department, subjects[] }
  // ADMIN    → { user }  (user may include department from the select)
  const profileUser = profile?.user;
  const dept = profile?.department || profileUser?.department;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      
      {/* Profile Header Card */}
      <div className="relative backdrop-blur-md bg-bg-card/40 border border-border-app p-8 rounded-2xl flex flex-col sm:flex-row items-center gap-6 shadow-xl">
        <div className="absolute top-0 right-0 h-40 w-40 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
        
        {/* Avatar */}
        <div className="h-24 w-24 rounded-2xl bg-bg-app border border-border-card/50 flex items-center justify-center text-blue-500 shrink-0 shadow-inner">
          <User className="h-12 w-12" />
        </div>

        <div className="text-center sm:text-left space-y-2">
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-600/15 border border-blue-500/35 text-blue-400">
            {user.role} Account
          </span>
          <h1 className="text-2xl font-black text-text-main">{profileUser?.name}</h1>
          <p className="text-text-muted text-sm flex items-center justify-center sm:justify-start gap-2">
            <Mail className="h-4 w-4" />
            <span>{profileUser?.email}</span>
          </p>
          {user.role === 'FACULTY' && profile?.designation && (
            <p className="text-sm text-amber-400 font-semibold">{profile.designation}</p>
          )}
        </div>
      </div>

      {/* Role-specific panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: System Authentication — shown for all roles */}
        <div className="backdrop-blur-md bg-bg-card/20 border border-border-app/80 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            System Authentication
          </h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-border-card/60">
              <span className="text-text-muted">Access Role</span>
              <span className="font-semibold text-text-main">{user.role}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border-card/60">
              <span className="text-text-muted">Department</span>
              <span className="font-semibold text-text-main">
                {dept ? `${dept.name} (${dept.code})` : '—'}
              </span>
            </div>
            {profileUser?.createdAt && (
              <div className="flex justify-between items-center py-2">
                <span className="text-text-muted">Member Since</span>
                <span className="font-semibold text-text-main flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-text-muted" />
                  {new Date(profileUser.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Student Enrollment Details */}
        {user.role === 'STUDENT' && (
          <div className="backdrop-blur-md bg-bg-card/20 border border-border-app/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-500" />
              Enrollment Details
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-border-card/60">
                <span className="text-text-muted">Roll Number</span>
                <span className="font-semibold text-text-main font-mono">{profile?.rollNo}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-card/60">
                <span className="text-text-muted">Academic Batch</span>
                <span className="font-semibold text-text-main">{profile?.batchYear}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-card/60">
                <span className="text-text-muted">Section</span>
                <span className="font-semibold text-text-main">Section {profile?.section}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-card/60">
                <span className="text-text-muted">Mobile Phone</span>
                <span className="font-semibold text-text-main flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-text-muted" />
                  {profile?.mobileNo || 'Not specified'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-text-muted">Guardian Contact</span>
                <span className="font-semibold text-text-main flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5 text-text-muted" />
                  {profile?.guardianContact || 'Not specified'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Card 2: Faculty Teaching Info */}
        {user.role === 'FACULTY' && (
          <div className="backdrop-blur-md bg-bg-card/20 border border-border-app/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-500" />
              Teaching Profile
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-border-card/60">
                <span className="text-text-muted">Designation</span>
                <span className="font-semibold text-text-main">{profile?.designation || '—'}</span>
              </div>
              <div className="py-2">
                <span className="text-text-muted block mb-2">
                  Assigned Subjects ({profile?.subjects?.length ?? 0})
                </span>
                {profile?.subjects?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.subjects.map((sub) => (
                      <span
                        key={sub.id}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold"
                        title={sub.name}
                      >
                        {sub.code}
                        <span className="text-text-muted font-normal ml-1">· Sem {sub.semester}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-text-muted text-xs italic">No subjects assigned yet.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Card 2: Admin System Overview */}
        {user.role === 'ADMIN' && (
          <div className="backdrop-blur-md bg-bg-card/20 border border-border-app/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-rose-500" />
              Administrator Access
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-border-card/60">
                <span className="text-text-muted">Access Level</span>
                <span className="font-semibold text-rose-400">Full System Admin</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-card/60">
                <span className="text-text-muted">Manages Department</span>
                <span className="font-semibold text-text-main">
                  {dept ? `${dept.name} (${dept.code})` : 'All Departments'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-text-muted">Permissions</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  Unrestricted
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
