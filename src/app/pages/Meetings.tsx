import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockAPI } from '../lib/mockAPI';
import { motion } from 'motion/react';
import { Calendar, Video, CheckCircle2, Clock, ExternalLink, FileText } from 'lucide-react';
import { format, isBefore } from 'date-fns';

export function Meetings() {
  const { meetings, addMeeting } = useStore();

  useEffect(() => {
    if (meetings.length === 0) {
      mockAPI.getMeetings().then((mtgs) => {
        mtgs.forEach(meeting => addMeeting(meeting));
      });
    }
  }, [meetings.length, addMeeting]);

  const upcomingMeetings = meetings.filter(m => 
    m.status === 'scheduled' && !isBefore(m.date, new Date())
  );
  
  const pastMeetings = meetings.filter(m => 
    m.status === 'completed' || isBefore(m.date, new Date())
  );

  const successRate = meetings.length > 0 
    ? ((meetings.filter(m => m.status === 'completed').length / meetings.length) * 100).toFixed(0)
    : 0;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Meetings</h1>
        <p className="text-slate-600">Manage and track all your scheduled meetings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900">{upcomingMeetings.length}</div>
              <div className="text-sm text-slate-600">Upcoming Meetings</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900">{pastMeetings.length}</div>
              <div className="text-sm text-slate-600">Completed</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-900">{successRate}%</div>
              <div className="text-sm text-slate-600">Success Rate</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Upcoming Meetings */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-600" />
          Upcoming Meetings
        </h2>

        {upcomingMeetings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-slate-200">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No upcoming meetings scheduled</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingMeetings.map((meeting, index) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{meeting.title}</h3>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{format(meeting.date, 'EEEE, MMMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{format(meeting.date, 'h:mm a')} • {meeting.duration} minutes</span>
                      </div>
                      <div className="font-semibold text-slate-900">
                        {meeting.leadName} • {meeting.leadCompany}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {meeting.meetingLink && (
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Join Meeting
                      </button>
                    )}
                    <button className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Past Meetings */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          Past Meetings
        </h2>

        {pastMeetings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-slate-200">
            <CheckCircle2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No past meetings yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pastMeetings.map((meeting, index) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">{meeting.title}</h3>
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        Completed
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <div>{format(meeting.date, 'MMMM d, yyyy • h:mm a')}</div>
                      <div className="font-semibold text-slate-900">
                        {meeting.leadName} • {meeting.leadCompany}
                      </div>
                    </div>
                  </div>
                </div>

                {meeting.aiSummary && (
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-slate-900">AI Meeting Summary</span>
                    </div>
                    <p className="text-sm text-slate-700">{meeting.aiSummary}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    View Summary
                  </button>
                  {meeting.followUpSent ? (
                    <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Follow-up Sent
                    </div>
                  ) : (
                    <button className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors text-sm">
                      Send Follow-up
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
